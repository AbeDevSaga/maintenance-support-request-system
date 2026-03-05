import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useLoginMutation, useLogoutMutation } from "../redux/services/authApi";
import {
  AuthContextType,
  AuthResponse,
  LoginCredentials,
  User,
} from "../types/auth";

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
  const [initialized, setInitialized] = useState<boolean>(false);

  const initRef = useRef(false);

  const [loginMutation] = useLoginMutation();
  const [logoutMutation] = useLogoutMutation();

  // Function to check session
  const checkSession = async (): Promise<{
    success: boolean;
    requiresPasswordChange?: boolean;
  }> => {
    try {
      console.log("🔍 Checking session...");

      const url = `${import.meta.env.VITE_API_URL}/auth/me`;

      let response = await fetch(url, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      console.log("📡 Session check response status:", response.status);

      // 🔥 If access token expired → try refresh
      if (response.status === 401) {
        console.log("🔁 Access token expired. Trying refresh...");

        const refreshResponse = await fetch(
          `${import.meta.env.VITE_API_URL}/refresh-token`,
          {
            method: "POST",
            credentials: "include",
          },
        );

        if (!refreshResponse.ok) {
          console.log("❌ Refresh failed");
          setUser(null);
          return { success: false };
        }

        console.log("✅ Refresh successful. Retrying session...");

        // Retry /me after successful refresh
        response = await fetch(url, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
      }

      // Handle password change case
      if (response.status === 403) {
        const errorData = await response.json();

        if (errorData.code === "PASSWORD_CHANGE_REQUIRED") {
          return { success: true, requiresPasswordChange: true };
        }

        setUser(null);
        return { success: false };
      }

      if (response.ok) {
        const data = await response.json();
        const userData = data.user || data;
        setUser(userData);
        return { success: true, requiresPasswordChange: false };
      }

      setUser(null);
      return { success: false };
    } catch (err) {
      console.error("💥 Session check error:", err);
      setUser(null);
      return { success: false };
    }
  };

  // Initial session check
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const initializeAuth = async () => {
      setLoading(true);
      await checkSession();
      setLoading(false);
      setInitialized(true);
    };

    initializeAuth();
  }, []);

  // LOGIN
  const login = useCallback(
    async (credentials: LoginCredentials) => {
      try {
        setLoading(true);
        setError(null);

        // Clear any stale user data before login
        setUser(null);

        const response = await loginMutation(credentials).unwrap();

        if (response.user) {
          // Force a fresh session check to ensure we have the latest data
          const sessionStatus = await checkSession();

          if (sessionStatus.success) {
            return {
              ...response,
              requiresPasswordChange: sessionStatus.requiresPasswordChange,
            };
          }
        }

        return response;
      } catch (err: any) {
        const message = err.data?.message || "Login failed";
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [loginMutation],
  );

  // LOGOUT
  const logout = useCallback(async (): Promise<void> => {
    try {
      console.log("🚪 Logging out...");
      await logoutMutation().unwrap();

      // Clear ALL state immediately
      setUser(null);
      setError(null);
      setInitialized(false);
      initRef.current = false;

      // Force a hard reload to clear all React state and caches
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout error:", err);
      // Still clear state and redirect even if API call fails
      setUser(null);
      window.location.href = "/login";
    }
  }, [logoutMutation]);

  // Update profile
  const updateProfile = useCallback(
    async (profileData: Partial<User>): Promise<User> => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/users/profile`,
          {
            method: "PUT",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(profileData),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to update profile");
        }

        const data = await response.json();
        const updatedUser = data.user || data;
        setUser(updatedUser);
        return updatedUser;
      } catch (err: any) {
        throw err;
      }
    },
    [],
  );

  // Change password
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<void> => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/auth/update-password`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              current_password: currentPassword,
              new_password: newPassword,
            }),
          },
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Password change failed");
        }
      } catch (err: any) {
        throw err;
      }
    },
    [],
  );

  // Memoize permissions set - handle both object and string formats
  const userPermissionsSet = useMemo(() => {
    if (!user?.permissions) return new Set();

    const perms = user.permissions
      .map((p) => {
        if (typeof p === "string") {
          return p.toUpperCase();
        }
        if (p.resource && p.action) {
          return `${p.resource}:${p.action}`.toUpperCase();
        }
        return "";
      })
      .filter(Boolean);

    return new Set(perms);
  }, [user?.permissions]);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      return userPermissionsSet.has(permission.toUpperCase());
    },
    [user, userPermissionsSet],
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      if (!user) return false;
      return permissions.some((p) => userPermissionsSet.has(p.toUpperCase()));
    },
    [user, userPermissionsSet],
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]): boolean => {
      if (!user) return false;
      return permissions.every((p) => userPermissionsSet.has(p.toUpperCase()));
    },
    [user, userPermissionsSet],
  );

  const hasRole = useCallback(
    (roleName: string): boolean => {
      if (!user?.roles) return false;
      return user.roles.some(
        (role) => role.name?.toUpperCase() === roleName.toUpperCase(),
      );
    },
    [user?.roles],
  );

  const hasAnyRole = useCallback(
    (roleNames: string[]): boolean => {
      if (!user?.roles) return false;
      return roleNames.some((roleName) =>
        user.roles?.some(
          (role) => role.name?.toUpperCase() === roleName.toUpperCase(),
        ),
      );
    },
    [user?.roles],
  );

  const clearError = useCallback(() => setError(null), []);

  // Memoize context value
  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token: null,
      loading,
      initialized,
      error,
      login,
      register: async () => {
        throw new Error("Not implemented");
      },
      logout,
      updateProfile,
      changePassword,
      clearError,
      isAuthenticated: !!user,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      hasRole,
      hasAnyRole,
    }),
    [
      user,
      loading,
      initialized,
      error,
      login,
      logout,
      updateProfile,
      changePassword,
      clearError,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      hasRole,
      hasAnyRole,
    ],
  );

  if (!initialized) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#269A99] border-r-transparent"></div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
