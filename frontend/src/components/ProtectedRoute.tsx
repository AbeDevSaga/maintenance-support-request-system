import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: {
    resource: string;
    action: string | string[];
    match?: "any" | "all";
  };
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  fallbackPath = "/unauthorized",
}) => {
  const {
    isAuthenticated,
    isLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    user,
  } = useAuth();
  const location = useLocation();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0C4A6E]"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Wait for user data to be available
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0C4A6E]"></div>
      </div>
    );
  }

  // Check permissions if required
  if (requiredPermission) {
    const { resource, action, match = "any" } = requiredPermission;
    const actions = Array.isArray(action) ? action : [action];

    let hasRequiredPermission = false;

    if (match === "any") {
      hasRequiredPermission = hasAnyPermission(resource, actions);
    } else {
      hasRequiredPermission = hasAllPermissions(resource, actions);
    }

    if (!hasRequiredPermission) {
      return <Navigate to={fallbackPath} state={{ from: location }} replace />;
    }
  }

  return <>{children}</>;
};
