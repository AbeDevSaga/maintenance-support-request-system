import { baseApi } from "../baseApi";
// Remove token-related imports - we don't need them anymore
// import { setAuthToken, setAuthUser, clearAuthData } from "../baseApi";
import type { AuthResponse, LoginCredentials } from "../../types/auth";

type UpdatePasswordPayload = {
  new_password: string;
  // Add current_password if your backend requires it
  current_password?: string;
};

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, LoginCredentials>({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
      transformResponse: (response: any) => {
        // No need to store token in memory - cookies handle it!
        // The backend sets httpOnly cookies automatically
        
        // Just return the user data and message
        return {
          // token is removed from response since it's in cookie
          user: response.user,
          message: response.message,
          requiresPasswordChange: response.requiresPasswordChange,
        };
      },
      // Invalidate and refetch user data after login
      invalidatesTags: ["User"],
      // Optional: onQueryStarted to handle post-login logic
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          await queryFulfilled;
          console.log('✅ Login successful, cookies set by backend');
        } catch (error) {
          console.error('❌ Login failed:', error);
        }
      },
    }),

    logout: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
        // No need to send body
      }),
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          await queryFulfilled;
          console.log('✅ Logout successful, cookies cleared');
        } catch (error) {
          console.error('❌ Logout error:', error);
        } finally {
          // Clear any cached user data from RTK Query
          // Cookies are cleared by the backend
        }
      },
      // Clear all cached data on logout
      invalidatesTags: ["User", "Roles", "Permission", "Project", "Institute", "Hierarchy", "Dashboard"],
    }),

    getCurrentUser: builder.query<AuthResponse["user"], void>({
      query: () => ({
        url: "/auth/me", // Make sure this matches your backend route
        method: "GET",
      }),
      providesTags: ["User"],
      // Transform response if needed
      transformResponse: (response: any) => {
        // If your API returns { user: {...} } or just the user object
        return response.user || response;
      },
    }),

    refreshToken: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: "/auth/refresh-token",
        method: "POST",
      }),
      // This doesn't invalidate any tags since it just refreshes the token
    }),

    updatePassword: builder.mutation<
      { success: boolean; message: string },
      UpdatePasswordPayload
    >({
      query: (payload) => ({
        url: "/auth/update-password",
        method: "PUT", // or POST based on your backend
        body: payload,
      }),
      invalidatesTags: ["User"],
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          await queryFulfilled;
          console.log('✅ Password updated successfully');
        } catch (error) {
          console.error('❌ Password update failed:', error);
        }
      },
    }),


  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useGetCurrentUserQuery,
  useRefreshTokenMutation,
  useUpdatePasswordMutation,

} = authApi;