Supabase CLI

- The Supabase CLI is intentionally installed via npm as a devDependency.
- Use `npx supabase` or `npm run supabase` to run the CLI inside the container.
- The devcontainer feature for Supabase CLI is not available publicly, so this repo installs it via `package.json` to keep the container reproducible.

Devcontainer notes

- `postCreateCommand` runs `npm install` to install project dependencies after the container is created.
- Avoid installing project-specific dependencies globally in the dev container; prefer local devDependencies and `npx` to run CLIs.
