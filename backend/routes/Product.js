// const express=require('express')
// const productController=require("../controllers/Product")
// const router=express.Router()

// router
//     .post("/",productController.create)
//     .get("/",productController.getAll)
//     .get("/:id",productController.getById)
//     .patch("/:id",productController.updateById)
//     .patch("/undelete/:id",productController.undeleteById)
//     .delete("/:id",productController.deleteById)

// module.exports=router






const express = require('express');
const productController = require('../controllers/Product');
const Category = require('../models/Category');
const { resolveIncludeCategoriesToIds } = require('../utils/categoryHelpers');

const router = express.Router();

async function resolveIncludeCategoriesMw(req, res, next) {
try {
const include =
req.query.include_categories ??
req.query.includeCategories;
if (!include) return next();

text
const includeArr = Array.isArray(include)
  ? include
  : String(include).split(',').map(s => s.trim()).filter(Boolean);

const ids = await resolveIncludeCategoriesToIds(includeArr, Category);

if (ids.length) {
  const existing = req.query.categoryIds ?? req.query.category_ids;
  const existingArr = existing
    ? (Array.isArray(existing) ? existing : String(existing).split(',').map(s => s.trim()).filter(Boolean))
    : [];
  const merged = Array.from(new Set([...existingArr, ...ids.map(String)]));
  req.query.categoryIds = merged.join(','); // so normalizeFilters can parse it
}

delete req.query.include_categories;
delete req.query.includeCategories;

next();
} catch (err) {
next(err);
}
}

router.post('/', productController.create);
router.get('/', resolveIncludeCategoriesMw, productController.getAll);
router.get('/:id', productController.getById);
router.patch('/:id', productController.updateById);
router.patch('/undelete/:id', productController.undeleteById);
router.delete('/:id', productController.deleteById);

module.exports = router;






import { resolveIncludeCategoriesToIds } from '../utils/categoryHelpers.js';

router.get('/', async (req, res, next) => {
try {
const filters = normalizeFilters(req.query);

text
if (filters.includeCategories?.length) {
  const ids = await resolveIncludeCategoriesToIds(filters.includeCategories, Category);
  if (ids.length) {
    const existing = filters.categoryIds || [];
    filters.categoryIds = Array.from(new Set([...existing, ...ids]));
  }
  delete filters.includeCategories; // optional
}

const { pipeline } = buildAggregationFromFilters(filters, { projectFields: {/* your fields */} });
const items = await Product.aggregate(pipeline);
res.json({ items, page: filters.page, limit: filters.limit });
} catch (e) {
next(e);
}
});