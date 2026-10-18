import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { get, post } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Badge from '../../components/Badge';
import AiTag from '../../components/AiTag';
import LiveIndicator from '../../components/LiveIndicator';
import { useSSE } from '../../hooks/useSSE';
import { useToast } from '../../components/Toast';

function fmtDateTime(val) {
  if (!val) return '';
  return new Date(val).toLocaleString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AuthorTicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const bottomRef = useRef(null);

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState(false);

  const fetchTicket = useCallback(() => {
    get(`/tickets/${id}`)
      .then((d) => setTicket(d.ticket))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  // Scroll to bottom when thread updates
  useEffect(() => {
    if (ticket) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [ticket?.responses?.length]);

  useSSE((type, data) => {
    setLive(true);
    if (
      (type === 'ticket:response' && data.ticketId === id) ||
      (type === 'ticket:updated' && data.ticketId === id)
    ) {
      fetchTicket();
    }
  });

  async function handleReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      const data = await post(`/tickets/${id}/responses`, { body: reply.trim() });
      setTicket(data.ticket);
      setReply('');
      toast('Reply sent!', 'success');
    } catch (err) {
      toast(err.message || 'Failed to send reply.', 'error');
    } finally {
      setSending(false);
    }
  }

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
          <Link to="/tickets" className="btn btn-secondary btn-sm">Back to tickets</Link>
        </div>
      </div>
    );
  }

  if (!ticket) return null;

  const isResolved = ticket.status === 'Resolved' || ticket.status === 'Closed';

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <Link to="/tickets" className="text-muted" style={{ fontSize: '0.875rem' }}>
            ← My Tickets
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>{ticket.subject}</h1>
        </div>
        <LiveIndicator live={live} />
      </div>

      {/* Ticket info bar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="flex flex-wrap gap-8 items-center">
          <Badge type="status" value={ticket.status} />
          <Badge type="priority" value={ticket.priority} />
          <AiTag source={ticket.prioritySource} />
          <span className="text-muted" style={{ fontSize: '0.875rem' }}>
            {ticket.category}
            <AiTag source={ticket.categorySource} />
          </span>
          {ticket.bookId && (
            <span className="text-muted" style={{ fontSize: '0.875rem' }}>
              📖 {ticket.bookId.title}
            </span>
          )}
          <span className="text-subtle" style={{ fontSize: '0.8rem', marginLeft: 'auto' }}>
            Opened {fmtDateTime(ticket.createdAt)}
          </span>
        </div>
        {ticket.description && (
          <p style={{ marginTop: 12, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {ticket.description}
          </p>
        )}
      </div>

      {/* Thread */}
      <div className="card">
        <div className="thread" style={{ minHeight: 120 }}>
          {(!ticket.responses || ticket.responses.length === 0) && (
            <p className="text-muted" style={{ fontSize: '0.875rem', textAlign: 'center', padding: '24px 0' }}>
              No replies yet. Start the conversation below.
            </p>
          )}
          {(ticket.responses || []).map((msg) => {
            const isAuthor = msg.role === 'author';
            return (
              <div key={msg._id} className={`message-row ${isAuthor ? 'is-author' : 'is-admin'}`}>
                <div className="message-meta">
                  {isAuthor ? 'You' : 'BookLeaf Support'} · {fmtDateTime(msg.createdAt)}
                </div>
                <div className={`message-bubble ${isAuthor ? 'author' : 'admin'}`}>
                  {msg.body}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Reply box */}
      {!isResolved ? (
        <div className="reply-box">
          <form onSubmit={handleReply}>
            <div className="form-group mb-0">
              <label className="form-label">Your reply</label>
              <textarea
                className="form-textarea"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your message…"
                rows={3}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: 10 }}
              disabled={sending || !reply.trim()}
            >
              {sending ? 'Sending…' : 'Send reply'}
            </button>
          </form>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          This ticket is {ticket.status.toLowerCase()}. You can open a new ticket if you need further help.
        </div>
      )}
    </div>
  );
}
