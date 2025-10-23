import { useAuth } from './AuthContext';

export default function LoginScreen() {
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
            Sign in to sync your recipes, ingredients, and settings across all your devices
          </p>

          <button
            onClick={signInWithGoogle}
            className="w-full bg-white border-2 border-gray-300 text-gray-700 py-4 px-6 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition shadow-sm"
          >
            <span className="text-xl font-bold">Sign in with Google</span>
          </button>

          <p className="text-xs text-gray-500 mt-6">
            Your data is securely stored and synced with Firebase
          </p>
        </div>
      </div>
    </div>
  );
}
