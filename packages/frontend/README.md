# Bookmark Manager Frontend

React-based web application for the Bookmark Manager Platform.

## Features Implemented

### Task 30.1: React App Setup

- ✅ React 18 with TypeScript
- ✅ Vite build configuration
- ✅ Tailwind CSS styling
- ✅ Zustand state management (auth and UI stores)
- ✅ React Query for API calls
- ✅ React Router for navigation

### Task 30.2: Authentication UI

- ✅ Login page with form validation
- ✅ Register page with form validation
- ✅ JWT token storage in localStorage
- ✅ Protected route wrapper
- ✅ Automatic token refresh on 401 responses
- ✅ Auth state management with Zustand

## Project Structure

```
src/
├── components/
│   └── ProtectedRoute.tsx      # Route protection wrapper
├── layouts/
│   ├── AuthLayout.tsx          # Layout for login/register pages
│   └── MainLayout.tsx          # Layout for authenticated pages
├── lib/
│   ├── api.ts                  # Axios client with interceptors
│   └── queryClient.ts          # React Query configuration
├── pages/
│   ├── DashboardPage.tsx       # Main dashboard (placeholder)
│   ├── LoginPage.tsx           # Login form
│   └── RegisterPage.tsx        # Registration form
├── routes/
│   └── index.tsx               # Route configuration
├── stores/
│   ├── authStore.ts            # Authentication state
│   └── uiStore.ts              # UI preferences (view mode, theme)
├── index.css                   # Tailwind imports
├── main.tsx                    # App entry point
└── vite-env.d.ts              # Vite environment types
```

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test:run

# Lint code
npm run lint
```

## Environment Variables

Create a `.env` file based on `.env.example`:

```
VITE_API_BASE_URL=/api
```

## API Integration

The app uses Axios with automatic:

- JWT token injection in request headers
- Token refresh on 401 responses
- Redirect to login on authentication failure

## State Management

### Auth Store (Zustand)

- User profile data
- Authentication status
- Login/logout actions
- Persisted to localStorage

### UI Store (Zustand)

- View mode preference (grid/headlines/masonry/list)
- Theme preference (light/dark)
- Sidebar state
- Persisted to localStorage

## Next Steps

The following pages and features are ready to be implemented:

- Bookmark management UI (Task 31)
- Collection management UI (Task 32)
- Search interface (Task 34)
- Pro features UI (Task 36)
- Import/export UI (Task 37)
