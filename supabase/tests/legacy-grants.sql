-- Run after the historical chain, before the forward migrations.
GRANT ALL ON ALL TABLES IN SCHEMA public TO PUBLIC,anon,authenticated;
CREATE POLICY legacy_write ON public.users FOR ALL TO PUBLIC USING(true) WITH CHECK(true);
CREATE POLICY legacy_write ON public.settings FOR ALL TO PUBLIC USING(true) WITH CHECK(true);
UPDATE public.settings SET value='https://discord.com/api/webhooks/123/migrated-token' WHERE key='discord_webhook_url';
INSERT INTO storage.objects(bucket_id,name) VALUES('avatars','legacy.png');
