import { useNavigate } from "react-router-dom";
import { ShieldExclamationIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../contexts/AuthContext";

export default function Unauthorized() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <ShieldExclamationIcon className="h-20 w-20 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-6">
          You don't have permission to access this page.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full bg-[#0C4A6E] text-white px-6 py-2 rounded-lg hover:bg-[#083b56] transition-colors"
          >
            Go to Dashboard
          </button>
          <button
            onClick={logout}
            className="w-full border border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
