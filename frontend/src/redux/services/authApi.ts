import { baseApi } from "../baseApi";
import { setAuthToken, setAuthUser, clearAuthData } from "../baseApi"; // Import memory functions
import type { AuthResponse, LoginCredentials } from "../../types/auth";

type UpdatePasswordPayload = {
  new_password: string;
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
        // Store token and user in memory instead of localStorage
        if (response.token) {
          setAuthToken(response.token);
        }
        if (response.user) {
          setAuthUser(response.user);
        }

        return {
          token: response.token,
          user: response.user,
          message: response.message,
        };
      },
      invalidatesTags: ["User"],
    }),

    logout: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
        body: {},
      }),
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          // Clear token and user from memory
          clearAuthData();
        }
      },
      invalidatesTags: ["User"],
    }),


    getCurrentUser: builder.query<AuthResponse["user"], void>({
      query: () => ({
        url: "/auth/me",
        method: "GET",
      }),
      providesTags: ["User"],
    }),

    /* Update Password */
    updatePassword: builder.mutation<
      { success: boolean; message: string },
      UpdatePasswordPayload
    >({
      query: (payload) => ({
        url: "/auth/update-password",
        method: "PUT",
        body: payload,
      }),
      invalidatesTags: ["User"],
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useGetCurrentUserQuery, 
  useUpdatePasswordMutation,
} = authApi;