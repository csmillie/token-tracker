# Contributing to TokenTracker

Thanks for your interest in contributing. This guide covers the workflow and conventions.

## Getting Started

1. Fork the repo on GitHub
2. Clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/token-tracker.git
cd token-tracker
```

3. Set up the project:

```bash
cp .env.example .env
# Edit .env with your MySQL credentials
npm install
npm run migrate
```

4. Start the dev server:

```bash
npm run dev
```

5. Verify at [http://localhost:3046](http://localhost:3046)

## Development Workflow

1. Create a branch from `main`:

```bash
git checkout -b your-feature-name
```

2. Make your changes
3. Verify the build passes:

```bash
npx next build
```

4. Commit with a clear message describing what and why
5. Push to your fork and open a PR against `main`

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include a description of what changed and why
- Make sure `npx next build` passes before opening
- Link any related issues

## Code Conventions

### General

- TypeScript for all Next.js code
- PHP 8.1+ for ingest endpoints
- SQL in queries should use MySQL syntax (not Postgres)

### TypeScript / Next.js

- Use Next.js App Router conventions (server components by default, `"use client"` only when needed)
- Database queries go in `src/lib/queries.ts`
- Types go in `src/lib/types.ts`
- Use `mysql2/promise` with the shared pool from `src/lib/db.ts`
- Destructure query results as `const [rows] = await pool.query<RowDataPacket[]>(...)`
- Use `?` placeholders for parameterized queries (not template literals)

### PHP

- Ingest endpoints live in `ingest/` and are routed through `index.php`
- Database access via `ingest/Db.php` singleton
- Read credentials from `.env` via the `Db::loadEnv()` helper

### CSS / Styling

- Tailwind CSS v4
- Use the design token classes (`text-text-primary`, `bg-surface-raised`, `border-border`, etc.) rather than raw color values

### Database

- Migrations go in `migrations/` as numbered `.sql` files (e.g. `003_your_change.sql`)
- Use `CREATE TABLE IF NOT EXISTS` and `ON DUPLICATE KEY UPDATE` for idempotent operations
- Run `npm run migrate` to apply

## Project Structure

```
src/
  app/              # Next.js App Router pages and API routes
  components/       # Shared React components
  lib/              # Database, queries, types, OTLP parsing
ingest/             # PHP ingest endpoint classes
hooks/              # Claude Code hook scripts
migrations/         # MySQL migration files
scripts/            # CLI utilities (migrate, sync-github)
```

## Reporting Issues

Use [GitHub Issues](https://github.com/csmillie/token-tracker/issues). Include:

- What you expected vs what happened
- Steps to reproduce
- Browser console errors or server logs if relevant
