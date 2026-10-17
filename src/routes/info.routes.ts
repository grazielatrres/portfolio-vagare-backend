import { Router } from 'express';
import { infoController } from '../controllers/info.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const infoRoutes = Router({ mergeParams: true });

infoRoutes.use(authMiddleware);

infoRoutes.get('/', (req, res, next) => infoController.list(req, res, next));
infoRoutes.post('/', (req, res, next) => infoController.create(req, res, next));
infoRoutes.put('/:id', (req, res, next) => infoController.update(req, res, next));
infoRoutes.delete('/:id', (req, res, next) => infoController.delete(req, res, next));

export { infoRoutes };
