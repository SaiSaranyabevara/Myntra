// // server/src/services/intent.js

// export const TAXONOMY = {
//   colors: [
//     'black','white','ivory','cream','beige','tan','brown','grey','gray','charcoal',
//     'navy','blue','light-blue','teal','green','olive',
//     'red','burgundy','pink','blush','rose','purple',
//     'yellow','mustard','orange','coral',
//     'gold','silver','metallic',
//     'pastel-pink','pastel-blue','pastel-green','pastel-purple','pastel-yellow'
//   ],
//   categories: {
//     dresses: ['dress','dresses','gown','maxi','midi','mini','slip dress','evening gown'],
//     tops: ['top','tops','shirt','blouse','tee','t-shirt','sweater','hoodie','camisole','tank','polo'],
//     pants: ['pants','trousers','jeans','denim','chinos','slacks','leggings'],
//     skirts: ['skirt','skirts'],
//     shoes: ['shoes','heels','pumps','sandals','sneakers','boots','booties','flats'],
//     accessories: ['accessory','accessories','bag','belt','hat','jewelry','earrings','necklace','bracelet','scarf','clutch'],
//     outerwear: ['jacket','coat','blazer','cardigan','trench','parka']
//   },
//   occasion: [
//     'wedding','bridesmaid','black tie','black-tie','formal','cocktail','party',
//     'work','office','business','casual','vacation','beach','date night','date-night','graduation'
//   ],
//   season: ['spring','summer','fall','autumn','winter'],
//   fit: ['slim','regular','relaxed','oversized','tailored','bodycon'],
//   silhouette: ['a-line','aline','wrap','sheath','fit-and-flare','fit & flare','mermaid','bodycon','shift','straight','wide-leg','bootcut','skinny'],
//   pattern: ['solid','striped','stripes','floral','checked','check','plaid','polka','polka dots','dots','animal','leopard','houndstooth'],
//   material: ['cotton','silk','satin','linen','denim','knit','wool','leather','chiffon','cashmere','polyester']
// };

// // -------------------- helpers --------------------

// const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
// const escapeReg = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// const findAny = (text, list) => {
//   const hits = [];
//   for (const item of list) {
//     const re = new RegExp(`\\b${escapeReg(item)}\\b`, 'i');
//     if (re.test(text)) hits.push(item);
//   }
//   return Array.from(new Set(hits));
// };

// const findFromMap = (text, map) => {
//   const hits = [];
//   for (const [key, words] of Object.entries(map)) {
//     for (const w of words) {
//       const re = new RegExp(`\\b${escapeReg(w)}\\b`, 'i');
//       if (re.test(text)) {
//         hits.push(key);
//         break;
//       }
//     }
//   }
//   return Array.from(new Set(hits));
// };

// // Parse sizes from text
// const SIZE_WORDS = [
//   { re: /\b(x{1,2}[-\s]?small|xs|xxs)\b/i, out: 'XS' },
//   { re: /\b(small|^s$)\b/i, out: 'S' },
//   { re: /\b(medium|^m$)\b/i, out: 'M' },
//   { re: /\b(large|^l$)\b/i, out: 'L' },
//   { re: /\b(x{1,2}[-\s]?large|xl|xxl)\b/i, out: 'XL' }
// ];
// function parseSizes(text) {
//   const found = new Set();
//   for (const rule of SIZE_WORDS) if (rule.re.test(text)) found.add(rule.out);
//   for (const m of text.matchAll(/\b(size\s*)?(\d{1,2})(\s*(us|eu|uk))?\b/gi)) found.add(String(m[2]));
//   return Array.from(found);
// }

