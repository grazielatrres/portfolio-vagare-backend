import express from 'express';
import cors from 'cors';
import { authRoutes } from './routes/auth/auth.routes';
import { tripRoutes } from './routes/trip.routes';
import { errorMiddleware } from './middlewares/error.middleware';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/auth', authRoutes);
  app.use('/trips', tripRoutes);

  app.use(errorMiddleware);

  return app;
}
