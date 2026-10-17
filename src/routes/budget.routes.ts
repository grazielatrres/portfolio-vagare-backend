import { Router } from 'express';
import { budgetController } from '../controllers/budget.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const budgetRoutes = Router({ mergeParams: true });

budgetRoutes.use(authMiddleware);

budgetRoutes.get('/', (req, res, next) => budgetController.get(req, res, next));

export { budgetRoutes };