// // Parse budget from text
// function parseBudget(text) {
//   const t = normalize(text);
//   const between = t.match(/between\s*\$?(\d+)\s*(and|to|-)\s*\$?(\d+)/i);
//   if (between) {
//     const min = Number(between[1]); const max = Number(between[3]);
//     if (!Number.isNaN(min) && !Number.isNaN(max)) return { min, max };
//   }
//   const under = t.match(/(under|below|less than|<=|≤)\s*\$?(\d+)/i);
//   if (under) {
//     const max = Number(under[2]);
//     if (!Number.isNaN(max)) return { max };
//   }
//   const maxOnly = t.match(/\b(max|max\.|up to|budget|no more than)\s*\$?(\d+)/i);
//   if (maxOnly) {
//     const max = Number(maxOnly[2]);
//     if (!Number.isNaN(max)) return { max };
//   }
//   const around = t.match(/\baround\s*\$?(\d+)/i);
//   if (around) {
//     const approx = Number(around[1]);
//     if (!Number.isNaN(approx)) return { min: Math.max(0, approx - 20), max: approx + 20 };
//   }
//   return {};
// }

// // Parse brands (uses optional known brands list)
// function parseBrand(text, knownBrands = []) {
//   const found = new Set();
//   for (const b of knownBrands) {
//     const re = new RegExp(`\\b${escapeReg(b)}\\b`, 'i');
//     if (re.test(text)) found.add(b);
//   }
//   const by = text.match(/\b(by|from)\s+([A-Za-z0-9&\-'. ]{2,})\b/);
//   if (by && !found.size) {
//     const guess = by[2].trim();
//     if (guess.length <= 40) found.add(guess);
//   }
//   return Array.from(found);
// }

// // Canonical color mapping
// function canonColor(c) {
//   const t = c.toLowerCase();
//   if (t === 'gray') return 'grey';
//   if (t === 'light blue') return 'light-blue';
//   return t;
// }

// // Pastel handling: if "pastel" appears, ensure a full pastel palette is included
// function pastelFallback(colors) {
//   const joined = colors.join(' ');
//   if (/\bpastel(s)?\b/i.test(joined)) {
//     const palette = ['pastel-pink','pastel-blue','pastel-green','pastel-purple','pastel-yellow'];
//     const existing = colors.filter((c) => c.startsWith('pastel-'));
//     return Array.from(new Set([...existing, ...palette]));
//   }
//   return colors;
// }

// // Normalize attributes to canonical values
// function normalizeAttributes(attrs) {
//   const out = { ...attrs };
//   if (out.colors?.length) out.colors = out.colors.map(canonColor);
//   if (out.occasion?.length) {
//     out.occasion = out.occasion.map((s) => s.replace(/black[-\s]?tie/i, 'formal').replace(/date[-\s]?night/i, 'date night'));
//   }
//   if (out.season?.length) out.season = out.season.map((s) => (s.toLowerCase() === 'autumn' ? 'fall' : s));
//   if (out.silhouette?.length) out.silhouette = out.silhouette.map((s) => (s.toLowerCase() === 'aline' ? 'a-line' : s));
//   if (out.pattern?.length) {
//     out.pattern = out.pattern.map((s) => {
//       const t = s.toLowerCase();
//       if (t === 'stripes') return 'striped';
//       if (t === 'polka dots' || t === 'dots') return 'polka';
//       if (t === 'checked') return 'check';
//       return s;
//     });
//   }
//   if (out.colors?.length) out.colors = pastelFallback(out.colors);
//   return out;
// }

// // Remove undefined/empty fields (deep)
// function trimUndefinedDeep(obj) {
//   const copy = Array.isArray(obj) ? obj.slice() : { ...obj };
//   for (const k of Object.keys(copy)) {
//     const v = copy[k];
//     if (v && typeof v === 'object' && !Array.isArray(v)) {
//       copy[k] = trimUndefinedDeep(v);
//       if (!Object.keys(copy[k]).length) delete copy[k];
//     } else if (Array.isArray(v)) {
//       copy[k] = v.filter((x) => x != null && x !== '');
//       if (!copy[k].length) delete copy[k];
//     } else if (v == null || v === '') {
//       delete copy[k];
//     }
//   }
//   return copy;
// }

// // -------------------- main exports --------------------

