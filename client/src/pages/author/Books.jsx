import React, { useEffect, useState } from 'react';
import { get } from '../../api';

/** Format Indian currency: null/undefined → "—", 0 → "₹0" */
function inr(val) {
  if (val == null) return '—';
  return '₹' + Number(val).toLocaleString('en-IN');
}

function fmt(val) {
  if (val == null || val === '') return '—';
  return String(val);
}

function fmtDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_COLORS = {
  Published:          { bg: '#dcfce7', color: '#16a34a' },
  'Under Review':     { bg: '#dbeafe', color: '#2563eb' },
  'In Production':    { bg: '#fef3c7', color: '#d97706' },
  Draft:              { bg: '#f3f4f6', color: '#6b7280' },
};

export default function Books() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    get('/books')
      .then((d) => setBooks(d.books || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">My Books</h1>
      </div>

      {books.length === 0 ? (
        <div className="state-box">
          <span className="state-icon">📚</span>
          <p className="state-msg">No books found for your account.</p>
        </div>
      ) : (
        <>
          {/* Cards for mobile friendliness */}
          <div className="books-grid">
            {books.map((book) => {
              const statusStyle = STATUS_COLORS[book.status] || { bg: '#f3f4f6', color: '#6b7280' };
              return (
                <div key={book._id} className="book-card">
                  <div>
                    <div className="book-card-title">{book.title}</div>
                    <div style={{ marginTop: 4 }}>
                      <span
                        className="badge"
                        style={{ background: statusStyle.bg, color: statusStyle.color }}
                      >
                        {book.status}
                      </span>
                    </div>
                  </div>
                  <div className="book-card-row">
                    <span>ISBN</span>
                    <strong>{fmt(book.isbn)}</strong>
                  </div>
                  <div className="book-card-row">
                    <span>Genre</span>
                    <strong>{fmt(book.genre)}</strong>
                  </div>
                  <div className="book-card-row">
                    <span>Published</span>
                    <strong>{fmtDate(book.publicationDate)}</strong>
                  </div>
                  <div className="book-card-row">
                    <span>MRP</span>
                    <strong>{inr(book.mrp)}</strong>
                  </div>
                  <div className="book-card-row">
                    <span>Copies sold</span>
                    <strong>{book.totalCopiesSold ?? '—'}</strong>
                  </div>
                  <div className="book-card-row">
                    <span>Royalty earned</span>
                    <strong className="amount">{inr(book.totalRoyaltyEarned)}</strong>
                  </div>
                  <div className="book-card-row">
                    <span>Paid</span>
                    <strong className="amount">{inr(book.royaltyPaid)}</strong>
                  </div>
                  <div className="book-card-row">
                    <span>Pending</span>
                    <strong className="amount">{inr(book.royaltyPending)}</strong>
                  </div>
                  {book.lastRoyaltyPayoutDate && (
                    <div className="book-card-row">
                      <span>Last payout</span>
                      <strong>{fmtDate(book.lastRoyaltyPayoutDate)}</strong>
                    </div>
                  )}
                  {book.printPartner && (
                    <div className="book-card-row">
                      <span>Print partner</span>
                      <strong>{book.printPartner}</strong>
                    </div>
                  )}
                  {book.availableOn && book.availableOn.length > 0 && (
                    <div className="book-card-row">
                      <span>Available on</span>
                      <strong>{book.availableOn.join(', ')}</strong>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
