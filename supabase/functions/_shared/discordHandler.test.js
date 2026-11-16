import { describe, expect, it, vi } from 'vitest'
import { handleDiscordRequest } from './discordHandler'
const webhook='https://discord.com/api/webhooks/123/private-token'
const request=body=>new Request('https://local.test/discord-admin',{method:'POST',headers:{origin:'https://app.test','content-type':'application/json'},body:JSON.stringify(body)})
const options=()=>({allowedOrigins:['https://app.test'],client:{rpc:vi.fn()},fetcher:vi.fn().mockResolvedValue(new Response(null,{status:204}))})
describe('Discord server boundary',()=>{
    for(const action of ['status','update','send']) it('rejects missing and invalid sessions for '+action,async()=>{
        const opts=options()
        expect((await handleDiscordRequest(request({action}),opts)).status).toBe(401)
        expect(opts.client.rpc).not.toHaveBeenCalled()
        opts.client.rpc.mockResolvedValue({error:{code:'42501'}})
        const response=await handleDiscordRequest(request({action,adminToken:'expired',url:webhook,payload:{content:'test'}}),opts)
        expect(response.status).toBe(401);expect(opts.fetcher).not.toHaveBeenCalled()
    })
    it('returns status without the secret even if an upstream response contains it',async()=>{
        const opts=options();opts.client.rpc.mockResolvedValue({data:{configured:true,webhook_url:webhook}})
        const response=await handleDiscordRequest(request({action:'status',adminToken:'valid'}),opts)
        expect(await response.json()).toEqual({configured:true})
        expect(response.headers.get('cache-control')).toBe('no-store')
    })
    it('sends through service-only RPC, disallows mentions and strips caller destinations',async()=>{
        const opts=options();opts.client.rpc.mockResolvedValue({data:webhook})
        const response=await handleDiscordRequest(request({action:'send',adminToken:'valid',url:'https://evil.test',payload:{content:'report',allowed_mentions:{parse:['everyone']}}}),opts)
        expect(response.status).toBe(200)
        expect(opts.client.rpc).toHaveBeenCalledWith('discord_delivery_url',{p_admin_token:'valid'})
        expect(opts.fetcher.mock.calls[0][0]).toBe(webhook)
        expect(JSON.parse(opts.fetcher.mock.calls[0][1].body)).toEqual({content:'report',username:'Table Tennis Tracker',allowed_mentions:{parse:[]}})
        expect(opts.fetcher.mock.calls[0][1].redirect).toBe('error')
    })
    it('does not leak webhook or outbound errors',async()=>{
        const opts=options();opts.client.rpc.mockResolvedValue({data:webhook});opts.fetcher.mockResolvedValue(new Response(webhook,{status:400}))
        const response=await handleDiscordRequest(request({action:'send',adminToken:'valid',payload:{content:'report'}}),opts)
        expect(response.status).toBe(502);expect(await response.text()).not.toContain('private-token')
    })
    it('blocks redirected/foreign destinations and unapproved browser origins',async()=>{
        const opts=options();opts.client.rpc.mockResolvedValue({data:'https://evil.test/secret'})
        expect((await handleDiscordRequest(request({action:'send',adminToken:'valid',payload:{content:'report'}}),opts)).status).toBe(409)
        expect(opts.fetcher).not.toHaveBeenCalled()
        expect((await handleDiscordRequest(request({}),{...opts,allowedOrigins:[]})).status).toBe(403)
    })
})