// /**
//  * Extract filters and intent flags from user text.
//  * Returns: { filters, intent }
//  * filters: {
//  *   include_categories?, colors?, sizes?, price?, occasion?, season?, fit?, silhouette?, material?, pattern?, brand?, in_stock: true
//  * }
//  * intent: { isEventFlow: boolean, wantsOutfit: boolean }
//  */
// export function extractFiltersFromText(input, options = {}) {
//   const text = normalize(input || '');
//   if (!text) {
//     return { filters: { in_stock: true }, intent: { isEventFlow: false, wantsOutfit: false } };
//   }

//   const include_categories = findFromMap(text, TAXONOMY.categories);
//   const colors = findAny(text, TAXONOMY.colors);
//   const occasion = findAny(text, TAXONOMY.occasion);
//   const season = findAny(text, TAXONOMY.season);
//   const fit = findAny(text, TAXONOMY.fit);
//   const silhouette = findAny(text, TAXONOMY.silhouette);
//   const pattern = findAny(text, TAXONOMY.pattern);
//   const material = findAny(text, TAXONOMY.material);
//   const sizes = parseSizes(text);
//   const brand = parseBrand(text, options.knownBrands || []);
//   const price = parseBudget(text);

//   const isEventFlow =
//     occasion.includes('wedding') ||
//     /\bwedding|bridesmaid|ceremony|reception|black[-\s]?tie|formal\b/i.test(text);

//   const wantsOutfit = /\boutfit|complete the look|match with|pair with\b/i.test(text);

//   let filters = {
//     include_categories: include_categories.length ? include_categories : undefined,
//     colors: colors.length ? colors : undefined,
//     sizes: sizes.length ? sizes : undefined,
//     price: Object.keys(price).length ? price : undefined,
//     occasion: occasion.length ? occasion : undefined,
//     season: season.length ? season : undefined,
//     fit: fit.length ? fit : undefined,
//     silhouette: silhouette.length ? silhouette : undefined,
//     material: material.length ? material : undefined,
//     pattern: pattern.length ? pattern : undefined,
//     brand: brand.length ? brand : undefined,
//     in_stock: true
//   };

//   filters = normalizeAttributes(filters);
//   filters = trimUndefinedDeep(filters);

//   const intent = { isEventFlow, wantsOutfit };
//   return { filters, intent };
// }

// /**
//  * Suggest complementary categories for "complete the look".
//  * Input: category keys from TAXONOMY.categories (e.g., ['dresses'])
//  */
// export function complementCategories(primaryCats = []) {
//   const set = new Set(primaryCats);
//   if (set.has('tops')) return ['pants','skirts','accessories'];
//   if (set.has('dresses')) return ['shoes','accessories','outerwear'];
//   if (set.has('pants')) return ['tops','accessories'];
//   if (set.has('skirts')) return ['tops','accessories'];
//   if (set.has('shoes')) return ['accessories'];
//   return ['accessories'];
// }

// /**
//  * Map basic image analysis to a filter payload usable by /products.
//  * analysis: { item_type?: string, colors?: string[], pattern?: string, material?: string }
//  */
// export function mapImageAnalysisToFilters(analysis = {}) {
//   const out = {
//     include_categories: undefined,
//     colors: undefined,
//     pattern: undefined,
//     material: undefined,
//     in_stock: true
//   };

//   const type = normalize(analysis.item_type || '');
//   if (type) {
//     if (/dress/.test(type)) out.include_categories = ['dresses'];
//     else if (/(shirt|top|blouse|tee|t-shirt|sweater|hoodie|camisole|tank|polo)/.test(type)) out.include_categories = ['tops'];
//     else if (/(pant|trouser|jean|denim|chino|legging)/.test(type)) out.include_categories = ['pants'];
//     else if (/skirt/.test(type)) out.include_categories = ['skirts'];
//     else if (/(shoe|heel|pump|sandal|sneaker|boot|flat)/.test(type)) out.include_categories = ['shoes'];
//     else if (/(bag|belt|hat|jewel|earring|necklace|bracelet|scarf|clutch)/.test(type)) out.include_categories = ['accessories'];
//     else if (/(jacket|coat|blazer|cardigan|trench|parka)/.test(type)) out.include_categories = ['outerwear'];
//   }

