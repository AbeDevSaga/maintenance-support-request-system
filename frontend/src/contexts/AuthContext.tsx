import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { useLoginMutation, useLogoutMutation } from "../redux/services/authApi";
import {
  AuthContextType,
  AuthResponse,
  LoginCredentials,
  User,
} from "../types/auth";

// Memory storage for user
import { setAuthUser, clearAuthData } from "../redux/baseApi";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [loginMutation] = useLoginMutation();
  const [logoutMutation] = useLogoutMutation();

  // Restore session from memory (user object only)
  useEffect(() => {
    const restoreSession = async () => {
      try {
        setLoading(false);
        console.log("Auth session will be established via API calls");
      } catch (err) {
        console.error("Failed to restore session:", err);
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // LOGIN
  const login = async (
    credentials: LoginCredentials,
  ): Promise<AuthResponse> => {
    try {
      setError(null);
      setLoading(true);

      const response = await loginMutation(credentials).unwrap();
      const { user: userData } = response;

      setUser(userData);

      // Store user in memory
      setAuthUser(userData);

      return response;
    } catch (err: any) {
      const message = err.data?.message || "Login failed";
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  // LOGOUT
  const logout = async (): Promise<void> => {
    try {
      await logoutMutation().unwrap();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);

      // Clear memory storage
      clearAuthData();
    }
  };

  // Update user profile in memory
  const updateProfile = async (profileData: Partial<User>): Promise<User> => {
    const updated = { ...user, ...profileData } as User;
    setUser(updated);
    setAuthUser(updated);
    return updated;
  };

  // Permissions
  const userPermissionsSet = new Set(
    user?.permissions?.map((p) => `${p.resource}:${p.action}`.toUpperCase()) ||
      [],
  );

  const hasPermission = (permission: string): boolean =>
    userPermissionsSet.has(permission.toUpperCase());
  const hasAnyPermission = (permissions: string[]): boolean =>
    permissions.some((p) => userPermissionsSet.has(p.toUpperCase()));
  const hasAllPermissions = (permissions: string[]): boolean =>
    permissions.every((p) => userPermissionsSet.has(p.toUpperCase()));

  const value: AuthContextType = {
    user,
    token: null, // token no longer used
    loading,
    error,
    login,
    register: async () => {
      throw new Error("Not implemented");
    },
    logout,
    updateProfile,
    changePassword: async () => {
      throw new Error("Not implemented");
    },
    clearError: () => setError(null),
    isAuthenticated: !!user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole: () => false,
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#269A99] border-r-transparent"></div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
