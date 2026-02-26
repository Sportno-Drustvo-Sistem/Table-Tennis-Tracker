-- Create settings table
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (assuming admin-only access will be handled in UI)
CREATE POLICY "Allow all for settings" ON settings FOR ALL USING (true) WITH CHECK (true);

-- Insert default placeholder if not exists
INSERT INTO public.settings (key, value)
VALUES ('discord_webhook_url', '')
ON CONFLICT (key) DO NOTHING;