//   if (Array.isArray(analysis.colors) && analysis.colors.length) {
//     out.colors = analysis.colors.map(canonColor);
//   }
//   if (analysis.pattern) out.pattern = [normalize(analysis.pattern)];
//   if (analysis.material) out.material = [normalize(analysis.material)];

//   const normalized = normalizeAttributes(out);
//   return trimUndefinedDeep(normalized);
// }





// server/src/services/intent.js

export const TAXONOMY = {
  colors: [
    'black','white','ivory','cream','beige','tan','brown','grey','gray','charcoal',
    'navy','blue','light-blue','teal','green','olive',
    'red','burgundy','pink','blush','rose','purple',
    'yellow','mustard','orange','coral',
    'gold','silver','metallic',
    'pastel-pink','pastel-blue','pastel-green','pastel-purple','pastel-yellow'
  ],
  categories: {
    dresses: ['dress','dresses','gown','maxi','midi','mini','slip dress','evening gown'],
    tops: ['top','tops','shirt','blouse','tee','t-shirt','sweater','hoodie','camisole','tank','polo'],
    pants: ['pants','trousers','jeans','denim','chinos','slacks','leggings'],
    skirts: ['skirt','skirts'],
    shoes: ['shoes','heels','pumps','sandals','sneakers','boots','booties','flats'],
    accessories: ['accessory','accessories','bag','belt','hat','jewelry','earrings','necklace','bracelet','scarf','clutch'],
    outerwear: ['jacket','coat','blazer','cardigan','trench','parka']
  },
  occasion: [
    'wedding','bridesmaid','black tie','black-tie','formal','cocktail','party',
    'work','office','business','casual','vacation','beach','date night','date-night','graduation'
  ],
  season: ['spring','summer','fall','autumn','winter'],
  fit: ['slim','regular','relaxed','oversized','tailored','bodycon'],
  silhouette: ['a-line','aline','wrap','sheath','fit-and-flare','fit & flare','mermaid','bodycon','shift','straight','wide-leg','bootcut','skinny'],
  pattern: ['solid','striped','stripes','floral','checked','check','plaid','polka','polka dots','dots','animal','leopard','houndstooth'],
  material: ['cotton','silk','satin','linen','denim','knit','wool','leather','chiffon','cashmere','polyester']
};

// -------------------- helpers --------------------

const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const escapeReg = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findAny = (text, list) => {
  const hits = [];
  for (const item of list) {
    const re = new RegExp(`\\b${escapeReg(item)}\\b`, 'i');
    if (re.test(text)) hits.push(item);
  }
  return Array.from(new Set(hits));
};

const findFromMap = (text, map) => {
  const hits = [];
  for (const [key, words] of Object.entries(map)) {
    for (const w of words) {
      const re = new RegExp(`\\b${escapeReg(w)}\\b`, 'i');
      if (re.test(text)) {
        hits.push(key);
        break;
      }
    }
  }
  return Array.from(new Set(hits));
};

// Parse sizes from text
const SIZE_WORDS = [
  { re: /\b(x{1,2}[-\s]?small|xs|xxs)\b/i, out: 'XS' },
  { re: /\b(small|^s$)\b/i, out: 'S' },
  { re: /\b(medium|^m$)\b/i, out: 'M' },
  { re: /\b(large|^l$)\b/i, out: 'L' },
  { re: /\b(x{1,2}[-\s]?large|xl|xxl)\b/i, out: 'XL' }
];
function parseSizes(text) {
  const found = new Set();
  for (const rule of SIZE_WORDS) if (rule.re.test(text)) found.add(rule.out);
  for (const m of text.matchAll(/\b(size\s*)?(\d{1,2})(\s*(us|eu|uk))?\b/gi)) found.add(String(m[2]));
  return Array.from(found);
}

