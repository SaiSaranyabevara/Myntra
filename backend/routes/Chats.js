// const express = require('express');
// const router = express.Router();

// // Optional: simple in-memory sessions (replace with Mongo/Redis in prod)
// const sessions = new Map();

// // Stub: replace with your real NLP/LLM-based extractor
// async function extractFiltersFromText(text) {
// // Return structure that your frontend and product route expect
// // Fill only what you can extract; the PLP will handle the rest.
// // This is a placeholder. Integrate your LLM here.
// const lc = (text || '').toLowerCase();
// const filters = {};

// // naive examples:
// if (lc.includes('wedding')) filters.occasion = ['wedding'];
// if (lc.includes('summer')) filters.season = ['summer'];
// if (lc.includes('pastel')) filters.colors = ['pastel-pink', 'pastel-blue'];
// const priceMatch = lc.match(/$(\d{2,4})/); // FIXED regex
// if (priceMatch) filters.price = { max: Number(priceMatch[1]) };
// if (lc.includes('dress') || lc.includes('dresses')) filters.include_categories = ['dresses'];
// // you can expand this with size, brand, etc.

// const reply = 'Got it — applying your filters.';
// return { message: reply, filters, applyFilters: true };
// }

// // Optional: merge new filters into existing session filters
// function mergeFilters(oldF = {}, newF = {}) {
// const out = { ...oldF };

// const union = (a, b) => Array.from(new Set([...(a || []), ...(b || [])]));
// const setIf = (key) => {
// if (newF[key] !== undefined) out[key] = newF[key];
// };
// const unionIf = (key) => {
// if (newF[key]?.length) out[key] = union(out[key], newF[key]);
// };

// // arrays to union
// ['brand', 'colors', 'sizes', 'material', 'pattern', 'silhouette', 'fit', 'occasion', 'season', 'include_categories'].forEach(unionIf);

// // price: keep min/max if supplied
// if (newF.price) {
// out.price = out.price || {};
// if (newF.price.min !== undefined) out.price.min = newF.price.min;
// if (newF.price.max !== undefined) out.price.max = newF.price.max;
// }

// // booleans/strings
// setIf('in_stock');
// setIf('q');
// setIf('sort');

// // categoryIds (rare from chat, usually mapped later)
// if (newF.categoryIds?.length) {
// out.categoryIds = union(out.categoryIds, newF.categoryIds);
// }
// return out;
// }

// // Create a chat session
// router.post('/sessions', async (req, res, next) => {
// try {
// const id = String(Date.now()) + Math.random().toString(36).slice(2, 8);
// sessions.set(id, { id, createdAt: new Date(), messages: [], filters: {} });
// res.json({ id });
// } catch (e) {
// next(e);
// }
// });

// // Get a session (optional)
// router.get('/sessions/:id', async (req, res, next) => {
// try {
// const s = sessions.get(req.params.id);
// if (!s) return res.status(404).json({ error: 'Not found' });
// res.json(s);
// } catch (e) {
// next(e);
// }
// });

// // Post a message: extract filters and return them to frontend
// router.post('/sessions/:id/message', async (req, res, next) => {
// try {
// const { text, currentFilters } = req.body || {};
// let session = sessions.get(req.params.id);

// text
// // If you don’t want server-side sessions, skip this and rely on currentFilters from client
// if (!session) {
//   session = { id: req.params.id, createdAt: new Date(), messages: [], filters: {} };
//   sessions.set(req.params.id, session);
// }

// // Call your extractor (replace stub with LLM integration)
// const { message, filters: extractedFilters, applyFilters } = await extractFiltersFromText(text);

// // Merge with session or client-provided filters
// const baseFilters = currentFilters || session.filters || {};
// const mergedFilters = mergeFilters(baseFilters, extractedFilters);

// // Save minimal history (optional)
// session.messages.push({ role: 'user', text, ts: new Date() });
// session.messages.push({ role: 'assistant', text: message, ts: new Date() });
// session.filters = mergedFilters;

// // Return to frontend. Frontend will call GET /products with mergedFilters
// res.json({
//   message,
//   filters: extractedFilters,
//   mergedFilters,
//   applyFilters: applyFilters !== false, // default true
// });
// } catch (e) {
// next(e);
// }
// });

// module.exports = router;





const express = require('express');
const router = express.Router();

const sessions = new Map();

async function extractFiltersFromText(text) {
const lc = (text || '').toLowerCase();
const filters = {};
if (lc.includes('wedding')) filters.occasion = ['wedding'];
if (lc.includes('summer')) filters.season = ['summer'];
if (lc.includes('pastel')) filters.colors = ['pastel-pink', 'pastel-blue'];
const priceMatch = lc.match(/$(\d{2,4})/); // escape $
if (priceMatch) filters.price = { max: Number(priceMatch[1]) };
if (lc.includes('dress') || lc.includes('dresses')) filters.include_categories = ['dresses'];
return { message: 'Got it — applying your filters.', filters, applyFilters: true };
}

function mergeFilters(oldF = {}, newF = {}) {
const out = { ...oldF };
const union = (a, b) => Array.from(new Set([...(a || []), ...(b || [])]));
const setIf = (k) => { if (newF[k] !== undefined) out[k] = newF[k]; };
const unionIf = (k) => { if (newF[k]?.length) out[k] = union(out[k], newF[k]); };
['brand','colors','sizes','material','pattern','silhouette','fit','occasion','season','include_categories'].forEach(unionIf);
if (newF.price) {
out.price = out.price || {};
if (newF.price.min !== undefined) out.price.min = newF.price.min;
if (newF.price.max !== undefined) out.price.max = newF.price.max;
}
setIf('in_stock'); setIf('q'); setIf('sort');
if (newF.categoryIds?.length) out.categoryIds = union(out.categoryIds, newF.categoryIds);
return out;
}

router.post('/sessions', async (req, res, next) => {
try {
const id = String(Date.now()) + Math.random().toString(36).slice(2, 8);
sessions.set(id, { id, createdAt: new Date(), messages: [], filters: {} });
res.json({ id });
} catch (e) { next(e); }
});

router.get('/sessions/:id', async (req, res, next) => {
try {
const s = sessions.get(req.params.id);
if (!s) return res.status(404).json({ error: 'Not found' });
res.json(s);
} catch (e) { next(e); }
});

router.post('/sessions/:id/message', async (req, res, next) => {
try {
const { text, currentFilters } = req.body || {};
let session = sessions.get(req.params.id);
if (!session) {
session = { id: req.params.id, createdAt: new Date(), messages: [], filters: {} };
sessions.set(req.params.id, session);
}
const { message, filters: extractedFilters, applyFilters } = await extractFiltersFromText(text);
const baseFilters = currentFilters || session.filters || {};
const mergedFilters = mergeFilters(baseFilters, extractedFilters);
session.messages.push({ role: 'user', text, ts: new Date() });
session.messages.push({ role: 'assistant', text: message, ts: new Date() });
session.filters = mergedFilters;
res.json({ message, filters: extractedFilters, mergedFilters, applyFilters: applyFilters !== false });
} catch (e) { next(e); }
});

module.exports = router;