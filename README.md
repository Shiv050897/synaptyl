# SYNAPTYL

**Practice. Progress. Master.**

SYNAPTYL is a free question-practice and learning platform for school students (Classes 1–12) and competitive-exam aspirants.

## Launch principles

- Free access for all students during the initial launch.
- English-first experience.
- Multiple question formats: MCQ, written-answer, and numerical.
- Student progress, bookmarks, practice sessions, and mock tests.
- Secure separation of student, administrator, and answer-key data.

## Planned technology

- React + TypeScript + Vite
- Cloudflare Pages
- Supabase (Auth, PostgreSQL, Storage, and Edge Functions)
- GitHub for version control

## Important security rules

- Never put Supabase service-role or secret keys in frontend code.
- Enable and test Row Level Security on every exposed table.
- Keep correct answers and grading rules inaccessible to students until appropriate submission/marking flows.
- Enforce administrator permissions server-side; never trust editable user metadata for authorization.
- Students must only access their own private records.
- Do not reuse MySMath's Supabase project or student data.

## Development status

This repository has been initialised. Application source code and database migrations are to be added after the existing implementation is reviewed and the dedicated SYNAPTYL Supabase project is confirmed.

## Local development (once app scaffold is added)

```bash
npm install
npm run dev
```

## Deployment target

Cloudflare Pages, with build command `npm run build` and output directory `dist`.

## License

Not yet specified. All rights reserved by the repository owner unless a license is added.
