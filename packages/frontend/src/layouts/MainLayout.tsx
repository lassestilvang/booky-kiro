import { useAuthStore } from '../stores/authStore';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { KeyboardShortcutsHelp } from '../components/KeyboardShortcutsHelp';
import { ThemeToggle } from '../components/ThemeToggle';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user, logout } = useAuthStore();
  useGlobalKeyboardShortcuts();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Skip to main content link for screen readers */}
      <a
        href="#main-content"
        className="skip-to-main focus:not-sr-only"
        tabIndex={0}
      >
        Skip to main content
      </a>

      <nav
        className="bg-white dark:bg-gray-800 shadow-sm"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1
                className="text-xl font-bold text-gray-900 dark:text-white"
                id="site-title"
              >
                Bookmark Manager
              </h1>
            </div>
            <div
              className="flex items-center space-x-4"
              role="group"
              aria-label="User menu"
            >
              <ThemeToggle />
              <span
                className="text-sm text-gray-700 dark:text-gray-300"
                aria-label="Current user"
              >
                {user?.name || user?.email}
              </span>
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                role="status"
                aria-label={`Current plan: ${user?.plan === 'pro' ? 'Pro' : 'Free'}`}
              >
                {user?.plan === 'pro' ? 'Pro' : 'Free'}
              </span>
              <button
                onClick={logout}
                className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                aria-label="Logout from your account"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main
        id="main-content"
        className="flex-1 overflow-hidden"
        role="main"
        aria-labelledby="site-title"
        tabIndex={-1}
      >
        {children}
      </main>
      <KeyboardShortcutsHelp />
    </div>
  );
}
