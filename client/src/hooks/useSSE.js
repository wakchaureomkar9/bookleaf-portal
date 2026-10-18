import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Opens a single SSE connection to /tickets/stream?token=<jwt>.
 * Calls onEvent(type, data) for every named event received.
 * Reconnects once on unexpected close (not on deliberate cleanup).
 */
export function useSSE(onEvent) {
  const { token } = useAuth();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!token) return;

    let es;
    let unmounted = false;

    function connect() {
      if (unmounted) return;
      const url = `${API_BASE}/tickets/stream?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);

      es.addEventListener('connected', () => {
        // Connection confirmed live
      });

      es.addEventListener('ticket:response', (e) => {
        try {
          const data = JSON.parse(e.data);
          onEventRef.current('ticket:response', data);
        } catch {/* ignore malformed events */}
      });

      es.addEventListener('ticket:updated', (e) => {
        try {
          const data = JSON.parse(e.data);
          onEventRef.current('ticket:updated', data);
        } catch {/* ignore malformed events */}
      });

      es.onerror = () => {
        es.close();
        if (!unmounted) {
          // Reconnect after a short delay
          setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (es) es.close();
    };
  }, [token]);
}
