export function categoryToSlug(category: string) {
  return category.toLowerCase().replace(/[^a-z0-9]/g, "");
}
