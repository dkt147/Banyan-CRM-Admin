import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiRequest, API_BASE_URL } from "../api";

const ACCESS_TOKEN_KEY = "banyan_access_token";
const USER_KEY = "banyan_user";
const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const v = localStorage.getItem(USER_KEY);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() =>
    localStorage.getItem(ACCESS_TOKEN_KEY),
  );
  const [user, setUser] = useState(readStoredUser);
  const [isLoading, setIsLoading] = useState(true);

  const persistSession = useCallback((token, nextUser) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setAccessToken(token);
    setUser(nextUser);
  }, []);

  // Refresh the signed-in user after a profile change (e.g. saved views in preferences).
  const updateUser = useCallback((nextUser) => {
    if (!nextUser) return;
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAccessToken(null);
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const payload = await apiRequest("/auth/refresh", {
      method: "POST",
      body: {},
    });
    const token = payload?.data?.accessToken;
    const nextUser = payload?.data?.user;
    if (!token || !nextUser)
      throw new Error("Refresh response did not contain a valid session.");
    persistSession(token, nextUser);
    return token;
  }, [persistSession]);

  const request = useCallback(
    async (path, options = {}) => {
      const token = accessToken;
      try {
        return await apiRequest(path, { ...options, token });
      } catch (error) {
        if (
          error?.status === 401 &&
          path !== "/auth/refresh" &&
          path !== "/auth/login"
        ) {
          try {
            const nextToken = await refreshSession();
            return await apiRequest(path, { ...options, token: nextToken });
          } catch (refreshError) {
            // Only an invalid session signs the user out. A rate limit (429), a server
            // error or a network failure keeps the session so the user can retry.
            if ([400, 401, 403].includes(refreshError?.status)) clearSession();
            throw refreshError?.status === 429 ? refreshError : error;
          }
        }
        throw error;
      }
    },
    [accessToken, clearSession, refreshSession],
  );

  const loadCurrentUser = useCallback(
    async (token) => {
      try {
        const payload = await apiRequest("/auth/me", { token });
        const currentUser = payload?.data?.user;
        if (currentUser) {
          localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
          setUser(currentUser);
        }
        return true;
      } catch (error) {
        if (error?.status === 401) {
          try {
            await refreshSession();
            return true;
          } catch (refreshError) {
            if (![400, 401, 403].includes(refreshError?.status)) return true;
          }
        } else if (error?.status !== 403) {
          // Rate limit, server or network error: keep the stored session.
          return true;
        }
        clearSession();
        return false;
      }
    },
    [clearSession, refreshSession],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (token) await loadCurrentUser(token);
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCurrentUser]);

  const login = useCallback(
    async (email, password) => {
      const payload = await apiRequest("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      const token = payload?.data?.accessToken;
      const nextUser = payload?.data?.user;
      if (!token || !nextUser)
        throw new Error("Login response did not contain a valid session.");
      persistSession(token, nextUser);
      return nextUser;
    },
    [persistSession],
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST", body: {} });
    } catch {}
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      accessToken,
      user,
      isLoading,
      isAuthenticated: Boolean(accessToken && user),
      login,
      logout,
      request,
      refreshSession,
      updateUser,
      apiBaseUrl: API_BASE_URL,
    }),
    [accessToken, user, isLoading, login, logout, request, refreshSession, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
