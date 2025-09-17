import mongoose from 'mongoose';

const toCSVArray = (v) => {
if (v === undefined || v === null || v === '') return undefined;
if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
if (typeof v === 'string') {
return v
.split(',')
.map((s) => s.trim())
.filter(Boolean);
}
return [String(v).trim()].filter(Boolean);
};

const toNumber = (v) => {
if (v === undefined || v === null || v === '') return undefined;
const n = Number(v);
return Number.isFinite(n) ? n : undefined;
};

const toBoolean = (v) => {
if (typeof v === 'boolean') return v;
if (v === undefined || v === null || v === '') return undefined;
const s = String(v).toLowerCase().trim();
if (['true', '1', 'yes'].includes(s)) return true;
if (['false', '0', 'no'].includes(s)) return false;
return undefined;
};

const toObjectId = (v) => {
if (v === undefined || v === null || v === '') return undefined;
const s = String(v).trim();
if (mongoose.Types.ObjectId.isValid(s)) return new mongoose.Types.ObjectId(s);
return undefined;
};

const toObjectIdArray = (v) => {
const arr = toCSVArray(v);
if (!arr) return undefined;
const out = arr.map((x) => toObjectId(x)).filter((x) => !!x);
return out.length ? out : undefined;
};

const coerceArray = (v) => {
const arr = toCSVArray(v);
return arr && arr.length ? arr : undefined;
};

function pickSort(sort, hasQuery) {
const allowed = new Set(['relevance', 'price_asc', 'price_desc', 'newest']);
const s = String(sort || '').toLowerCase();
if (allowed.has(s)) return s;
return hasQuery ? 'relevance' : 'newest';
}

function sanitizePage(v) {
const n = toNumber(v);
if (!n || n < 1) return 1;
return Math.floor(n);
}

function sanitizeLimit(v) {
const n = toNumber(v);
if (!n || n < 1) return 24;
const cap = 100;
return Math.min(Math.floor(n), cap);
}

/**
Normalize filters from either req.query (strings) or chatbot JSON payload.
Produces a consistent camelCase object with coerced types.
*/
export function normalizeFilters(input = {}) {
const q = input || {};
// Text
const text = q.q ?? q.query ?? q.text;

// Categories
const categoryIdSingle = q.categoryId ?? q.category_id ?? undefined;
const categoryIdsMany = q.categoryIds ?? q.category_ids ?? undefined;

const categoryIds =
toObjectIdArray(categoryIdsMany) ||
(toObjectId(categoryIdSingle) ? [toObjectId(categoryIdSingle)] : undefined);

// Include categories (names/slugs) – mapping to IDs should happen upstream or later
const includeCategories = coerceArray(q.include_categories ?? q.includeCategories);

// Simple multi-value filters
const brand = coerceArray(q.brand ?? q.brands);
const colors = coerceArray(q.colors ?? q.color);
const sizes = coerceArray(q.sizes ?? q.size);
const material = coerceArray(q.material ?? q.materials);
const pattern = coerceArray(q.pattern ?? q.patterns);
const silhouette = coerceArray(q.silhouette ?? q.silhouettes);
const fit = coerceArray(q.fit ?? q.fits);
const occasion = coerceArray(q.occasion ?? q.occasions);
const season = coerceArray(q.season ?? q.seasons);

// Price object (numbers)
const priceObj = q.price || {};
const priceMin =
toNumber(priceObj.min) ??
toNumber(q.price_min) ??
toNumber(q.min_price) ??
toNumber(q.minPrice) ??
toNumber(q.priceMin);

const priceMax =
toNumber(priceObj.max) ??
toNumber(q.price_max) ??
toNumber(q.max_price) ??
toNumber(q.maxPrice) ??
toNumber(q.priceMax);

const price =
priceMin !== undefined || priceMax !== undefined
? {
...(priceMin !== undefined ? { min: priceMin } : {}),
...(priceMax !== undefined ? { max: priceMax } : {}),
}
: undefined;

// In-stock
const inStock = toBoolean(q.in_stock ?? q.inStock);

// Sort + paging
const sort = pickSort(q.sort, !!(text && String(text).trim()));
const page = sanitizePage(q.page);
const limit = sanitizeLimit(q.limit);

return {
q: text && String(text).trim() ? String(text).trim() : undefined,
categoryIds,
includeCategories,
brand,
colors,
sizes,
material,
pattern,
silhouette,
fit,
occasion,
season,
price,
inStock,
sort,
page,
limit,
};
}

