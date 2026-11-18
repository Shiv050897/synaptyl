# SYNAPTYL

**Practice. Progress. Master.**

A free question-practice and learning platform for school students (Classes 1–12) and competitive-exam aspirants.

## Product principles
- Free access for every learner during the initial launch.
- English-first experience.
- School learning and competitive exam preparation.
- MCQ, written-answer and numerical question formats.
- Practice sessions, mock tests, explanations, bookmarks and progress tracking.

## Technology
- React 19 + TypeScript
- Vite 8
- Supabase (PostgreSQL, Auth, Storage and Edge Functions)
- Cloudflare Pages
- GitHub

## Local development
Requires Node.js 22.12 or newer.

```bash
npm install
cp .env.example .env.local
# Add your Supabase publishable key to .env.local
npm run dev
```

Production build: `npm run build`.

## Cloudflare Pages
- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

## Supabase
This frontend is configured for the dedicated SYNAPTYL Supabase project. Do not connect it to MySMath or reuse MySMath users or data.

Only the project URL and publishable key belong in browser environment variables. Never expose a Supabase secret key or legacy `service_role` key in frontend code.

**Important current Supabase behaviour:** new tables are not automatically exposed through the Data API by default. Future migrations must explicitly grant only the required API privileges, enable RLS, and create reviewed policies before client access is enabled.

## Security baseline
- Enable and test Row Level Security on every exposed table.
- Keep answer keys and grading rules outside student-readable API access.
- Enforce administrator permissions server-side; never use editable user metadata for authorization.
- Students must only access their own private records.
- Never let clients directly award or edit marks, answer correctness, payment status or role assignments.

## Development status
The repository contains the initial React frontend foundation and branded landing page. Authentication, protected dashboards, question workflows and database migrations are subsequent implementation steps; they are not yet claimed as complete.

## License
Not yet specified. All rights reserved by the repository owner unless a license is added.
