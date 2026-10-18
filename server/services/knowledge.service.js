const fs = require('fs');
const path = require('path');

const KNOWLEDGEBASE_PATH = path.resolve(__dirname, '../knowledge/knowledgebase.md');

/**
 * Category-to-Section mapping as specified:
 * Royalty & Payments → Royalty Policy
 * ISBN & Metadata Issues → ISBN Policy
 * Printing & Quality → Printing & Quality
 * Distribution & Availability → Distribution & Availability
 * Book Status & Production Updates → Production Stages
 * General Inquiry → Company Overview
 */
const CATEGORY_SECTION_MAP = {
  'Royalty & Payments': 'Royalty Policy',
  'ISBN & Metadata Issues': 'ISBN Policy',
  'Printing & Quality': 'Printing & Quality',
  'Distribution & Availability': 'Distribution & Availability',
  'Book Status & Production Updates': 'Production Stages',
  'General Inquiry': 'Company Overview',
};

const sections = {};
const sampleExamples = {};

// Parse knowledgebase.md once at startup
try {
  const content = fs.readFileSync(KNOWLEDGEBASE_PATH, 'utf8');

  // Split by top-level "## " markdown headings
  const rawSections = content.split(/\n(?=## )|^## /m).filter(Boolean);

  for (const chunk of rawSections) {
    const trimmed = chunk.replace(/^##\s*/, '').trim();
    const firstNewline = trimmed.indexOf('\n');
    const title = (firstNewline === -1 ? trimmed : trimmed.slice(0, firstNewline)).trim();
    const body = firstNewline === -1 ? '' : trimmed.slice(firstNewline + 1).trim();
    sections[title] = body;
  }

  // Parse "### <Category>" subheadings from inside "Sample Examples"
  const sampleSectionBody = sections['Sample Examples'] || '';
  if (sampleSectionBody) {
    const rawSamples = sampleSectionBody.split(/\n(?=### )|^### /m).filter(Boolean);
    for (const chunk of rawSamples) {
      const trimmed = chunk.replace(/^###\s*/, '').trim();
      const firstNewline = trimmed.indexOf('\n');
      const categoryTitle = (firstNewline === -1 ? trimmed : trimmed.slice(0, firstNewline)).trim();
      const body = firstNewline === -1 ? '' : trimmed.slice(firstNewline + 1).trim();
      sampleExamples[categoryTitle] = body;
    }
  }
} catch (err) {
  console.error('[knowledge.service] Failed to read knowledgebase.md:', err.message);
}

/**
 * Get relevant knowledge base context for a given category.
 *
 * Returns:
 * 1. The category's specific policy section
 * 2. The Communication Tone Guidelines section
 * 3. The category's block from Sample Examples
 *
 * @param {string} category - Ticket category string
 * @returns {string} Combined context text
 */
const getContext = (category) => {
  const sectionTitle = CATEGORY_SECTION_MAP[category] || 'Company Overview';
  const categorySection = sections[sectionTitle] || '';
  const toneGuidelines = sections['Communication Tone Guidelines'] || '';
  const sampleExample = sampleExamples[category] || '';

  const parts = [];

  if (categorySection) {
    parts.push(`## ${sectionTitle}\n${categorySection}`);
  }

  if (toneGuidelines) {
    parts.push(`## Communication Tone Guidelines\n${toneGuidelines}`);
  }

  if (sampleExample) {
    parts.push(`## Sample Examples (${category})\n${sampleExample}`);
  }

  return parts.join('\n\n');
};

module.exports = {
  getContext,
  CATEGORY_SECTION_MAP,
};