/**
Build a MongoDB aggregation pipeline from normalized filters.
*/
export function buildAggregationFromFilters(filters, options = {}) {
const {
q,
categoryIds,
// includeCategories are names/slugs; map to IDs upstream if needed
brand,
colors,
sizes,
material,
pattern,
silhouette,
fit,
occasion,
season,
price,
inStock,
sort,
page,
limit,
} = filters;

const { projectFields } = options || {};

const pipeline = [];

// 1) Product-level match const match = {}; if (categoryIds?.length) match.categoryId = { in: categoryIds };

const addInMatch = (field, arr) => {
if (arr?.length) match[field] = { $in: arr };
};

addInMatch('brand', brand);
addInMatch('material', material);
addInMatch('pattern', pattern);
addInMatch('silhouette', silhouette);
addInMatch('fit', fit);
addInMatch('occasion', occasion);
addInMatch('season', season);

if (Object.keys(match).length) {
pipeline.push({ $match: match });
}

// 2) Text search (optional)
if (q) {
pipeline.push({ match: { text: { search: q } } }); pipeline.push({ addFields: { textScore: { $meta: 'textScore' } } });
}

// 3) Variant/size/in-stock filters
const needVariantFilter = Boolean(colors?.length || sizes?.length || inStock === true);

if (needVariantFilter) {
const variantElem = {};

text
if (colors?.length) {
  variantElem.color = { $in: colors };
}

const sizeElem = {};
if (sizes?.length) sizeElem.sizeLabel = { $in: sizes };
if (inStock === true) sizeElem.stockQty = { $gt: 0 };

if (Object.keys(sizeElem).length) {
  variantElem.sizes = { $elemMatch: sizeElem };
}

if (Object.keys(variantElem).length) {
  pipeline.push({ $match: { variants: { $elemMatch: variantElem } } });
} else if (inStock === true) {
  pipeline.push({ $match: { 'variants.sizes.stockQty': { $gt: 0 } } });
}
}

// 4) Effective minPrice computation across variants/sizes (only when needed)
const needsPriceStage =
(price && (price.min !== undefined || price.max !== undefined)) ||
sort === 'price_asc' ||
sort === 'price_desc';

if (needsPriceStage) {
pipeline.push(
{
addFields: { _allSizes: { reduce: {
input: { 

ifNull:[ 'variants', []] },
initialValue: [],
in: {
concatArrays: ['$$value', { ifNull: ['this.sizes', []] }], }, }, }, }, }, { $addFields: { _candidatePrices: { $concatArrays: [ [{ $ifNull: ['$basePrice', null] }], { $map: { input: '$_allSizes', as: 'sz', in: { $ifNull: ['sz.priceOverride', 'basePrice'] }, }, }, ], }, }, }, { addFields: {
minPrice: {
min: { filter: {
input: '_candidatePrices', as: 'p', cond: { ne: ['$$p', null] },
},
},
},
},
},
{ $project: { _allSizes: 0, _candidatePrices: 0 } }
);
}

// 5) Price match using minPrice if (price && (price.min !== undefined || price.max !== undefined)) { const priceCond = {}; if (price.min !== undefined) priceCond.gte = price.min;
if (price.max !== undefined) priceCond.lte = price.max; pipeline.push({ match: { minPrice: priceCond } });


// 6) Sorting
if (sort === 'relevance' && q) {
pipeline.push({ sort: { textScore: -1, createdAt: -1 } }); } else if (sort === 'price_asc') { pipeline.push({ sort: { minPrice: 1, createdAt: -1 } });
} else if (sort === 'price_desc') {
pipeline.push({ sort: { minPrice: -1, createdAt: -1 } }); } else { pipeline.push({ sort: { createdAt: -1 } });
}

// 7) Pagination
const skip = Math.max(0, (page - 1) * limit);
pipeline.push({ skip: skip }, { limit: limit });

// Optional projection of fields
if (projectFields) {
pipeline.push({ $project: projectFields });
}

return { pipeline };
}