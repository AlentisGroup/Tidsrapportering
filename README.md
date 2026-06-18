# Novadex Tid & Löner

En första lokal webbapp för tid, projekt, kvitton, resor och löneunderlag på en redovisningsbyrå.

## Öppna appen

Starta appen med:

```powershell
node server.js
```

Öppna sedan `http://localhost:4173` i webbläsaren. Appen kräver inga installerade beroenden.

På Windows kan du också dubbelklicka `starta-app.bat` och sedan öppna `http://localhost:4173`.

## Ingår

- Timer för pågående kundarbete
- Manuell tidsrad med kund, projekt/arbetsorder, aktivitet, medarbetare, timmar och status
- Registreringstyper för debiterbar kundtid, interntid och frånvaro
- Attestflöde från utkast till godkänt underlag
- Kundregister med ansvarig, organisationsnummer och timpris
- Översikt med veckans timmar, fakturerbar tid och aktivitet
- Rapportvy för faktureringsunderlag, löneunderlag och tid per medarbetare
- CSV-export av tidsrader
- Lokal lagring i webbläsaren via `localStorage`

## Nästa naturliga steg

- Inloggning och roller för medarbetare, attestansvarig och admin
- Databas och backend så alla anställda delar samma data
- Fakturaintegration mot Fortnox, Visma eller annat ekonomisystem
- Kundprojekt, frånvaro, budget och debiteringsgrad
- Export till Excel eller direkt fakturaunderlag

## Supabase Free

Vi har lagt till en Supabase-start i mappen `supabase/`.

- `supabase/schema.sql` skapar databas, roller, RLS-regler och Storage bucket.
- `supabase/README.md` beskriver hur projektet sätts upp.
- `supabase-config.example.js` visar vilka publika nycklar appen behöver.
- `supabase-config.js` skapas lokalt från exemplet och ska inte laddas upp till ett publikt repo.

Skicka bara Supabase `Project URL` och `anon public key` när appen ska kopplas. Skicka aldrig `service_role key`.

## Molnläge i appen

Appen har nu en knapp i topplisten: `Moln`.

Den kan:

- se om Supabase SDK och config är laddade
- logga in mot Supabase Auth
- visa om användaren har en profilrad i `profiles`
- skapa kontoansökan som sparas i `account_requests`
- synka godkänd Supabase-profil till lokal roll i prototypen
- låta aktiv admin godkänna eller avvisa kontoansökningar via SQL-funktionerna `approve_account_request` och `reject_account_request`
- logga ut

Den lokala prototypen använder fortfarande `localStorage` för datan tills vi migrerar tabellerna stegvis.

Första admin behöver skapas manuellt i Supabase efter första inloggningen:

1. Skapa organisation i `organizations`.
2. Skapa profil i `profiles` med samma `id` som användaren i `auth.users`.
3. Sätt `role = 'admin'` och `is_active = true`.
4. Lägg organisationens id i `organizationId` i `supabase-config.js` så nya kontoansökningar kopplas rätt.
