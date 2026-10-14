import { Router } from 'express';
import { authController } from '../../controllers/auth/auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { forgotPasswordRateLimiter } from '../../middlewares/rateLimit.middleware';

const authRoutes = Router();

authRoutes.post('/register', (req, res, next) => authController.register(req, res, next));
authRoutes.post('/login', (req, res, next) => authController.login(req, res, next));
authRoutes.post('/google', (req, res, next) => authController.google(req, res, next));
authRoutes.post('/logout', authMiddleware, (req, res, next) =>
  authController.logout(req, res, next),
);
authRoutes.post('/forgot-password', forgotPasswordRateLimiter, (req, res, next) =>
  authController.forgotPassword(req, res, next),
);
authRoutes.post('/reset-password', (req, res, next) =>
  authController.resetPassword(req, res, next),
);

export { authRoutes };