// Parse budget from text
function parseBudget(text) {
  const t = normalize(text);
  const between = t.match(/between\s*\$?(\d+)\s*(and|to|-)\s*\$?(\d+)/i);
  if (between) {
    const min = Number(between[1]); const max = Number(between[3]);
    if (!Number.isNaN(min) && !Number.isNaN(max)) return { min, max };
  }
  const under = t.match(/(under|below|less than|<=|≤)\s*\$?(\d+)/i);
  if (under) {
    const max = Number(under[2]);
    if (!Number.isNaN(max)) return { max };
  }
  const maxOnly = t.match(/\b(max|max\.|up to|budget|no more than)\s*\$?(\d+)/i);
  if (maxOnly) {
    const max = Number(maxOnly[2]);
    if (!Number.isNaN(max)) return { max };
  }
  const around = t.match(/\baround\s*\$?(\d+)/i);
  if (around) {
    const approx = Number(around[1]);
    if (!Number.isNaN(approx)) return { min: Math.max(0, approx - 20), max: approx + 20 };
  }
  return {};
}

// Parse brands (uses optional known brands list)
function parseBrand(text, knownBrands = []) {
  const found = new Set();
  for (const b of knownBrands) {
    const re = new RegExp(`\\b${escapeReg(b)}\\b`, 'i');
    if (re.test(text)) found.add(b);
  }
  const by = text.match(/\b(by|from)\s+([A-Za-z0-9&\-'. ]{2,})\b/);
  if (by && !found.size) {
    const guess = by[2].trim();
    if (guess.length <= 40) found.add(guess);
  }
  return Array.from(found);
}

// Canonical color mapping
function canonColor(c) {
  const t = c.toLowerCase();
  if (t === 'gray') return 'grey';
  if (t === 'light blue') return 'light-blue';
  return t;
}

// Pastel handling: if "pastel" appears, ensure a full pastel palette is included
function pastelFallback(colors) {
  const joined = colors.join(' ');
  if (/\bpastel(s)?\b/i.test(joined)) {
    const palette = ['pastel-pink','pastel-blue','pastel-green','pastel-purple','pastel-yellow'];
    const existing = colors.filter((c) => c.startsWith('pastel-'));
    return Array.from(new Set([...existing, ...palette]));
  }
  return colors;
}

// Normalize attributes to canonical values
function normalizeAttributes(attrs) {
  const out = { ...attrs };
  if (out.colors?.length) out.colors = out.colors.map(canonColor);
  if (out.occasion?.length) {
    out.occasion = out.occasion.map((s) => s.replace(/black[-\s]?tie/i, 'formal').replace(/date[-\s]?night/i, 'date night'));
  }
  if (out.season?.length) out.season = out.season.map((s) => (s.toLowerCase() === 'autumn' ? 'fall' : s));
  if (out.silhouette?.length) out.silhouette = out.silhouette.map((s) => (s.toLowerCase() === 'aline' ? 'a-line' : s));
  if (out.pattern?.length) {
    out.pattern = out.pattern.map((s) => {
      const t = s.toLowerCase();
      if (t === 'stripes') return 'striped';
      if (t === 'polka dots' || t === 'dots') return 'polka';
      if (t === 'checked') return 'check';
      return s;
    });
  }
  if (out.colors?.length) out.colors = pastelFallback(out.colors);
  return out;
}

// Remove undefined/empty fields (deep)
function trimUndefinedDeep(obj) {
  const copy = Array.isArray(obj) ? obj.slice() : { ...obj };
  for (const k of Object.keys(copy)) {
    const v = copy[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      copy[k] = trimUndefinedDeep(v);
      if (!Object.keys(copy[k]).length) delete copy[k];
    } else if (Array.isArray(v)) {
      copy[k] = v.filter((x) => x != null && x !== '');
      if (!copy[k].length) delete copy[k];
    } else if (v == null || v === '') {
      delete copy[k];
    }
  }
  return copy;
}

// -------------------- main exports --------------------

/**
 * Extract filters and intent flags from user text.
 * Returns: { filters, intent }
 * filters: {
 *   include_categories?, colors?, sizes?, price?, occasion?, season?, fit?, silhouette?, material?, pattern?, brand?, in_stock: true
 * }
 * intent: { isEventFlow: boolean, wantsOutfit: boolean }
 */
export function extractFiltersFromText(input, options = {}) {
  const text = normalize(input || '');
  if (!text) {
    return { filters: { in_stock: true }, intent: { isEventFlow: false, wantsOutfit: false } };
  }

  const include_categories = findFromMap(text, TAXONOMY.categories);
  const colors = findAny(text, TAXONOMY.colors);
  const occasion = findAny(text, TAXONOMY.occasion);
  const season = findAny(text, TAXONOMY.season);
  const fit = findAny(text, TAXONOMY.fit);
  const silhouette = findAny(text, TAXONOMY.silhouette);
  const pattern = findAny(text, TAXONOMY.pattern);
  const material = findAny(text, TAXONOMY.material);
  const sizes = parseSizes(text);
  const brand = parseBrand(text, options.knownBrands || []);
  const price = parseBudget(text);

  const isEventFlow =
occasion.includes('wedding') ||
/\bwedding|bridesmaid|ceremony|reception|black[-\s]?tie|formal\b/i.test(text);

const wantsOutfit = /\boutfit|complete the look|match with|pair with\b/i.test(text);

let filters = {
include_categories: include_categories.length ? include_categories : undefined,
colors: colors.length ? colors : undefined,
sizes: sizes.length ? sizes : undefined,
price: Object.keys(price).length ? price : undefined,
occasion: occasion.length ? occasion : undefined,
season: season.length ? season : undefined,
fit: fit.length ? fit : undefined,
silhouette: silhouette.length ? silhouette : undefined,
material: material.length ? material : undefined,
pattern: pattern.length ? pattern : undefined,
brand: brand.length ? brand : undefined,
in_stock: true
};

// Normalize to your canonical values (e.g., "gray" -> "grey", "autumn" -> "fall")
filters = normalizeAttributes(filters);
// Remove empty/undefined fields so the payload is clean
filters = trimUndefinedDeep(filters);

const intent = { isEventFlow, wantsOutfit };
return { filters, intent };
}

export function complementCategories(primaryCats = []) {
const set = new Set(primaryCats);
if (set.has('tops')) return ['pants', 'skirts', 'accessories'];
if (set.has('dresses')) return ['shoes', 'accessories', 'outerwear'];
if (set.has('pants')) return ['tops', 'accessories'];
if (set.has('skirts')) return ['tops', 'accessories'];
if (set.has('shoes')) return ['accessories'];
return ['accessories'];
}

export function mapImageAnalysisToFilters(analysis = {}) {
const norm = (s) => (s || '').toLowerCase().trim();
const out = {
include_categories: undefined,
colors: undefined,
pattern: undefined,
material: undefined,
in_stock: true
};

const type = norm(analysis.item_type);
if (type) {
if (/dress/.test(type)) out.include_categories = ['dresses'];
else if (/(shirt|top|blouse|tee|t-shirt|sweater|hoodie|camisole|tank|polo)/.test(type)) out.include_categories = ['tops'];
else if (/(pant|trouser|jean|denim|chino|legging)/.test(type)) out.include_categories = ['pants'];
else if (/skirt/.test(type)) out.include_categories = ['skirts'];
else if (/(shoe|heel|pump|sandal|sneaker|boot|flat)/.test(type)) out.include_categories = ['shoes'];
else if (/(bag|belt|hat|jewel|earring|necklace|bracelet|scarf|clutch)/.test(type)) out.include_categories = ['accessories'];
else if (/(jacket|coat|blazer|cardigan|trench|parka)/.test(type)) out.include_categories = ['outerwear'];
}

if (Array.isArray(analysis.colors) && analysis.colors.length) {
out.colors = analysis.colors.map((c) => c.toLowerCase());
}
if (analysis.pattern) out.pattern = [norm(analysis.pattern)];
if (analysis.material) out.material = [norm(analysis.material)];

const normalized = normalizeAttributes(out);
return trimUndefinedDeep(normalized);
}