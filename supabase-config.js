// ─── Supabase Configuration ───────────────────────────────────────────────────
// 1. Go to https://supabase.com and create a free project.
// 2. In your project: Settings → API → copy "Project URL" and "anon public" key.
// 3. Replace the placeholder strings below with your real values.
// 4. In the Supabase SQL editor, run the SQL below to create the favorites table.
//
// ─── SQL to run in Supabase SQL Editor ───────────────────────────────────────
//
//   CREATE TABLE favorites (
//     id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
//     slug        text        NOT NULL,
//     user_name   text        NOT NULL,
//     created_at  timestamptz DEFAULT now(),
//     UNIQUE (slug, user_name)
//   );
//
//   ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
//
//   CREATE POLICY "public_read"   ON favorites FOR SELECT USING (true);
//   CREATE POLICY "public_insert" ON favorites FOR INSERT WITH CHECK (true);
//   CREATE POLICY "public_delete" ON favorites FOR DELETE USING (true);
//
// ─────────────────────────────────────────────────────────────────────────────

export const SUPABASE_URL      = 'https://kxstiqvifaiimxewmjhb.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_QrWvDtws7qqOZyaBGGHQHA_Rg4T11Zo';
