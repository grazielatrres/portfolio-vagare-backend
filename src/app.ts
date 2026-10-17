import express from 'express';
import cors from 'cors';
import { authRoutes } from './routes/auth/auth.routes';
import { tripRoutes } from './routes/trip.routes';
import { activityRoutes } from './routes/activity.routes';
import { weatherRoutes } from './routes/weather.routes';
import { expenseRoutes } from './routes/expense.routes';
import { budgetRoutes } from './routes/budget.routes';
import { profileRoutes } from './routes/profile.routes';
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
  app.use('/trips/:tripId/activities', activityRoutes);
  app.use('/trips/:tripId/weather', weatherRoutes);
  app.use('/trips/:tripId/expenses', expenseRoutes);
  app.use('/trips/:tripId/budget', budgetRoutes);
  app.use('/users', profileRoutes);

  app.use(errorMiddleware);

  return app;
}
