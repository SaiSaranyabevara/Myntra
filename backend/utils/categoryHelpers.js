import Category from "../models/Category";

export async function resolveIncludeCategoriesToIds(includeCategories, CategoryModel) {
if (!includeCategories?.length) return [];
const rows = await Category.find(
{ or: [{ slug: { in: includeCategories } }, { name: { $in: includeCategories } }] },
{ _id: 1 }
).lean();
return rows.map(r => r._id);
}