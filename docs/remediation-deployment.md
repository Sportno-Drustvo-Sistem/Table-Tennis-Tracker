# Remediation deployment — 15 October 2026

This change is implemented locally. No production migration, deployment, credential rotation or Discord send was performed. Database integration and real Storage HTTP behavior remain unverified on this workstation; Docker's daemon is unavailable and `docker desktop start` cannot locate its installation registration.

## Verify locally first

```powershell
New-Item -ItemType Directory -Force .tmp/test-temp | Out-Null
$env:TEMP = (Resolve-Path .tmp/test-temp).Path
$env:TMP = $env:TEMP
npm test
npm run lint
npm run build
npm run test:db
```

`test:db` requires a working local Docker engine and permission to pull `postgres:17-alpine`. It creates and deletes its own container without publishing a port. It accepts no production database URL. It executes the entire migration chain twice: a fresh database with no implicit application grants and an upgrade database with legacy PUBLIC/anon/authenticated grants, permissive policies, a configured webhook and an archived season. It checks real SQL permissions, guarded RPCs, transaction rollback, login state/concurrency, archive preservation and SQL/JavaScript ELO parity. Its Storage fixture exercises PostgreSQL RLS, not the real Supabase Storage HTTP service.

After the SQL suite passes, use a disposable local Supabase project to check:

1. Anonymous and ordinary authenticated requests cannot insert/update/delete protected tables. Public viewing still works. On an empty database Add Player creates the first player with 1200 ratings and zero wins; extra rating/win RPC fields are rejected.
2. Optional PNG/JPG/JPEG/WebP/GIF/AVIF avatars upload under `create/<random UUID>.<extension>` with `upsert: false`. Existing paths cannot be overwritten or deleted, even with `upsert: true`. An admin can replace a profile picture by uploading a new object and calling `update_player` with a valid custom session. Old objects remain available; cleanup, if needed, is an operator/service-role task. Public creation has no general overwrite or deletion right. [Supabase documents the separate INSERT and overwrite permissions](https://supabase.com/docs/guides/storage/security/access-control).
3. Both edit modals save scores and rebuild sport statistics atomically. Invalid, expired and revoked custom sessions fail. Live Padel scoring pauses between sets, cancels on reset/close/replacement, and undo restores the preceding point. Tennis tiebreak serving and undo work for either initial server.
4. The Discord endpoint returns status only; neither public settings, status nor any anonymous RPC exposes the webhook. Mock Discord for send verification. Do not test sending against the production webhook.

## Migration and release order

1. Take a database/Storage backup, retain the previous frontend build, and schedule a short write-maintenance window. Check the target's migration ledger before using `db push`: historical migrations were previously renamed, so an existing installation may need ledger repair. Do not replay historical season initialization on an existing database.
2. For an installation already at the repository's prior migration head, apply these **new forward migrations in order**:
   - `20261015100000_authorized_write_paths.sql`
   - `20261015101000_scoring_and_atomic_edits.sql`

   For a fresh Supabase instance, apply the complete migration directory. Check the planned changes before applying:

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push --dry-run
   supabase db push
   ```

   On an upgrade, the dry run should show only the two new migrations. Each new migration is transactional. The first moves an existing nonempty webhook into `private.discord_config` and deletes its public settings row in the same transaction. A constraint reserves the old public key against accidental reintroduction. It explicitly revokes legacy table writes and removes non-SELECT policies. Public reads and narrow creation/admin mutation RPCs receive explicit grants. The second adds atomic edits and validation and changes only the Padel/Tennis rating implementations; installation alone does not rebuild historical ratings.
3. Configure and deploy the `discord-admin` Edge Function before releasing the new frontend:

   ```bash
   supabase secrets set ALLOWED_ORIGINS=https://YOUR_APP_HOST
   supabase functions deploy discord-admin --no-verify-jwt
   ```

   For multiple app hosts, `ALLOWED_ORIGINS` is a comma-separated exact origin list, including scheme and optional port. Include localhost only for development. The runtime must provide `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Supabase hosted functions provide these). Keep both the service key and webhook out of all `VITE_*` variables and frontend runtime configuration. `verify_jwt = false` is intentional: the custom opaque admin token is **not** a Supabase Auth JWT. Every status/update/send is authorized by SQL; send uses the service-only `discord_delivery_url` RPC, which additionally validates the custom session. [Supabase's function configuration documents JWT verification](https://supabase.com/docs/guides/functions/function-configuration).
4. Release the frontend built by `npm run build` through the existing hosting process and require open admin clients to refresh. Older clients' direct player/settings/edit write paths will be denied after hardening.
5. An operator must rotate any previously exposed Discord webhook in Discord Server Settings → Integrations → Webhooks, then save its replacement in the app's admin Settings. The input starts empty and status reports only whether a webhook is configured. Saving an empty value disables it. The server accepts canonical `https://discord.com/api/webhooks/<id>/<token>` URLs only; older alternate-host/query-string URLs preserved by migration require replacement before delivery. Rotation is necessary because migration cannot invalidate copies of the previously public credential.
6. Rebuild affected historical Padel/Tennis ratings under maintenance, using the database owner's SQL console after backup:

   ```sql
   BEGIN;
   SELECT public.recalculate_padel_stats();
   SELECT public.recalculate_tennis_stats();
   COMMIT;
   ```

   These internal functions are unavailable to browser roles. Admin clients can instead use `admin_recalculate_padel_stats` and `admin_recalculate_tennis_stats`, passing `p_admin_token`. Recording, editing, deleting and recalculating use the same per-sport advisory locks. Rebuilds update derived sport statistics only. Match records, Ping Pong ratings and archived Ping Pong snapshots remain intact. Reload the frontend and compare stored ratings/wins with full history after rebuilding.

Do not restore permissive policies/grants to roll back a UI issue. Keep writes in maintenance while correcting or rolling forward a failed release.

## Rating rule

For Padel and Tennis, the result comes from sets won when `sets_data` is nonempty. ELO uses K=32 and a fixed match weight of **1**, independent of game totals. Each Padel teammate receives the team-average ELO adjustment. Legacy rows with no sets use the game winner at the same weight; legacy ties receive zero adjustment. Both implementations start at 1200, replay by `created_at ASC, id ASC`, and round halves away from zero. Thus a 6–4, 0–6, 6–4 winner at equal ratings gains 16 despite losing total games 12–14; a 14–14 game total with a set winner also yields ±16. Ping Pong retains its existing margin/streak calculation and seasonal behavior.

## PIN throttle boundary

This repository does not establish a trusted proxy that strips/signs client-address headers. The login RPC therefore ignores **all** supplied User-Agent, X-Forwarded-For and X-Real-IP values. It uses the normalized database peer address (`inet_client_addr`) with five failed attempts per 15-minute window, plus an independent aggregate limit of 30. Attempt creation/check/increment is serialized before PIN verification, including the first concurrent requests. Successful login resets the peer counter, not the aggregate counter. Sessions still expire after 12 hours and can be revoked.

Hosted PostgREST/connection-pool peers may be shared by all visitors; in that deployment the peer quota is deliberately shared too. It must not be advertised as a per-visitor/IP quota. This can temporarily block legitimate admin login after someone exhausts the shared quota. Adding visitor-specific quotas later requires a verified proxy boundary or signed identity, while retaining an independent aggregate limit. Do not switch back to caller-supplied headers. [PostgREST documents that request headers are supplied as request context](https://docs.postgrest.org/en/stable/references/transactions.html).
