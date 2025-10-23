import { useAuth } from './AuthContext';

export default function LoginScreen({ onSkip }: { onSkip: () => void }) {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-6xl mb-4">🍞</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Baking Cost Calculator
          </h1>
          <p className="text-gray-600 mb-8">
            Calculate the all-in cost of your baked goods with precision
          </p>

          <div className="space-y-3">
            <button
              onClick={signInWithGoogle}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 transition shadow-md"
            >
              <span className="text-xl font-bold">Sign in with Google</span>
            </button>

            <button
              onClick={onSkip}
              className="w-full bg-white border-2 border-gray-300 text-gray-700 py-4 px-6 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition shadow-sm"
            >
              <span className="text-lg font-semibold">Continue without signing in</span>
            </button>
          </div>

          <div className="mt-6 space-y-2">
            <p className="text-sm text-gray-600 font-medium">
              ✓ Sign in to sync data across all your devices
            </p>
            <p className="text-sm text-gray-500">
              Without sign-in, data is saved locally on this device only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
