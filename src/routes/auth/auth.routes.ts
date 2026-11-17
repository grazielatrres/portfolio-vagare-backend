import { Router } from 'express';
import { authController } from '../../controllers/auth/auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  authRateLimiter,
  forgotPasswordRateLimiter,
  loginRateLimiter,
} from '../../middlewares/rateLimit.middleware';

const authRoutes = Router();

authRoutes.post('/register', authRateLimiter, (req, res, next) =>
  authController.register(req, res, next),
);
authRoutes.post('/login', loginRateLimiter, (req, res, next) =>
  authController.login(req, res, next),
);
authRoutes.post('/google', authRateLimiter, (req, res, next) =>
  authController.google(req, res, next),
);
authRoutes.post('/refresh', (req, res, next) => authController.refresh(req, res, next));
authRoutes.post('/logout', authMiddleware, (req, res, next) =>
  authController.logout(req, res, next),
);
authRoutes.post('/forgot-password', forgotPasswordRateLimiter, (req, res, next) =>
  authController.forgotPassword(req, res, next),
);
authRoutes.post('/reset-password', authRateLimiter, (req, res, next) =>
  authController.resetPassword(req, res, next),
);

export { authRoutes };
