# Supabase Free setup för Novadex Tid & Löner

Det här är första molnsteget. Appen kan fortsätta köras lokalt med `localStorage`, men databasen är förberedd för riktig inloggning, roller, kundportal, fakturor och filer.

## 1. Skapa Supabase-projekt

1. Gå till Supabase och skapa ett nytt projekt.
2. Välj region i EU, helst `Central EU (Frankfurt)`.
3. Spara dessa två värden från `Project Settings > API`:
   - `Project URL`
   - `anon public key`

Skicka bara `Project URL` och `anon public key` till Codex när vi ska koppla appen. Skicka inte `service_role key`.

## 2. Kör databasschemat

1. Öppna `SQL Editor` i Supabase.
2. Klistra in hela innehållet från `supabase/schema.sql`.
3. Kör scriptet.

Det skapar:

- organisationer/byråer
- användarprofiler och roller
- kontoansökningar
- kunder
- projekt
- tidrader
- kvitton och filreferenser
- resor
- avtal och e-signeringar
- fakturor
- portalärenden, kommentarer och uppladdningar
- privat Storage bucket: `novadex-documents`
- grundläggande RLS-regler

## 3. Första admin

När inloggning kopplas in gör vi så här:

1. Du skapar första användaren via Supabase Auth.
2. Vi lägger in en rad i `organizations`.
3. Vi lägger in din användare i `profiles` med `role = 'admin'` och `is_active = true`.
4. Efter det kan admin godkänna nya kontoansökningar i appen.

## 4. Viktigt på Free-planen

Supabase Free räcker bra för prototyp och tidig test:

- Databas: Postgres
- Auth: inloggning
- Storage: kvitton och dokument
- API: automatiskt

Begränsningen är att projekt kan pausas vid inaktivitet och att lagring/utrymme är begränsat. Det är okej för test, men inte för skarp kunddrift.

## 5. Nästa kodsteg

Nästa steg är att koppla appen mot Supabase:

1. Lägg in `Project URL` och `anon public key` i en lokal configfil.
2. Bygg `supabaseClient`.
3. Ersätt `loadState()` och `saveState()` stegvis med databasläsning.
4. Börja med:
   - Auth
   - `profiles`
   - `clients`
   - `projects`
   - `time_entries`
5. Därefter kopplar vi filer, fakturor och kundportal.

