import { PrismaClient } from '@prisma/client';

// Global object ko typecast kar rahe hain taaki TypeScript error na de
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Agar global memory mein prisma pehle se hai toh use karo, warna naya banao
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['query', 'error', 'warn'], // Yeh terminal mein SQL queries dikhayega testing ke liye
});

// Agar hum production (live server) par nahi hain, toh naye connection ko global memory mein save kar do
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;