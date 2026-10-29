# Flow Board

A small Kanban board: Backlog, In Progress, In Review and Done.

- Add, edit and delete cards (delete can be undone for 10 seconds)
- Move cards by dragging, with the per-card ← → buttons, or from the keyboard
- Search by title or assignee, filter by priority
- Overdue and due-soon highlighting
- Saved in your browser (`localStorage`) and synced across tabs
- Export and import the board as JSON

Shortcuts: `N` new card, `Enter` on a focused card to edit, `Esc` to close a dialog.

## Development

```
npm install
npm run dev     # http://localhost:5173
npm run build
npm run lint
```

## Deploying and SEO

Set `VITE_SITE_URL` when building so the build can emit the canonical URL, absolute
Open Graph image URL, `sitemap.xml` and the `Sitemap:` line in `robots.txt`:

```
VITE_SITE_URL=https://your-domain.example npm run build
```

Without it the build still outputs a valid `robots.txt`, and the URL-dependent tags are omitted.

## Testing

```
npm test          # run once (what CI runs)
npm run test:watch
```

Vitest + React Testing Library, in `src/**/*.test.ts(x)`:

- `components/Board.test.tsx`: create, edit, move, delete and undo, search, persistence, import, cross-tab sync
- `components/CardModal.test.tsx`, `Card.test.tsx`: accessibility regressions (focus, labels, validation)
- `storage.test.ts`: loading, validation and import hardening
- `audit-regressions.test.ts`: SEO, security, CSS and accessibility fixes from the audits

Tests never touch a real database: `@supabase/supabase-js` is aliased to a fake client
(`src/test/supabase-mock.ts`) and `fetch`, `XMLHttpRequest` and `WebSocket` throw during tests.

CI (`.github/workflows/ci.yml`) runs lint, tests and a build on every push to `main` and on every
pull request. Vercel runs `npm test` before every build (`vercel.json`), so a failing test blocks the deploy. In GitHub, mark the `test` job as a required status check to block merging on failures.
