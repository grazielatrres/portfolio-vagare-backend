import { Router } from 'express';
import { weatherController } from '../controllers/weather.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const weatherRoutes = Router({ mergeParams: true });

weatherRoutes.use(authMiddleware);

weatherRoutes.get('/', (req, res, next) => weatherController.list(req, res, next));

export { weatherRoutes };
