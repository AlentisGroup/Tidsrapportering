# Publicering

Det här repot innehåller källfilerna för Novadex Tid & Löner.

## Ingår i repo

- `index.html`
- `styles.css`
- `app.js`
- `server.js`
- `starta-app.bat`
- `supabase/schema.sql`
- `supabase/README.md`
- `supabase-config.example.js`

## Ingår inte i repo

- `supabase-config.js`
- `Tidbyran-fristaende.html`
- gamla zippar, arbetskopior och testfiler

Anledningen är att `supabase-config.js` är miljö-/projektunik. Supabase anon key är en publik nyckel, men den bör ändå inte blandas in i källkoden i onödan när repot är publikt.

## Lokal körning

1. Kopiera `supabase-config.example.js` till `supabase-config.js`.
2. Fyll i Supabase Project URL och anon public key.
3. Kör:

```powershell
node server.js
```

4. Öppna:

```text
http://localhost:4173
```
