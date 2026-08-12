import { Router } from 'express';
import { authController } from '../../controllers/auth/auth.controller';

const authRoutes = Router();

authRoutes.post('/register', (req, res, next) => authController.register(req, res, next));
authRoutes.post('/login', (req, res, next) => authController.login(req, res, next));
authRoutes.post('/google', (req, res, next) => authController.google(req, res, next));

export { authRoutes };
