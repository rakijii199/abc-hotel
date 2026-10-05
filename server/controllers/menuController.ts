/**
 * Menu and Table Controllers
 */
import { Request, Response } from 'express';
import { MenuService } from '../services/menuService.ts';
import { BookingService } from '../services/bookingService.ts';
import { TableRepository, RestaurantRepository } from '../repositories/tableRepository.ts';

export class MenuController {
  public static async getCategories(_req: Request, res: Response): Promise<void> {
    try {
      const categories = await MenuService.getCategories();
      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  public static async getMenuItems(req: Request, res: Response): Promise<void> {
    try {
      const { category, search, vegetarian, spicy, maxPrice, sortBy } = req.query;

      const items = await MenuService.getMenuItems({
        category: category ? String(category) : undefined,
        search: search ? String(search) : undefined,
        vegetarian: vegetarian !== undefined ? vegetarian === 'true' : undefined,
        spicy: spicy !== undefined ? spicy === 'true' : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        sortBy: sortBy as any
      });

      res.status(200).json({
        success: true,
        data: items
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  public static async getItemById(req: Request, res: Response): Promise<void> {
    try {
      const item = await MenuService.getItemById(req.params.id);
      res.status(200).json({
        success: true,
        data: item
      });
    } catch (err: any) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message }
      });
    }
  }
}

export class TableController {
  public static async getAllTables(_req: Request, res: Response): Promise<void> {
    try {
      const tables = TableRepository.getAll();
      const hotel = RestaurantRepository.getHotel();
      const restaurant = RestaurantRepository.getRestaurant();

      res.status(200).json({
        success: true,
        data: {
          tables,
          restaurant,
          hotel
        }
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  public static async checkAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { bookingDate, startTime, guestCount } = req.query;

      if (!bookingDate || !startTime || !guestCount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMS',
            message: 'bookingDate, startTime, and guestCount query parameters are required.'
          }
        });
        return;
      }

      const result = BookingService.getTableAvailability({
        bookingDate: String(bookingDate),
        startTime: String(startTime),
        guestCount: Number(guestCount)
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'AVAILABILITY_CHECK_FAILED', message: err.message }
      });
    }
  }
}
