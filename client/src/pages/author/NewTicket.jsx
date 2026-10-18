import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../../api';
import { useToast } from '../../components/Toast';

// Minimum lengths matching server/validators/ticket.schema.js (createTicketSchema)
const MIN_SUBJECT_LENGTH = 3;
const MAX_SUBJECT_LENGTH = 200;
const MIN_DESCRIPTION_LENGTH = 10;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function NewTicket() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef(null);

  const [books, setBooks] = useState([]);
  const [bookId, setBookId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Track field blur / interaction for validation
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [descTouched, setDescTouched] = useState(false);

  // Server-returned field errors (e.g. { subject: 'Subject too short' })
  const [serverFieldErrors, setServerFieldErrors] = useState({});

  useEffect(() => {
    get('/books')
      .then((d) => setBooks(d.books || []))
      .catch(() => {}); // non-fatal
  }, []);

  const subjectTrimmed = subject.trim();
  const descTrimmed = description.trim();

  const isSubjectValid = subjectTrimmed.length >= MIN_SUBJECT_LENGTH && subjectTrimmed.length <= MAX_SUBJECT_LENGTH;
  const isDescriptionValid = descTrimmed.length >= MIN_DESCRIPTION_LENGTH;
  const isFormValid = isSubjectValid && isDescriptionValid;

  const subjectTooShort = (subject.length > 0 || subjectTouched) && subjectTrimmed.length < MIN_SUBJECT_LENGTH;
  const descTooShort = (description.length > 0 || descTouched) && descTrimmed.length < MIN_DESCRIPTION_LENGTH;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setServerFieldErrors({});

    if (!isSubjectValid) {
      setSubjectTouched(true);
      setError(`Subject must be at least ${MIN_SUBJECT_LENGTH} characters.`);
      return;
    }
    if (!isDescriptionValid) {
      setDescTouched(true);
      setError(`Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      const body = { subject: subjectTrimmed, description: descTrimmed };
      if (bookId) body.bookId = bookId;

      const token = localStorage.getItem('bl_token');
      const res = await fetch(`${API_BASE}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        localStorage.removeItem('bl_token');
        localStorage.removeItem('bl_user');
        window.location.href = '/login';
        return;
      }

      const json = await res.json().catch(() => ({ success: false, message: 'Invalid server response' }));

      if (!res.ok) {
        if (json.errors && Array.isArray(json.errors)) {
          const fieldMap = {};
          json.errors.forEach((err) => {
            if (err.field) fieldMap[err.field] = err.message;
          });
          setServerFieldErrors(fieldMap);
        }
        throw new Error(json.message || 'Failed to create ticket.');
      }

      toast('Ticket created successfully!', 'success');
      navigate(`/tickets/${json.data.ticket._id}`);
    } catch (err) {
      setError(err.message || 'Failed to create ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">New Support Ticket</h1>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="book">Related book (optional)</label>
            <select
              id="book"
              className="form-select"
              value={bookId}
              onChange={(e) => {
                setBookId(e.target.value);
                if (serverFieldErrors.bookId) {
                  setServerFieldErrors((prev) => ({ ...prev, bookId: '' }));
                }
              }}
            >
              <option value="">General / Account Level</option>
              {books.map((b) => (
                <option key={b._id} value={b.bookId}>
                  {b.title}
                </option>
              ))}
            </select>
            {serverFieldErrors.bookId && (
              <p className="form-error">{serverFieldErrors.bookId}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="subject">Subject</label>
            <input
              id="subject"
              type="text"
              className="form-input"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                if (serverFieldErrors.subject) {
                  setServerFieldErrors((prev) => ({ ...prev, subject: '' }));
                }
              }}
              onBlur={() => setSubjectTouched(true)}
              placeholder="Brief description of your issue"
              maxLength={MAX_SUBJECT_LENGTH}
              required
            />
            <div className="form-hint">
              {subjectTrimmed.length} / {MIN_SUBJECT_LENGTH} minimum
            </div>
            {serverFieldErrors.subject && (
              <p className="form-error">{serverFieldErrors.subject}</p>
            )}
            {!serverFieldErrors.subject && subjectTooShort && (
              <p className="form-error">Subject too short (minimum {MIN_SUBJECT_LENGTH} characters)</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">Description</label>
            <textarea
              id="description"
              className="form-textarea"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (serverFieldErrors.description) {
                  setServerFieldErrors((prev) => ({ ...prev, description: '' }));
                }
              }}
              onBlur={() => setDescTouched(true)}
              placeholder="Please describe your issue in detail…"
              rows={5}
              required
            />
            <div className="form-hint">
              {descTrimmed.length} / {MIN_DESCRIPTION_LENGTH} minimum
            </div>
            {serverFieldErrors.description && (
              <p className="form-error">{serverFieldErrors.description}</p>
            )}
            {!serverFieldErrors.description && descTooShort && (
              <p className="form-error">Description too short (minimum {MIN_DESCRIPTION_LENGTH} characters)</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Attachment (optional)</label>
            <div
              className="file-input-area"
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                onChange={(e) => setFileName(e.target.files[0]?.name || '')}
              />
              {fileName ? (
                <span style={{ color: 'var(--text)' }}>📎 {fileName}</span>
              ) : (
                <span>Click to choose a file…</span>
              )}
            </div>
            <p className="form-hint">Attachments coming soon — file will not be uploaded.</p>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="flex gap-8" style={{ marginTop: 8 }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !isFormValid}
            >
              {submitting ? 'Submitting…' : 'Submit ticket'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/tickets')}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
