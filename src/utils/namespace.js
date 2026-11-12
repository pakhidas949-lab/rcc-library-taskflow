/**
 * Namespace helpers.
 *
 * Tasks created by the dashboard pages are prefixed with a `[Namespace]` tag
 * (e.g. "[Catalog] The Secret History"). The prefix lets a single flat task
 * list serve several dashboards: each page filters its own tasks and the API
 * can aggregate counters per namespace.
 */

const NAMESPACE_PATTERN = /^\[([^\]]+)\]\s*([\s\S]*)$/;

/**
 * Split a task text into its namespace and its human label.
 * @param {string} text
 * @returns {{ namespace: string|null, label: string }}
 */
export const parseNamespace = (text) => {
  const match = NAMESPACE_PATTERN.exec(text || '');
  if (!match) return { namespace: null, label: text || '' };
  return { namespace: match[1], label: match[2] };
};

/**
 * Build a namespaced task text.
 * @param {string} namespace
 * @param {string} label
 * @returns {string}
 */
export const tagNamespace = (namespace, label) => `[${namespace}] ${label}`;

export default { parseNamespace, tagNamespace };
