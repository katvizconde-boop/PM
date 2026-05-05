import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, clearToken } from '../api/client.js';

const AuthCtx = createContext(null);

// Decode the JWT payload without a library — we only need claims for UI gating.
function decode(token) {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const t = getToken();
    return t ? decode(t) : null;
  });

  // Auto-logout on token expiry.
  useEffect(() => {
    if (!user?.exp) return;
    const ms = user.exp * 1000 - Date.now();
    if (ms <= 0) { clearToken(); setUser(null); return; }
    const id = setTimeout(() => { clearToken(); setUser(null); }, ms);
    return () => clearTimeout(id);
  }, [user]);

  const login = async (email, password) => {
    const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(token); setUser(decode(token)); return user;
  };
  const register = async (payload) => {
    const { token, user } = await api('/auth/register', { method: 'POST', body: payload });
    setToken(token); setUser(decode(token)); return user;
  };
  const logout = () => { clearToken(); setUser(null); };

  return (
    <AuthCtx.Provider value={{ user, login, register, logout }}>{children}</AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
