import { Router } from 'express';
import { tripController } from '../controllers/trip.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const tripRoutes = Router();

tripRoutes.use(authMiddleware);

tripRoutes.post('/', (req, res, next) => tripController.create(req, res, next));
tripRoutes.get('/', (req, res, next) => tripController.list(req, res, next));
tripRoutes.get('/:id', (req, res, next) => tripController.getById(req, res, next));
tripRoutes.put('/:id', (req, res, next) => tripController.update(req, res, next));
tripRoutes.delete('/:id', (req, res, next) => tripController.delete(req, res, next));

export { tripRoutes };
