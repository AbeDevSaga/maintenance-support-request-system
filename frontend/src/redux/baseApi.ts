// src/redux/baseApi.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL;

// --- Base query with JWT from localStorage ---
const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: "include",

  prepareHeaders: (headers) => {
    const token = localStorage.getItem("authToken"); // ✅ Read token

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");

    return headers;
  },
});

const baseQueryWithAuth = async (args: any, api: any, extraOptions: any) => {
  console.log('🔵 Making request to:', args.url);
  let result = await baseQuery(args, api, extraOptions);
  // SPECIAL CASE: If this is the password change endpoint and we get any 403

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

      localStorage.setItem("authToken", accessToken);
      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
      }

      // Retry original request with new token
      result = await baseQuery(args, api, extraOptions);
      console.log('🔄 Retry result:', {
        success: !result.error,
        status: result.error?.status
      });
      } 
    else {
      console.warn("❌ Refresh failed. Logging out...");
      
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      
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
