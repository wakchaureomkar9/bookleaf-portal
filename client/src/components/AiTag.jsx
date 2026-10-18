import React from 'react';

/**
 * Small tag shown next to category/priority.
 * source === 'ai'    → purple "AI" tag
 * source === 'admin' → amber "Edited" tag
 * Otherwise nothing.
 */
export default function AiTag({ source }) {
  if (source === 'ai') return <span className="tag-ai">AI</span>;
  if (source === 'admin') return <span className="tag-edited">Edited</span>;
  return null;
}
