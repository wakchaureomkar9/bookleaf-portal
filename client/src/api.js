const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Clears session and redirects to /login on 401 responses.
 * Imported by AuthContext; set at startup.
 */
let _logoutCallback = null;
export function setLogoutCallback(fn) {
  _logoutCallback = fn;
}

/**
 * Core fetch helper.
 * - Attaches Bearer token from localStorage automatically.
 * - Returns json.data on success.
 * - Throws the server's error message string on non-2xx.
 * - On 401, calls the logout callback and redirects to /login.
 */
export async function api(path, options = {}) {
  const token = localStorage.getItem('bl_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Handle 401 — clear session and go to login
  if (res.status === 401) {
    localStorage.removeItem('bl_token');
    localStorage.removeItem('bl_user');
    if (_logoutCallback) _logoutCallback();
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  const json = await res.json().catch(() => ({ success: false, message: 'Invalid server response' }));

  if (!res.ok) {
    throw new Error(json.message || `Request failed (${res.status})`);
  }

  return json.data;
}

/** GET helper */
export const get = (path, options) => api(path, { method: 'GET', ...options });

/** POST helper */
export const post = (path, body, options) =>
  api(path, { method: 'POST', body: JSON.stringify(body), ...options });

/** PATCH helper */
export const patch = (path, body, options) =>
  api(path, { method: 'PATCH', body: JSON.stringify(body), ...options });

export default api;
