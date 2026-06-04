import { getLoginUrl } from "@/const";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};

  const demoUser =
    typeof window !== "undefined"
      ? localStorage.getItem("anma_demo_user")
      : null;

  const user = demoUser
    ? JSON.parse(demoUser)
    : null;

  const logout = useCallback(async () => {
    localStorage.removeItem("anma_demo_user");
    window.location.href = redirectPath;
  }, [redirectPath]);

  const state = useMemo(() => {
    return {
      user,
      loading: false,
      error: null,
      isAuthenticated: Boolean(user),
    };
  }, [user]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [redirectOnUnauthenticated, redirectPath, state.user]);

  return {
    ...state,
    refresh: async () => null,
    logout,
  };
}