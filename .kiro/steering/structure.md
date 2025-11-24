# Project Structure

## Monorepo Organization

This is a Turborepo monorepo with pnpm workspaces. All packages are in the `packages/` directory.

```
bookmark-manager-platform/
├── packages/
│   ├── backend/          # Node.js/Express REST API server
│   ├── frontend/         # React web application
│   ├── extension/        # Browser extension (Manifest V3)
│   └── shared/           # Shared TypeScript types and utilities
├── docker-compose.yml    # Local development services
├── turbo.json           # Turborepo configuration
└── pnpm-workspace.yaml  # pnpm workspace configuration
```

## Package Structure

### packages/backend

- `src/` - TypeScript source files
- `dist/` - Compiled JavaScript output
- `.env.example` - Environment variable template
- Entry point: `src/index.ts`

### packages/frontend

- `src/` - React components and application code
- `dist/` - Vite build output
- `index.html` - HTML entry point
- `vite.config.ts` - Vite configuration
- `tailwind.config.js` - Tailwind CSS configuration

### packages/extension

- `src/` - Extension source files
  - `background.ts` - Service worker
  - `content.ts` - Content script
- `dist/` - Compiled extension files
- `manifest.json` - Extension manifest (V3)

### packages/shared

- `src/` - Shared TypeScript types and utilities
- `src/types/` - Type definitions
- `dist/` - Compiled output
- Consumed by backend, frontend, and extension

## Configuration Files

- `tsconfig.json` - Root TypeScript configuration (extended by packages)
- `.eslintrc.json` - ESLint configuration
- `.prettierrc` - Prettier configuration
- Each package has its own `tsconfig.json` extending the root

## Build Dependencies

Packages depend on `shared` package. Turborepo ensures `shared` is built before dependent packages via `"dependsOn": ["^build"]` in `turbo.json`.

## Testing

Each package has its own `vitest.config.ts` and tests colocated with source files (e.g., `src/types/index.test.ts`).
