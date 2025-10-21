# Repository Guidelines

## Project Structure & Module Organization
- `src/` TypeScript React app (Vite).
  - `components/` UI + canvas components; `components/ui/*` are shadcn wrappers.
  - `pages/` route-level screens.
  - `hooks/` custom hooks (`use-*`).
  - `utils/` pure helpers (geometry, export, storage).
  - `interaction/` selection/edit controllers.
  - `store/` Zustand state.
  - `types/`, `constants/` shared types and values.
- `public/` static assets, PWA icons, `index.html`.
- `supabase/` local config and SQL migrations.
- Entry points: `src/main.tsx`, `src/App.tsx`.

## Build, Test, and Development Commands
- `npm run dev` — start Vite dev server (HMR).
- `npm run build` — production build to `dist/`.
- `npm run build:dev` — development-mode build.
- `npm run preview` — serve the built app locally.
- `npm run lint` — run ESLint (React hooks + TS rules).
- Supabase (optional): `supabase start`, `supabase db reset` to apply migrations.

## Coding Style & Naming Conventions
- Language: TypeScript + React 18; Tailwind for styling.
- Indentation: 2 spaces; avoid long files; prefer early returns.
- Files: Components `PascalCase.tsx` (e.g., `PoolEditorDialog.tsx`), hooks `useXxx.ts(x)`, utilities `camelCase.ts`.
- Exports: prefer named exports; group by feature folder.
- Linting: ESLint enforces React Hooks and Refresh rules. Autofix with `npm run lint -- --fix`.

## Testing Guidelines
- No test setup yet. When adding tests, use Vitest + @testing-library/react.
- Location: `src/__tests__/` or colocated next to source.
- Naming: `*.test.ts` / `*.test.tsx` (e.g., `PoolComponent.test.tsx`).
- Focus: store logic (Zustand), canvas interactions (Konva), and critical utils.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`.
- Example: `feat(canvas): add coping paver editor`.
- PRs include: clear description, steps to test, screenshots for UI, linked issues, and `build`/`lint` passing. Avoid unrelated diffs.

## Security & Configuration Tips
- Configure `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. All client env vars must be prefixed `VITE_`.
- Never commit secrets or service-role keys. Keep `.env` local.

## Agent-Specific Notes
- Keep changes scoped to the touched feature; follow folder conventions.
- Do not refactor unrelated modules. Prefer small, focused patches and descriptive PRs.
