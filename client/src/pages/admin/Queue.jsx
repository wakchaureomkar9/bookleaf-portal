import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../api';
import Badge from '../../components/Badge';
import AiTag from '../../components/AiTag';
import LiveIndicator from '../../components/LiveIndicator';
import { useSSE } from '../../hooks/useSSE';

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

const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const UNRESOLVED = new Set(['Open', 'In Progress']);

function fmtAge(val) {
  if (!val) return '';
  const ms = Math.max(0, Date.now() - new Date(val).getTime());
  const days = Math.floor(ms / 86400000);
  return `${days}d old`;
}

function fmtDate(val) {
  if (!val) return '';
  return new Date(val).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildQuery(filters) {
  const params = new URLSearchParams();
  if (filters.status)     params.set('status', filters.status);
  if (filters.priority)   params.set('priority', filters.priority);
  if (filters.category)   params.set('category', filters.category);
  if (filters.from)       params.set('from', filters.from);
  if (filters.to)         params.set('to', filters.to);
  if (filters.assignedTo) params.set('assignedTo', filters.assignedTo);
  const qs = params.toString();
  return qs ? `/tickets?${qs}` : '/tickets';
}

export default function AdminQueue() {
  const [tickets, setTickets]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [live, setLive]         = useState(false);
  const [filters, setFilters]   = useState({ status: '', priority: '', category: '', from: '', to: '', assignedTo: '' });

  const fetchTickets = useCallback(() => {
    setLoading(true);
    get(buildQuery(filters))
      .then((d) => setTickets(d.tickets || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useSSE((type) => {
    setLive(true);
    if (type === 'ticket:updated' || type === 'ticket:response') {
      fetchTickets();
    }
  });

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters({ status: '', priority: '', category: '', from: '', to: '', assignedTo: '' });
  }

  // Sort: unresolved before resolved, then priority, then newest
  const sorted = [...tickets].sort((a, b) => {
    const aUnres = UNRESOLVED.has(a.status) ? 0 : 1;
    const bUnres = UNRESOLVED.has(b.status) ? 0 : 1;
    if (aUnres !== bUnres) return aUnres - bUnres;
    const pa = PRIORITY_ORDER[a.priority] ?? 4;
    const pb = PRIORITY_ORDER[b.priority] ?? 4;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">Ticket Queue</h1>
        <div className="flex items-center gap-8">
          <LiveIndicator live={live} />
          <span className="text-muted" style={{ fontSize: '0.875rem' }}>{sorted.length} ticket{sorted.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <select className="filter-select" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>

        <select className="filter-select" value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>

        <select className="filter-select" value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>

        <input
          type="date"
          className="filter-date"
          value={filters.from}
          onChange={(e) => setFilter('from', e.target.value)}
          title="From date"
        />
        <input
          type="date"
          className="filter-date"
          value={filters.to}
          onChange={(e) => setFilter('to', e.target.value)}
          title="To date"
        />

        <button
          type="button"
          className={`btn btn-sm ${filters.assignedTo === 'me' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('assignedTo', filters.assignedTo === 'me' ? '' : 'me')}
          aria-pressed={filters.assignedTo === 'me'}
        >
          Assigned to me
        </button>

        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear</button>
        )}
      </div>

      {loading && (
        <div className="state-box"><div className="spinner" /></div>
      )}

      {error && !loading && (
        <div className="state-box">
          <span className="state-icon">⚠️</span>
          <p className="state-err">{error}</p>
        </div>
      )}

      {!loading && !error && sorted.length === 0 && (
        <div className="state-box">
          <span className="state-icon">🎫</span>
          <p className="state-msg">No tickets match your filters.</p>
          {hasFilters && <button className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear filters</button>}
        </div>
      )}

      {!loading && !error && sorted.map((t) => {
        const isCriticalOrHigh = t.priority === 'Critical' || t.priority === 'High';
        const isUnresolved = UNRESOLVED.has(t.status);
        const priorityClass = isCriticalOrHigh && isUnresolved
          ? `priority-${t.priority.toLowerCase()}`
          : '';

        return (
          <Link key={t._id} to={`/admin/tickets/${t._id}`} className={`ticket-card ${priorityClass}`}>
            <div className="ticket-card-header">
              <span className="ticket-subject">{t.subject}</span>
              <div className="ticket-meta">
                <Badge type="status" value={t.status} />
                <Badge type="priority" value={t.priority} />
                <span className="ticket-age">{fmtAge(t.createdAt)}</span>
              </div>
            </div>
            <div className="ticket-meta">
              <span style={{ fontSize: '0.8rem' }}>
                {t.category}
                <AiTag source={t.categorySource} />
              </span>
              {t.authorId && (
                <>
                  <span className="text-subtle">•</span>
                  <span style={{ fontSize: '0.8rem' }}>
                    {t.authorId.name || t.authorId.email}
                  </span>
                </>
              )}
              {t.bookId && (
                <>
                  <span className="text-subtle">•</span>
                  <span style={{ fontSize: '0.8rem' }}>📖 {t.bookId.title || t.bookId.bookId}</span>
                </>
              )}
              <span className="text-subtle">•</span>
              <span className="ticket-age">{fmtDate(t.createdAt)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
