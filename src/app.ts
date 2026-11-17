import express from 'express';
import cors from 'cors';
import { authRoutes } from './routes/auth/auth.routes';
import { tripRoutes } from './routes/trip.routes';
import { activityRoutes } from './routes/activity.routes';
import { weatherRoutes } from './routes/weather.routes';
import { expenseRoutes } from './routes/expense.routes';
import { budgetRoutes } from './routes/budget.routes';
import { infoRoutes } from './routes/info.routes';
import { profileRoutes } from './routes/profile.routes';
import { errorMiddleware } from './middlewares/error.middleware';
import { requestLogger } from './middlewares/requestLogger.middleware';
import { apiRateLimiter } from './middlewares/rateLimit.middleware';
import { captureError } from './config/observability';
import { prisma } from './config/prisma';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(requestLogger);
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/health/ready', async (_req, res) => {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ok', database: 'up', latencyMs: Date.now() - start });
    } catch (error) {
      captureError(error, { check: 'database' });
      res.status(503).json({ status: 'error', database: 'down' });
    }
  });

  app.use(apiRateLimiter);

  app.use('/auth', authRoutes);
  app.use('/trips', tripRoutes);
  app.use('/trips/:tripId/activities', activityRoutes);
  app.use('/trips/:tripId/weather', weatherRoutes);
  app.use('/trips/:tripId/expenses', expenseRoutes);
  app.use('/trips/:tripId/budget', budgetRoutes);
  app.use('/trips/:tripId/infos', infoRoutes);
  app.use('/users', profileRoutes);

  app.use(errorMiddleware);

  return app;
}
