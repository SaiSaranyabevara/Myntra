// server/src/services/reply.js

import { extractFiltersFromText, complementCategories, TAXONOMY } from './intent.js';

/**
 * Merge new filters into existing ones.
 * - Arrays: union (unique)
 * - price: selectively override provided fields
 * - scalars: prefer delta when provided
 */
export function mergeFilters(base = {}, delta = {}) {
  const out = { ...(base || {}) };

  const mergeArray = (a, b) => {
    const set = new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]);
    return Array.from(set);
  };

  const keysArrayUnion = [
    'include_categories',
    'colors',
    'sizes',
    'occasion',
    'season',
    'fit',
    'silhouette',
    'material',
    'pattern',
    'brand'
  ];
  for (const k of keysArrayUnion) {
    if (k in delta) out[k] = mergeArray(base[k], delta[k]);
  }

  // price
  if ('price' in delta) {
    out.price = {
      ...(base.price || {}),
      ...(delta.price || {})
    };
    // Clean invalid price values
    if (out.price && out.price.min != null && Number.isNaN(Number(out.price.min))) delete out.price.min;
    if (out.price && out.price.max != null && Number.isNaN(Number(out.price.max))) delete out.price.max;
    if (out.price && Object.keys(out.price).length === 0) delete out.price;
  }

  // booleans / scalars
  for (const k of ['in_stock', 'sort', 'page', 'limit', 'q', 'category_ids']) {
    if (k in delta && delta[k] != null) out[k] = delta[k];
  }

  // Remove empties
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (Array.isArray(v) && v.length === 0) delete out[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) delete out[k];
    if (v == null) delete out[k];
  }

  return out;
}

/**
 * Utility: check if an object has a non-empty value at path (dot notation)
 */
function has(obj, path) {
  const parts = String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || !(p in cur)) return false;
    cur = cur[p];
  }
  if (Array.isArray(cur)) return cur.length > 0;
  return cur != null && cur !== '';
}

/**
 * Build concise human-readable summary of filters for responses
 */
function summarizeFilters(filters = {}) {
  const parts = [];

  if (filters.include_categories?.length) {
    const cats = filters.include_categories.join(', ');
    parts.push(cats);
  }

  if (filters.occasion?.length) parts.push(`for ${filters.occasion.join('/')}`);
  if (filters.season?.length) parts.push(`in ${filters.season.join('/')}`);
  if (filters.colors?.length) parts.push(`colors: ${filters.colors.slice(0, 4).join(', ')}`);

  if (filters.price?.min != null && filters.price?.max != null) {
    parts.push(`between $${filters.price.min}–$${filters.price.max}`);
  } else if (filters.price?.max != null) {
    parts.push(`under $${filters.price.max}`);
  } else if (filters.price?.min != null) {
    parts.push(`over $${filters.price.min}`);
  }

  if (!parts.length) return 'Here are some options you might like.';
  return `Here are picks ${parts.join(' ')}.`;
}

/**
 * Produce quick replies (chips) that the UI can show to speed up clarifications.
 */
function generateQuickReplies(filters = {}, intent = {}, complements = []) {
  const replies = [];

  // Budget chips
  if (!filters.price?.max) {
    replies.push('Under $50', 'Under $100', 'Under $150', 'Under $200');
  }

  // Season chips
  if (!filters.season?.length) {
    replies.push('Spring', 'Summer', 'Fall', 'Winter');
  }

  // Color chips
  if (!filters.colors?.length) {
    replies.push('Black', 'Navy', 'Beige', 'Pastel');
  }

  // Complementary categories prompt
  if (complements?.length) {
    replies.push(`Show ${complements[0]}`);
  }

  // Basic category prompts if nothing specified yet
  if (!filters.include_categories?.length) {
    replies.push('Dresses', 'Tops', 'Pants', 'Shoes', 'Accessories');
  }

  // Deduplicate while preserving order
  const seen = new Set();
  const unique = [];
  for (const r of replies) {
    const key = r.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  }
  return unique.slice(0, 8);
}

/**
 * Given the user's message and previous session state, plan the assistant reply.
 * prevState: { activeFilters?: FilterPayload, messages?: [] }
 *
 * Returns:
 * {
 *   message: string,
 *   filters: FilterPayload,
 *   applyFilters: boolean,
 *   meta: {
 *     missing: string[],                // which slots are missing (event flow)
 *     complements?: string[],           // suggested complementary categories
 *     quickReplies?: string[],          // optional chips
 *     cleared?: boolean                 // true if filters were cleared by user command
 *   }
 * }
 */
export function planReply(userText, prevState = {}) {
  const text = (userText || '').trim();

  // Commands: clear/reset filters
  if (/\b(clear|reset)\s+(filters|all)\b/i.test(text)) {
    const msg = 'Okay, I cleared all filters. What are you looking for now?';
    const meta = { missing: [], cleared: true, quickReplies: ['Dresses', 'Tops', 'Pants', 'Shoes', 'Accessories'] };
    return {
      message: msg,
      filters: {}, // clear
      applyFilters: true,
      meta
    };
  }

  // Extract new info from text
  const { filters: extracted, intent } = extractFiltersFromText(text);

  // Merge with existing session active filters (if any)
  const current = prevState?.activeFilters || {};
  const merged = mergeFilters(current, extracted);

  // Event slot-filling: ask for missing info when user intent is an event (e.g., wedding)
  const REQUIRED_SLOTS_FOR_EVENT = ['season', 'colors', 'price.max'];
  const missing = [];

  if (intent.isEventFlow) {
    for (const slot of REQUIRED_SLOTS_FOR_EVENT) {
      if (!has(merged, slot)) missing.push(slot);
    }
  }

  let message;
  let applyFilters = true;

  if (intent.isEventFlow && missing.length > 0) {
    const qs = [];
    if (!has(merged, 'season')) qs.push('Is the event in spring, summer, fall, or winter?');
    if (!has(merged, 'colors')) qs.push('Any preferred colors (or colors to avoid)?');
    if (!has(merged, 'price.max')) qs.push('Do you have a maximum budget?');

    message = `Got it—an event look. To tailor picks, a few details: ${qs.join(' ')}`;
    applyFilters = false; // wait for clarifications before applying
  } else {
    // Build summary message
    message = summarizeFilters(merged);
  }

  // Complementary categories suggestion for "complete the look"
  let complements = [];
  const primCats = merged.include_categories || [];
  if (primCats.length) {
    complements = complementCategories(primCats);
  } else if (/\boutfit|complete the look|match with|pair with\b/i.test(text)) {
    // If user mentions outfit but no primary category, default complements to accessories
    complements = ['accessories'];
  }

  // Quick replies
  const quickReplies = generateQuickReplies(merged, intent, complements);

  return {
    message,
    filters: merged,
    applyFilters,
    meta: {
      missing,
      complements,
      quickReplies
    }
  };
}

/**
 * Optional: a convenience function to build a "filters payload"
 * directly from a single user message, without needing prev state.
 * This is useful for stateless trials or one-off calls.
 */
export function singleTurnReply(userText) {
  return planReply(userText, { activeFilters: {} });
}