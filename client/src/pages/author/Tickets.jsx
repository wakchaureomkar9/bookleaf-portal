import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../api';
import Badge from '../../components/Badge';
import AiTag from '../../components/AiTag';
import LiveIndicator from '../../components/LiveIndicator';
import { useSSE } from '../../hooks/useSSE';

function fmtDate(val) {
  if (!val) return '';
  return new Date(val).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);

  const fetchTickets = useCallback(() => {
    get('/tickets')
      .then((d) => setTickets(d.tickets || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // SSE: refresh ticket list on updates
  useSSE((type, data) => {
    setLive(true);
    if (type === 'ticket:updated' || type === 'ticket:response') {
      fetchTickets();
    }
  });

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="state-box"><div className="spinner" /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <div className="state-box">
          <span className="state-icon">⚠️</span>
          <p className="state-err">{error}</p>
        </div>
      </div>
    );
  }

  // Sort: newest first
  const sorted = [...tickets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">My Tickets</h1>
        <div className="flex items-center gap-8">
          <LiveIndicator live={live} />
          <Link to="/tickets/new" className="btn btn-primary btn-sm">
            + New Ticket
          </Link>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="state-box">
          <span className="state-icon">🎫</span>
          <p className="state-msg">No tickets yet.</p>
          <Link to="/tickets/new" className="btn btn-primary btn-sm">Submit your first ticket</Link>
        </div>
      ) : (
        sorted.map((t) => (
          <Link key={t._id} to={`/tickets/${t._id}`} className="ticket-card">
            <div className="ticket-card-header">
              <span className="ticket-subject">{t.subject}</span>
              <div className="ticket-meta">
                <Badge type="status" value={t.status} />
                <Badge type="priority" value={t.priority} />
              </div>
            </div>
            <div className="ticket-meta">
              <span>
                {t.category}
                <AiTag source={t.categorySource} />
              </span>
              <span className="text-subtle">•</span>
              <span className="ticket-age">{fmtDate(t.createdAt)}</span>
              {t.bookId && (
                <>
                  <span className="text-subtle">•</span>
                  <span>📖 {t.bookId.title || t.bookId.bookId}</span>
                </>
              )}
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
