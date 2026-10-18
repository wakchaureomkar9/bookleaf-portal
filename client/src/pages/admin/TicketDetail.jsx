import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { get, post, patch } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Badge from '../../components/Badge';
import AiTag from '../../components/AiTag';
import LiveIndicator from '../../components/LiveIndicator';
import { useSSE } from '../../hooks/useSSE';
import { useToast } from '../../components/Toast';

const STATUSES   = ['Open', 'In Progress', 'Resolved', 'Closed'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const CATEGORIES = [
  'Royalty & Payments',
  'ISBN & Metadata Issues',
  'Printing & Quality',
  'Distribution & Availability',
  'Book Status & Production Updates',
  'General Inquiry',
];

function fmtDateTime(val) {
  if (!val) return '';
  return new Date(val).toLocaleString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function inr(val) {
  if (val == null) return '—';
  return '₹' + Number(val).toLocaleString('en-IN');
}

export default function AdminTicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const bottomRef = useRef(null);

  const [ticket, setTicket]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [live, setLive]           = useState(false);

  // Reply
  const [reply, setReply]           = useState('');
  const [sending, setSending]       = useState(false);

  // Internal note
  const [note, setNote]             = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // AI draft
  const [draft, setDraft]           = useState('');
  const [draftMeta, setDraftMeta]   = useState(null);
  const [drafting, setDrafting]     = useState(false);

  // Ticket update fields
  const [editStatus,   setEditStatus]   = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [updating, setUpdating]         = useState(false);

  const fetchTicket = useCallback(() => {
    get(`/tickets/${id}`)
      .then((d) => {
        setTicket(d.ticket);
        setEditStatus(d.ticket.status);
        setEditPriority(d.ticket.priority);
        setEditCategory(d.ticket.category);
        if (d.ticket.aiDraft) {
          setDraftMeta(d.ticket.aiDraft);
          if (d.ticket.aiDraft.text) {
            setDraft(d.ticket.aiDraft.text);
          }
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

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

  // ── Reply ──────────────────────────────────────────────────────────────────
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

  // ── Internal note ──────────────────────────────────────────────────────────
  async function handleNote(e) {
    e.preventDefault();
    if (!note.trim()) return;
    setAddingNote(true);
    try {
      const data = await post(`/tickets/${id}/notes`, { body: note.trim() });
      setTicket(data.ticket);
      setNote('');
      toast('Note added.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to add note.', 'error');
    } finally {
      setAddingNote(false);
    }
  }

  // ── Ticket update ──────────────────────────────────────────────────────────
  async function handleUpdate(e) {
    e.preventDefault();
    setUpdating(true);
    try {
      const data = await patch(`/tickets/${id}`, {
        status: editStatus,
        priority: editPriority,
        category: editCategory,
      });
      setTicket(data.ticket);
      toast('Ticket updated.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to update ticket.', 'error');
    } finally {
      setUpdating(false);
    }
  }

  async function handleAssignToMe() {
    setUpdating(true);
    try {
      const data = await patch(`/tickets/${id}`, { assignedTo: 'me' });
      setTicket(data.ticket);
      toast('Assigned to you.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to assign.', 'error');
    } finally {
      setUpdating(false);
    }
  }

  // ── AI Draft ───────────────────────────────────────────────────────────────
  async function handleDraft(refresh = false) {
    setDrafting(true);
    try {
      const url = `/tickets/${id}/draft${refresh ? '?refresh=true' : ''}`;
      const data = await post(url, {});
      setDraftMeta(data.aiDraft);
      if (data.aiDraft?.aiFailed || !data.draft) {
        setDraft('');
        toast('AI unavailable — write your reply manually.', 'info');
      } else {
        setDraft(data.draft || '');
      }
    } catch (err) {
      toast(err.message || 'Draft generation failed.', 'error');
    } finally {
      setDrafting(false);
    }
  }

  function useDraft() {
    setReply(draft);
    toast('Draft copied to reply box.', 'info');
  }

  if (loading) {
    return <div className="page-wrapper"><div className="state-box"><div className="spinner" /></div></div>;
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <div className="state-box">
          <span className="state-icon">⚠️</span>
          <p className="state-err">{error}</p>
          <Link to="/admin" className="btn btn-secondary btn-sm">Back to queue</Link>
        </div>
      </div>
    );
  }

  if (!ticket) return null;

  const authorName = ticket.authorId?.name || ticket.authorId?.email || 'Author';
  const book = ticket.bookId;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <Link to="/admin" className="text-muted" style={{ fontSize: '0.875rem' }}>← Ticket Queue</Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>{ticket.subject}</h1>
        </div>
        <LiveIndicator live={live} />
      </div>

      <div className="ticket-detail-layout two-col">
        {/* ── LEFT COLUMN: thread + reply + notes + draft ── */}
        <div>
          {/* Info bar */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="flex flex-wrap gap-8 items-center" style={{ marginBottom: 8 }}>
              <Badge type="status" value={ticket.status} />
              <span>
                <Badge type="priority" value={ticket.priority} />
                <AiTag source={ticket.prioritySource} />
              </span>
              <span style={{ fontSize: '0.875rem' }}>
                {ticket.category}
                <AiTag source={ticket.categorySource} />
              </span>
            </div>
            {ticket.description && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{ticket.description}</p>
            )}
          </div>

          {/* Thread */}
          <div className="card">
            <div className="thread" style={{ minHeight: 100 }}>
              {(!ticket.responses || ticket.responses.length === 0) && (
                <p className="text-muted" style={{ fontSize: '0.875rem', textAlign: 'center', padding: '20px 0' }}>
                  No messages yet.
                </p>
              )}
              {(ticket.responses || []).map((msg) => {
                const isAuthor = msg.role === 'author';
                return (
                  <div key={msg._id} className={`message-row ${isAuthor ? 'is-author' : 'is-admin'}`}>
                    <div className="message-meta">
                      {isAuthor ? authorName : 'Admin'} · {fmtDateTime(msg.createdAt)}
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

          {/* AI Draft section */}
          <div className="draft-section">
            <div className="draft-section-title">✨ AI Draft Reply</div>
            {!draftMeta && !draft ? (
              <div className="flex gap-8">
                <button className="btn btn-secondary btn-sm" onClick={() => handleDraft(false)} disabled={drafting}>
                  {drafting ? 'Generating…' : 'Generate AI draft'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleDraft(true)} disabled={drafting}>
                  {drafting ? 'Regenerating…' : 'Regenerate'}
                </button>
              </div>
            ) : draftMeta?.aiFailed || !draft ? (
              <div>
                <p style={{ fontSize: '0.875rem', color: '#7c3aed', marginBottom: 8 }}>
                  AI unavailable — write your reply manually.
                </p>
                <button className="btn btn-secondary btn-sm" onClick={() => handleDraft(true)} disabled={drafting}>
                  {drafting ? 'Regenerating…' : 'Regenerate'}
                </button>
              </div>
            ) : (
              <div>
                <textarea
                  className="draft-textarea"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={6}
                />
                <div className="flex gap-8" style={{ marginTop: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={useDraft}>
                    Use draft
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleDraft(true)} disabled={drafting}>
                    {drafting ? 'Regenerating…' : 'Regenerate'}
                  </button>
                  {draftMeta?.generatedAt && (
                    <span className="text-subtle" style={{ fontSize: '0.75rem', alignSelf: 'center' }}>
                      Generated {fmtDateTime(draftMeta.generatedAt)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Reply box */}
          <div className="reply-box">
            <form onSubmit={handleReply}>
              <div className="form-group mb-0">
                <label className="form-label">Reply to author</label>
                <textarea
                  className="form-textarea"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply…"
                  rows={3}
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

          {/* Internal notes */}
          <div className="internal-notes-section">
            <div className="internal-notes-label">🔒 Internal notes — not visible to author</div>
            {(!ticket.internalNotes || ticket.internalNotes.length === 0) ? (
              <p style={{ fontSize: '0.875rem', color: '#92400e' }}>No internal notes yet.</p>
            ) : (
              (ticket.internalNotes || []).map((n) => (
                <div key={n._id} className="note-item">
                  <div style={{ fontSize: '0.75rem', color: '#b45309', marginBottom: 4 }}>
                    {fmtDateTime(n.createdAt)}
                  </div>
                  {n.body}
                </div>
              ))
            )}
            <form onSubmit={handleNote} style={{ marginTop: 12 }}>
              <textarea
                className="form-textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add an internal note…"
                rows={2}
                style={{ background: '#fefce8', borderColor: '#fde68a' }}
              />
              <button
                type="submit"
                className="btn btn-sm"
                style={{ marginTop: 8, background: '#f59e0b', color: '#fff', border: 'none' }}
                disabled={addingNote || !note.trim()}
              >
                {addingNote ? 'Adding…' : 'Add note'}
              </button>
            </form>
          </div>
        </div>

        {/* ── RIGHT COLUMN: ticket info + controls ── */}
        <div className="info-panel">
          {/* Author / Book info */}
          <div className="info-block">
            <div className="info-block-title">Ticket Info</div>
            <div className="info-row">
              <span className="info-row-label">Author</span>
              <span className="info-row-value">{authorName}</span>
            </div>
            <div className="info-row">
              <span className="info-row-label">Opened</span>
              <span className="info-row-value">{fmtDateTime(ticket.createdAt)}</span>
            </div>
            {ticket.assignedTo && (
              <div className="info-row">
                <span className="info-row-label">Assigned</span>
                <span className="info-row-value">{ticket.assignedTo.name || ticket.assignedTo.email || 'Admin'}</span>
              </div>
            )}
          </div>

          {/* Book info */}
          {book && (
            <div className="info-block">
              <div className="info-block-title">Book</div>
              <div className="info-row">
                <span className="info-row-label">Title</span>
                <span className="info-row-value">{book.title}</span>
              </div>
              <div className="info-row">
                <span className="info-row-label">Status</span>
                <span className="info-row-value">{book.status}</span>
              </div>
              <div className="info-row">
                <span className="info-row-label">MRP</span>
                <span className="info-row-value">{inr(book.mrp)}</span>
              </div>
              <div className="info-row">
                <span className="info-row-label">Copies sold</span>
                <span className="info-row-value">{book.totalCopiesSold ?? '—'}</span>
              </div>
              <div className="info-row">
                <span className="info-row-label">Royalty earned</span>
                <span className="info-row-value amount">{inr(book.totalRoyaltyEarned)}</span>
              </div>
              <div className="info-row">
                <span className="info-row-label">Pending</span>
                <span className="info-row-value amount">{inr(book.royaltyPending)}</span>
              </div>
              {book.printPartner && (
                <div className="info-row">
                  <span className="info-row-label">Print partner</span>
                  <span className="info-row-value">{book.printPartner}</span>
                </div>
              )}
            </div>
          )}

          {/* Edit ticket */}
          <div className="info-block">
            <div className="info-block-title">Edit Ticket</div>
            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Priority
                  <AiTag source={ticket.prioritySource} />
                </label>
                <select className="form-select" value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Category
                  <AiTag source={ticket.categorySource} />
                </label>
                <select className="form-select" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={updating}>
                {updating ? 'Saving…' : 'Save changes'}
              </button>
            </form>
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 8, width: '100%' }}
              onClick={handleAssignToMe}
              disabled={updating}
            >
              Assign to me
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
