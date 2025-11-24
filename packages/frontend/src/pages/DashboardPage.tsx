import { useAuthStore } from '../stores/authStore';

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Dashboard</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-700">
          Welcome back, <span className="font-semibold">{user?.name}</span>!
        </p>
        <p className="text-gray-600 mt-2">
          Your bookmarks will appear here once you start adding them.
        </p>
      </div>
    </div>
  );
}
