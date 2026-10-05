/**
 * Menu Service
 */
import { MenuRepository } from '../repositories/menuRepository.ts';
import { MenuCategory, MenuItem } from '../types/index.ts';

export interface MenuFilterParams {
  category?: string;
  search?: string;
  vegetarian?: boolean;
  spicy?: boolean;
  maxPrice?: number;
  sortBy?: 'name' | 'price_asc' | 'price_desc' | 'popular';
}

export class MenuService {
  public static async getCategories(): Promise<MenuCategory[]> {
    const cats = await MenuRepository.getAllCategories();
    return cats.filter((c) => c.status === 'ACTIVE');
  }

  public static async getMenuItems(params: MenuFilterParams = {}): Promise<MenuItem[]> {
    let items = await MenuRepository.getAllItems();

    // Filter by Category
    if (params.category && params.category !== 'all') {
      items = items.filter(
        (i) => i.categoryId === params.category || i.categoryName?.toLowerCase() === params.category?.toLowerCase()
      );
    }

    // Search query
    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.categoryName?.toLowerCase().includes(q)
      );
    }

    // Dietary Filter
    if (params.vegetarian !== undefined) {
      items = items.filter((i) => i.vegetarian === params.vegetarian);
    }

    // Spicy Filter
    if (params.spicy !== undefined) {
      items = items.filter((i) => i.spicy === params.spicy);
    }

    // Max Price
    const maxPrice = params.maxPrice;
    if (maxPrice !== undefined && maxPrice > 0) {
      items = items.filter((i) => i.price <= maxPrice);
    }

    // Sorting
    if (params.sortBy) {
      switch (params.sortBy) {
        case 'price_asc':
          items.sort((a, b) => a.price - b.price);
          break;
        case 'price_desc':
          items.sort((a, b) => b.price - a.price);
          break;
        case 'name':
          items.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'popular':
        default:
          items.sort((a, b) => (b.isChefSpecial ? 1 : 0) - (a.isChefSpecial ? 1 : 0));
          break;
      }
    }

    return items;
  }

  public static async getItemById(id: string): Promise<MenuItem> {
    const item = await MenuRepository.getItemById(id);
    if (!item) {
      throw new Error('Menu item not found.');
    }
    return item;
  }
}
