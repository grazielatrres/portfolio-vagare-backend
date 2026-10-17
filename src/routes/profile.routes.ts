import { Router } from 'express';
import { profileController } from '../controllers/profile.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const profileRoutes = Router();

profileRoutes.use(authMiddleware);

profileRoutes.get('/me', (req, res, next) => profileController.get(req, res, next));
profileRoutes.put('/me', (req, res, next) => profileController.update(req, res, next));
profileRoutes.delete('/me', (req, res, next) => profileController.remove(req, res, next));

export { profileRoutes };
