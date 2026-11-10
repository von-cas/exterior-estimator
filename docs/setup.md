# Setup

How to run this on your own accounts. Values go in `.env.local` (git-ignored)
on your machine and in Vercel's environment variables. Never commit them.

## 1. Supabase

1. Create a project. Pick the region nearest your users (Americas for the
   US). Untick "Automatically expose new tables" and tick "Enable automatic
   RLS"; the migrations grant access table by table. Save the database
   password.
2. Authentication > Sign In / Providers: keep Email on, turn **Allow new users
   to sign up** off. The seed script creates the demo users.
3. Copy into `.env.local`:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key (older projects: anon key) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key (older projects: service_role key) → `SUPABASE_SECRET_KEY`
   - Connect > Session pooler connection string, with the password filled in →
     `SUPABASE_DB_URL`
4. Apply the schema and seed data:

   ```
   npx supabase db push --db-url "$SUPABASE_DB_URL"
   npm run seed
   ```

   This creates the tables, row-level security, the private `reports` bucket,
   the sample catalog and four demo users (admin, estimator, sales, production).

## 2. The model that reads reports

Any OpenAI-compatible endpoint works. The defaults in `.env.example` point at
OpenRouter with a free model: create a key at openrouter.ai and set
`LLM_API_KEY`. Change `LLM_MODEL` to use a different model.

## 3. Vercel

1. Import this repository as a new project. The Next.js settings are detected.
2. Add the same variables as `.env.local`, except `SUPABASE_DB_URL`, plus
   `OUTBOX_SECRET` (any long random string).
3. Deploy. Production is reachable by anyone, but every screen and API route
   needs a signed-in user or the outbox secret.

## 4. n8n

n8n can run anywhere, including on your own machine with no public address,
because it collects events from the app instead of receiving them.

1. Import the workflows in `n8n/`.
2. Create two credentials: a header credential that sends `OUTBOX_SECRET`, and
   an email credential (SMTP or Gmail) for sending purchase orders.
3. Set the app address in the workflow's first node and activate both
   workflows.

A public tunnel is needed only if an outside service must call n8n directly,
such as a HOVER webhook. For that, `cloudflared tunnel --url
http://localhost:5678` gives a temporary address.

## 5. Run locally

```
npm install
npm test
npm run dev
```
