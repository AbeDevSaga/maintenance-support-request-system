import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL;

// Helper to safely check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Track refresh state to prevent multiple refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<any> | null = null;

// Queue of failed requests to retry after token refresh
let failedQueue: Array<{
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(null);
    }
  });
  failedQueue = [];
};

// --- Base query with credentials only (no manual token management) ---
const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: "include", // This sends httpOnly cookies automatically
  
  prepareHeaders: (headers) => {
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
    return headers;
  },
});

// Function to handle logout
const handleLogout = () => {
  // console.log("🚪 Logging out...");
  
  if (isBrowser) {
    sessionStorage.removeItem("redirectAfterPasswordChange");
    window.location.href = '/login';
  }
};

// Function to refresh token
const refreshAccessToken = async (api: any, extraOptions: any) => {
  if (isRefreshing) {
    // console.log('⏳ Refresh already in progress, waiting...');
    
    // Return a promise that will be resolved when the current refresh completes
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;
  console.log('🔄 Attempting token refresh...');

  refreshPromise = (async () => {
    try {
      const refreshResult = await baseQuery(
        {
          url: "/refresh-token",
          method: "POST",
        },
        api,
        extraOptions
      );

      // console.log('🔄 Refresh result:', {
      //   success: !refreshResult.error,
      //   status: refreshResult.error?.status,
      //   data: refreshResult.data,
      //   error: refreshResult.error?.data
      // });

      if (!refreshResult.error) {
        // console.log('✅ Refresh successful');
        processQueue(null);
        return refreshResult.data;
      }
      
      // console.warn("❌ Refresh failed");
      processQueue(new Error('Refresh failed'));
      return null;
    } catch (error) {
      // console.error('💥 Refresh error:', error);
      processQueue(error);
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

const baseQueryWithAuth = async (args: any, api: any, extraOptions: any) => {
  // console.log('🔵 Making request to:', args.url);
  
  let result = await baseQuery(args, api, extraOptions);

  // Log the result for debugging
  if (result.error) {
    // console.log('🔴 Request failed:', {
    //   url: args.url,
    //   status: result.error.status,
    //   data: result.error.data,
    //   error: result.error.error
    // });
  }

  // Handle 401 responses (including token expiration)
  if (result.error?.status === 401) {
    // console.log("🔍 401 Error details:", {
    //   status: result.error.status,
    //   data: result.error.data,
    //   dataType: typeof result.error.data,
    //   stringified: JSON.stringify(result.error.data)
    // });
    
    // Check if this is a token expiration error
    const isTokenExpired = 
      result.error.data && 
      typeof result.error.data === "object" && 
      "code" in result.error.data && 
      (result.error.data as any).code === "TOKEN_EXPIRED";
    
    if (isTokenExpired) {
      console.log("✅ TOKEN_EXPIRED detected, attempting refresh...");
      
      // Store original request
      const originalArgs = args;

      try {
        // Attempt to refresh token
        const refreshResult = await refreshAccessToken(api, extraOptions);
        
        // If refresh successful, retry original request
        if (refreshResult) {
          // console.log('🔄 Refresh successful, retrying original request...');
          result = await baseQuery(originalArgs, api, extraOptions);
          return result;
        } else {
          console.warn("❌ Refresh failed. Logging out...");
          handleLogout();
          return result;
        }
      } catch (refreshError) {
        console.warn("❌ Refresh error:", refreshError);
        handleLogout();
        return result;
      }
    } else {
      console.log("❌ Other 401 error (not token expiration), logging out");
      handleLogout();
      return result;
    }
  }

  // Handle password change required (403 with specific code)
  if (
    result.error?.status === 403 &&
    result.error.data &&
    typeof result.error.data === "object" &&
    "code" in result.error.data
  ) {
    const errorCode = (result.error.data as any).code;
    
    if (errorCode === "PASSWORD_CHANGE_REQUIRED") {
      console.log("🔐 Password change required, redirecting...");
      if (isBrowser) {
        sessionStorage.setItem("redirectAfterPasswordChange", window.location.pathname);
        window.location.href = "/change_password";
      }
      return result;
    }
    
    if (errorCode === "PASSWORD_EXPIRED") {
      // console.log("🔐 Password expired, redirecting to change password...");
      toast.error("Your password has expired. Please change it.");
      if (isBrowser) {
        window.location.href = "/change-password";
      }
      return result;
    }
  }

  // Handle rate limiting
  if (result.error?.status === 429) {
    // console.log("⏱️ Rate limited");
    toast.error("Too many requests. Please try again later.");
    return result;
  }

  // Handle other 403 errors (permission denied)
  if (result.error?.status === 403) {
    console.log("🚫 Forbidden access");
    toast.error("You don't have permission to perform this action");
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

// Optional: Add a hook to check auth status on app start
export const initializeAuth = async () => {
  if (!isBrowser) return null;
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      return userData.user;
    }
    return null;
  } catch (error) {
    console.error('Auth initialization error:', error);
    return null;
  }
};