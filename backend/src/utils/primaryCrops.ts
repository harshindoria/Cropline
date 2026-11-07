import { Prisma } from '@prisma/client';
import prisma from '../config/db';

type Db = Prisma.TransactionClient | typeof prisma;

export class UnknownCropError extends Error {
  constructor(public readonly names: string[]) {
    super(`Not available on the platform: ${names.join(', ')}`);
  }
}

// What the API shows: the catalog names as one comma-separated string.
export const primaryCropsText = (crops?: { englishName: string }[] | null) =>
  (crops ?? []).map((c) => c.englishName).join(', ');

export const primaryCropsSelect = { select: { englishName: true }, orderBy: { englishName: 'asc' } } as const;

// Turns "Wheat, Rice" into a relation update, accepting only active catalog crops.
export async function primaryCropsRelation(db: Db, text: string) {
  const names = [...new Set(text.split(',').map((n) => n.trim()).filter(Boolean))];
  const found = names.length
    ? await db.cropCatalog.findMany({
        where: { isActive: true, englishName: { in: names, mode: 'insensitive' } },
        select: { id: true, englishName: true },
      })
    : [];
  const known = new Set(found.map((c) => c.englishName.toLowerCase()));
  const unknown = names.filter((n) => !known.has(n.toLowerCase()));
  if (unknown.length) throw new UnknownCropError(unknown);
  return { set: found.map((c) => ({ id: c.id })) };
}
