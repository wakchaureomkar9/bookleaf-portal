import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { get, setLogoutCallback } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('bl_token');
    localStorage.removeItem('bl_user');
    setUser(null);
    setToken(null);
  }, []);

  // Register 401 logout callback with api.js
  useEffect(() => {
    setLogoutCallback(logout);
  }, [logout]);

  // On app load: restore from localStorage and validate with GET /auth/me
  useEffect(() => {
    const stored = localStorage.getItem('bl_token');
    if (!stored) {
      setLoading(false);
      return;
    }
    setToken(stored);
    get('/auth/me')
      .then((data) => {
        setUser(data.user);
      })
      .catch(() => {
        // Token invalid or expired — clear storage
        localStorage.removeItem('bl_token');
        localStorage.removeItem('bl_user');
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((newToken, newUser) => {
    localStorage.setItem('bl_token', newToken);
    localStorage.setItem('bl_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
