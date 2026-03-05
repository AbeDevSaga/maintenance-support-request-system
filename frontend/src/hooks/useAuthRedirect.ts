// hooks/useAuthRedirect.ts
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const useAuthRedirect = (error: any) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (error) {
      // Check if API returned JSON with redirectTo
      const redirectTo = error?.data?.redirectTo;
      if (redirectTo) {
        navigate(redirectTo);
      } else if (error?.status === 403) {
        // fallback
        navigate("/unauthorized");
      }
    }
  }, [error, navigate]);
};