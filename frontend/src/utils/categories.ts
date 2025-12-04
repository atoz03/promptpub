import type { CategoryNode } from '../types/api';

export interface CategoryOption extends CategoryNode {
  level: number;
}

export function flattenCategoryTree(
  categories: CategoryNode[],
  level = 0,
  excludeId?: string
): CategoryOption[] {
  return categories.flatMap((category) => {
    if (excludeId && category.id === excludeId) {
      return [];
    }

    const current: CategoryOption = {
      ...category,
      level,
    };

    const children = category.children
      ? flattenCategoryTree(category.children, level + 1, excludeId)
      : [];

    return [current, ...children];
  });
}
