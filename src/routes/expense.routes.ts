import { Router } from 'express';
import { expenseController } from '../controllers/expense.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const expenseRoutes = Router({ mergeParams: true });

expenseRoutes.use(authMiddleware);

expenseRoutes.get('/', (req, res, next) => expenseController.list(req, res, next));
expenseRoutes.post('/', (req, res, next) => expenseController.create(req, res, next));
expenseRoutes.put('/:id', (req, res, next) => expenseController.update(req, res, next));
expenseRoutes.delete('/:id', (req, res, next) => expenseController.delete(req, res, next));

export { expenseRoutes };
