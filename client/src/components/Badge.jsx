import React from 'react';

const STATUS_CLASSES = {
  'Open':        'badge-status-open',
  'In Progress': 'badge-status-in-progress',
  'Resolved':    'badge-status-resolved',
  'Closed':      'badge-status-closed',
};

const PRIORITY_CLASSES = {
  'Critical': 'badge-priority-critical',
  'High':     'badge-priority-high',
  'Medium':   'badge-priority-medium',
  'Low':      'badge-priority-low',
};

/**
 * Coloured pill badge for status or priority values.
 * Usage: <Badge type="status" value="Open" />
 *        <Badge type="priority" value="High" />
 */
export default function Badge({ type, value }) {
  const cls =
    type === 'status'
      ? STATUS_CLASSES[value] || 'badge-status-closed'
      : PRIORITY_CLASSES[value] || 'badge-priority-low';

  return <span className={`badge ${cls}`}>{value}</span>;
}
