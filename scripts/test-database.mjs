// This runner ONLY creates disposable Docker databases. It accepts no database
// URL, cannot target production, and removes its own container in finally.
import { spawnSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import assert from 'node:assert/strict'
import vm from 'node:vm'

const docker = (args, input) => {
    const result = spawnSync('docker',args,{input,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024})
    if(result.status!==0) throw new Error(result.stderr || result.error?.message || 'Docker command failed')
    return result.stdout.trim()
}
try { docker(['info','--format','{{.ServerVersion}}']) }
catch { throw new Error('Local Docker daemon is unavailable. Start Docker Desktop, then run npm run test:db. No database checks ran.') }
const name='ttt-remediation-'+Date.now()
let started=false
try {
    docker(['run','--rm','-d','--name',name,'-e','POSTGRES_PASSWORD=disposable-test-only','postgres:17-alpine'])
    started=true
    const deadline=Date.now()+60000
    for(;;){
        try{docker(['exec',name,'pg_isready','-U','postgres']);break}
        catch(error){if(Date.now()>deadline)throw error;await new Promise(resolve=>setTimeout(resolve,500))}
    }
    const sql=(db,source)=>docker(['exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',db],source)
    sql('postgres','CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;')
    const read=name=>fs.readFileSync(path.join('supabase/tests',name),'utf8')
    const files=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()
    const archive=db=>sql(db,"SELECT jsonb_build_object('matches',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.matches m WHERE season_id=1),'snapshots',(SELECT jsonb_agg(to_jsonb(s) ORDER BY user_id) FROM public.pingpong_season_snapshots s));")
    for(const mode of ['fresh','upgrade']){
        const db='test_'+mode
        sql('postgres','CREATE DATABASE '+db)
        sql(db,read('bootstrap.sql'))
        for(const file of files){
            if(mode==='upgrade' && file.includes('pingpong_seasons'))sql(db,read('archive-seed.sql'))
            if(mode==='upgrade' && file.includes('authorized_write_paths'))sql(db,read('legacy-grants.sql'))
            const migration=fs.readFileSync(path.join('supabase/migrations',file),'utf8')
            try{sql(db,migration.includes('\nBEGIN;')?migration:'BEGIN;\n'+migration+'\nCOMMIT;')}
            catch(error){throw new Error(mode+' migration '+file+': '+error.message)}
        }
        if(mode==='fresh')assert.equal(sql(db,'SELECT count(*) FROM public.users'),'0')
        if(mode==='upgrade')assert.equal(sql(db,'SELECT webhook_url FROM private.discord_config'),'https://discord.com/api/webhooks/123/migrated-token')
        const archived=archive(db)
        sql(db,read('remediation.sql'))
        assert.equal(archive(db),archived,'archived matches and snapshots changed')
        sql(db,"SELECT test.rejects('UPDATE public.matches SET score1=99 WHERE season_id=1') WHERE EXISTS(SELECT 1 FROM public.matches WHERE season_id=1);")
        // Compare the real SQL rebuild with the real JS history replay. VM removes
        // browser imports; only pure helpers are exported and no requests run.
        const context=vm.createContext({})
        const pure=file=>fs.readFileSync(file,'utf8').replace(/^import .*$/gm,'').replace(/export /g,'')
        vm.runInContext(pure('src/utils.js')+'\n'+pure('src/padelUtils.js')+'\n'+pure('src/tennisUtils.js')+'\nglobalThis.replay={buildPadelEloHistory,buildTennisEloHistory}',context)
        for(const sport of ['padel','tennis']){
            const data=JSON.parse(sql(db,`SELECT jsonb_build_object('users',(SELECT jsonb_agg(u) FROM public.users u),'matches',(SELECT jsonb_agg(m) FROM public.${sport}_matches m),'stats',(SELECT jsonb_agg(s) FROM public.${sport}_stats s));`))
            const replay=context.replay[sport==='padel'?'buildPadelEloHistory':'buildTennisEloHistory'](data.users,data.matches||[])
            for(const stat of data.stats)assert.equal(replay.currentRatings[stat.user_id],stat.elo_rating,sport+' SQL/JS ELO parity')
        }
        // Concurrent first attempts must serialize before creating attempt rows.
        sql(db,'TRUNCATE private.admin_login_attempts;')
        const attempt=()=>new Promise((resolve,reject)=>{
            const child=spawn('docker',['exec',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',db,'-c',"SET ROLE anon; SELECT public.create_admin_session('000000');"],{windowsHide:true,stdio:['ignore','pipe','pipe']})
            let error='';child.stderr.on('data',chunk=>{error+=chunk});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(error)))
        })
        await Promise.all(Array.from({length:12},attempt))
        assert.equal(sql(db,"SELECT failed_attempts FROM private.admin_login_attempts WHERE login_key=private.admin_login_key()"),'5')
        assert.equal(sql(db,"SELECT failed_attempts FROM private.admin_login_attempts WHERE login_key='aggregate'"),'5')
        process.stdout.write(mode+': migration chain, authorization, transactions, throttling, archive, SQL/JS parity passed\n')
    }
} finally {
    if(started)docker(['rm','-f',name])
}
