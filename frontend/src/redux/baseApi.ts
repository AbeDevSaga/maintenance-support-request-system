import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL;

// In-memory token storage (not accessible to JavaScript via localStorage)
let inMemoryToken: string | null = null;
let inMemoryUser: any | null = null;

// Helper to safely check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// --- Base query with JWT from memory ---
const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: "include", // This sends httpOnly cookies automatically

  prepareHeaders: (headers) => {
    // Get token from memory instead of localStorage
    const token = getAuthToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");

    return headers;
  },
});

// Function to set token in memory (called from AuthContext)
export const setAuthToken = (token: string | null) => {
  inMemoryToken = token;
};

// Function to get current token (for debugging)
export const getAuthToken = () => inMemoryToken;

// Function to set user in memory
export const setAuthUser = (user: any | null) => {
  inMemoryUser = user;
};

// Function to get current user
export const getAuthUser = () => inMemoryUser;

// Function to clear auth data (logout)
export const clearAuthData = () => {
  inMemoryToken = null;
  inMemoryUser = null;
  
  // Also clear any sessionStorage used for redirects
  if (isBrowser) {
    sessionStorage.removeItem("redirectAfterPasswordChange");
  }
};

// Initialize from sessionStorage only if needed (for page refreshes)
if (isBrowser) {
  // Don't use localStorage - check if we have a valid session via cookie
  // The token will be obtained from refresh endpoint on first API call
  // We don't restore from sessionStorage to maintain security
  inMemoryToken = null;
  inMemoryUser = null;
}

const baseQueryWithAuth = async (args: any, api: any, extraOptions: any) => {
  console.log('🔵 Making request to:', args.url);
  let result = await baseQuery(args, api, extraOptions);

  // Handle password change required (403 with specific code)
  if (
    result.error?.status === 403 &&
    typeof result.error.data === "object" &&
    result.error.data !== null &&
    "code" in result.error.data &&
    (result.error.data as any).code === "PASSWORD_CHANGE_REQUIRED"
  ) {
    console.log("🔐 Password change required, redirecting...");

    sessionStorage.setItem("redirectAfterPasswordChange", window.location.pathname);
    window.location.href = "/change_password";
    return result;
  }

  // Handle password expired
  if (
    result.error?.status === 403 &&
    typeof result.error.data === "object" &&
    result.error.data !== null &&
    "code" in result.error.data &&
    (result.error.data as any).code === "PASSWORD_EXPIRED"
  ) {
    console.log("🔐 Password expired, redirecting to change password...");
    toast.error("Your password has expired. Please change it.");
    window.location.href = "/change-password";
    return result;
  }

  // Log the result for debugging
  if (result.error) {
    console.log('🔴 Request failed:', {
      url: args.url,
      status: result.error.status,
      data: result.error.data,
      error: result.error.error
    });
  }

  // If access token expired
  if (result.error && (result.error.status === 401 || result.error.status === 403)) {
    console.warn("⚠️ Token expired/invalid. Attempting refresh...");

    // Store current args to retry after refresh
    const originalArgs = args;

    // Call refresh endpoint
    console.log('🔄 Calling refresh endpoint...');
    const refreshResult = await baseQuery(
      {
        url: "/refresh-token",
        method: "POST",
      },
      api,
      extraOptions
    );

    // Log refresh result
    console.log('🔄 Refresh result:', {
      success: !refreshResult.error,
      status: refreshResult.error?.status,
      data: refreshResult.data,
      error: refreshResult.error?.data
    });

    if (refreshResult.data) {
      console.log('✅ Refresh successful, retrying original request');
      const { accessToken, user } = refreshResult.data as any;

      // Store in memory instead of localStorage
      inMemoryToken = accessToken;
      if (user) {
        inMemoryUser = user;
      }

      // Update the headers for the retry
      const updateHeaders = (headers: Headers) => {
        headers.set("Authorization", `Bearer ${accessToken}`);
        return headers;
      };

      // Retry original request with new token
      result = await baseQuery(
        {
          ...originalArgs,
          headers: updateHeaders,
        },
        api,
        extraOptions
      );
      
      console.log('🔄 Retry result:', {
        success: !result.error,
        status: result.error?.status
      });
    } else {
      console.warn("❌ Refresh failed. Logging out...");
      
      // Clear memory
      inMemoryToken = null;
      inMemoryUser = null;
      
      window.location.href = '/login';
    }
  }

  return result;
};


export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    "User",
    "Roles",
    "Permission",
    "Project",
    "Institute",
    "Hierarchy",
    "HierarchyNode",
    "InternalNode",
    "Issue",
    "IssueEscalation",
    "IssueResolution",
    "IssueReRaise",
    "IssueReject",
    "IssuePriority",
    "IssueAssignment",
    "IssueCategory",
    "Assignment",
    "Escalation",
    "Attachment",
    "IssueAttachment",
    "ProjectMetrics",
    "MetricUsers",
    "Notification",
    "Dashboard",
  ],
  endpoints: () => ({}),
});