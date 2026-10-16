import { Activity, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface CreateActivityData {
  name: string;
  date: Date;
  time?: Date | null;
  location?: string | null;
  period?: string | null;
  category?: string | null;
  estimatedCost?: Prisma.Decimal | number | null;
  description?: string | null;
}

export class ActivityRepository {
  async create(tripId: string, data: CreateActivityData): Promise<Activity> {
    return prisma.activity.create({
      data: {
        tripId,
        name: data.name,
        date: data.date,
        time: data.time ?? null,
        location: data.location ?? null,
        period: data.period ?? null,
        category: data.category ?? null,
        estimatedCost: data.estimatedCost ?? null,
        description: data.description ?? null,
      },
    });
  }

  async findAllByTrip(tripId: string): Promise<Activity[]> {
    return prisma.activity.findMany({
      where: { tripId },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
  }

  async findByIdAndTrip(id: string, tripId: string): Promise<Activity | null> {
    return prisma.activity.findFirst({
      where: { id, tripId },
    });
  }

  async delete(id: string, tripId: string): Promise<Activity | null> {
    const existing = await this.findByIdAndTrip(id, tripId);
    if (!existing) {
      return null;
    }

    return prisma.activity.delete({
      where: { id },
    });
  }
}
