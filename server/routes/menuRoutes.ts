/**
 * Menu and Table Routes
 */
import { Router } from 'express';
import { MenuController, TableController } from '../controllers/menuController.ts';

export const menuRouter = Router();

menuRouter.get('/categories', MenuController.getCategories);
menuRouter.get('/', MenuController.getMenuItems);
menuRouter.get('/:id', MenuController.getItemById);

export const tableRouter = Router();

tableRouter.get('/', TableController.getAllTables);
tableRouter.get('/availability', TableController.checkAvailability);
