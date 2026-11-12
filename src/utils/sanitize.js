/**
 * Input sanitisation helpers.
 *
 * These run *before* validation so that the validator always sees a clean
 * string, and they neutralise the classic stored-XSS payloads that a
 * task-management UI would happily render with innerHTML.
 */

// ASCII control characters (0x00-0x1F) and DEL (0x7F), keeping \t \n \r.
const CONTROL_CHARS = new RegExp('[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', 'g');
const HTML_TAGS = /<\/?[^>]*>/g;

/**
 * Strip control characters, HTML tags and collapse whitespace.
 * @param {unknown} value
 * @returns {string}
 */
export const sanitizeText = (value) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(CONTROL_CHARS, '')
    .replace(HTML_TAGS, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Escape the characters that matter inside HTML text/attribute contexts.
 * Used for values that are echoed back into markup (e.g. error messages).
 */
export const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Parse an id coming from the URL. Returns null when it is not a
 * positive integer, which lets the controller answer 404/400 properly
 * instead of silently matching `NaN`.
 */
export const parseId = (raw) => {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
};

export default { sanitizeText, escapeHtml, parseId };
