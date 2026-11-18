# SYNAPTYL

**Practice. Progress. Master.**

A free question-practice and learning platform for school students (Classes 1–12) and competitive-exam aspirants.

## Product principles
- Free access for every learner during the initial launch.
- English-first experience.
- Two main learning areas: K–12 and GK & GS for competitive exams.
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
# Add the SYNAPTYL Supabase publishable key to .env.local
npm run dev
```

Production build: `npm run build`.

## Cloudflare Pages
- Framework preset: React (Vite)
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

## Supabase
This frontend is configured for the dedicated SYNAPTYL Supabase project. Do not connect it to MySMath or reuse MySMath users or data.

Only the project URL and publishable key belong in browser environment variables. Never expose a Supabase secret key or legacy `service_role` key in frontend code.

### Database foundation
The initial schema is applied to the SYNAPTYL Supabase project and its migration files are stored in `supabase/migrations/`.

- User profiles, with an automatic profile row on signup.
- K–12 classes 1–12 and five subject entries per class.
- GK & GS subject with eight initial topics.
- Competitive exam categories: SSC, Railway, Teaching, Banking, Defence and Other.
- Questions and options, with answer keys and grading data stored in the non-exposed `private` schema.
- Practice sessions, learner attempts and bookmarks.
- Row Level Security and least-privilege Data API grants.

To avoid accidentally changing another project, link the CLI only to the dedicated SYNAPTYL project before running migrations.

### Security baseline
- RLS is enabled on all application tables.
- Answer keys, solution records, grades and user roles are kept outside the exposed public schema.
- Admin permissions are stored in a protected table, not editable user metadata.
- Learners can read their own practice data; attempt records cannot be updated or deleted directly by a browser client.
- Future migrations must explicitly grant only required API privileges and include reviewed RLS policies.
- Never let clients directly award or edit marks, answer correctness, payment status or role assignments.

## Development status
The repository includes the branded landing page, React/Vite foundation and the initial Supabase database migrations. Student authentication screens, question workflows, grading functions and admin interfaces are still to be implemented.

## License
Not yet specified. All rights reserved by the repository owner unless a license is added.
