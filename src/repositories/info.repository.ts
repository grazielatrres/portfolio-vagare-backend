import { Info, InfoType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface CreateInfoData {
  type: InfoType;
  title: string;
  description?: string | null;
  date?: Date | null;
  details?: Prisma.InputJsonValue | null;
}

export type UpdateInfoData = CreateInfoData;

export class InfoRepository {
  async create(tripId: string, data: CreateInfoData): Promise<Info> {
    return prisma.info.create({
      data: {
        tripId,
        type: data.type,
        title: data.title,
        description: data.description ?? null,
        date: data.date ?? null,
        details: data.details ?? Prisma.DbNull,
      },
    });
  }

  async findAllByTrip(tripId: string): Promise<Info[]> {
    return prisma.info.findMany({
      where: { tripId },
      orderBy: [{ type: 'asc' }, { date: 'asc' }],
    });
  }

  async findByIdAndTrip(id: string, tripId: string): Promise<Info | null> {
    return prisma.info.findFirst({
      where: { id, tripId },
    });
  }

  async update(id: string, tripId: string, data: UpdateInfoData): Promise<Info | null> {
    const existing = await this.findByIdAndTrip(id, tripId);
    if (!existing) {
      return null;
    }

    return prisma.info.update({
      where: { id },
      data: {
        type: data.type,
        title: data.title,
        description: data.description ?? null,
        date: data.date ?? null,
        details: data.details ?? Prisma.DbNull,
      },
    });
  }

  async delete(id: string, tripId: string): Promise<Info | null> {
    const existing = await this.findByIdAndTrip(id, tripId);
    if (!existing) {
      return null;
    }

    return prisma.info.delete({
      where: { id },
    });
  }
}
