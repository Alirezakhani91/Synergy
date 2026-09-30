# Synergy Academy CRM

CRM + Course + Finance platform for Synergy Academy.

## Live architecture
- GitHub Pages: frontend
- Supabase: Auth + PostgreSQL database
- No secret/service-role key is stored in the frontend. Only the Supabase anon/publishable key belongs in `config.js`.

## First deployment
1. Create a Supabase project.
2. Open SQL Editor and run `schema.sql`.
3. In Authentication > Users create the first user.
4. In SQL Editor add that user to `profiles` as admin:
   `insert into profiles(id,email,full_name,role) values ('AUTH_USER_UUID','YOUR_EMAIL','Admin','admin');`
5. Copy Project URL and anon/publishable key into `config.js`.
6. Upload all files to the root of the GitHub repository.
7. GitHub > Settings > Pages > Deploy from branch > `main` / `(root)`.

## Current modules
Dashboard, leads, follow-ups, sales pipeline, students, courses, payments, expenses, profitability and board reporting. The UI also has a browser-only Demo Mode so it can be reviewed before Supabase is connected.

## Security
RLS is enabled. Board users are read-only. Sales users cannot write finance tables. Finance users manage payments/expenses/invoices. Admin/Academy Manager have broader access.
