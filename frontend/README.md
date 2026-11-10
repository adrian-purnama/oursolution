# Frontend

TanStack Start + Tailwind app for the template. Setup, environment variables and
commands are in the [root README](../README.md).

- `src/routes/` holds thin file routes: a permission guard, a page shell, and one form component.
- `src/components/forms/` holds the interactive parts, grouped as `auth/`, `admin/` and `shared/`.
- `src/components/ui/` holds shadcn primitives only; add more with the shadcn CLI.
- Run `npm run generate-routes` after adding or renaming a route file.
