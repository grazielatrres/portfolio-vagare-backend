import { Router } from 'express';
import { activityController } from '../controllers/activity.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const activityRoutes = Router({ mergeParams: true });

activityRoutes.use(authMiddleware);

activityRoutes.get('/', (req, res, next) => activityController.list(req, res, next));
activityRoutes.post('/', (req, res, next) => activityController.create(req, res, next));
activityRoutes.delete('/:id', (req, res, next) => activityController.delete(req, res, next));

export { activityRoutes };
