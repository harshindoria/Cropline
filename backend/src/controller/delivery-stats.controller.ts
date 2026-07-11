import { Request, Response } from 'express';
import prisma from '../config/db';
import { OrderStatus, DeliveryJobStatus } from '@prisma/client';

export const getMonthlyEarnings = async (req: Request, res: Response): Promise<void> => {
  try {
    const deliveryPartnerId = req.user!.id;
    const currentYear = new Date().getFullYear();

    // Summing earnings from completed delivery jobs for the current year
    const jobs = await prisma.deliveryJob.findMany({
      where: {
        deliveryPartnerId,
        status: DeliveryJobStatus.DELIVERED,
        order: {
          completedAt: {
            gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
            lte: new Date(`${currentYear}-12-31T23:59:59.999Z`)
          }
        }
      },
      include: {
        order: true
      }
    });

    const monthlyEarnings = new Array(12).fill(0);

    jobs.forEach(job => {
      const month = job.order.completedAt?.getMonth();
      if (month !== undefined) {
        monthlyEarnings[month] += Number(job.order.deliveryPartnerPayout || 0);
      }
    });

    res.status(200).json({ success: true, data: monthlyEarnings });
  } catch (error) {
    console.error('Error fetching monthly earnings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getTodaySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const deliveryPartnerId = req.user!.id;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todayJobs = await prisma.deliveryJob.findMany({
      where: {
        deliveryPartnerId,
        status: DeliveryJobStatus.DELIVERED,
        order: {
          completedAt: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      },
      include: { order: true }
    });

    const completedJobs = todayJobs.length;
    let todayEarnings = 0;
    let totalDistanceKm = 0;
    let totalTimeMs = 0;

    todayJobs.forEach(job => {
      todayEarnings += Number(job.order.deliveryPartnerPayout || 0);
      totalDistanceKm += Number(job.distanceKm || 0);
      if (job.order.dispatchStartedAt && job.order.completedAt) {
        totalTimeMs += job.order.completedAt.getTime() - job.order.dispatchStartedAt.getTime();
      }
    });

    const avgTimeMins = completedJobs > 0 ? Math.round((totalTimeMs / completedJobs) / 60000) : 0;

    res.status(200).json({
      success: true,
      data: {
        todayEarnings,
        completedJobs,
        totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
        avgTimeMins,
        dailyGoal: Number(req.user!.dailyEarningsGoal) || 2000
      }
    });
  } catch (error) {
    console.error('Error fetching today summary:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateDailyGoal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { goal } = req.body;
    
    if (!goal || isNaN(goal)) {
      res.status(400).json({ success: false, message: 'Valid goal amount is required' });
      return;
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { dailyEarningsGoal: Number(goal) }
    });

    res.status(200).json({ success: true, message: 'Goal updated successfully', data: { goal: Number(goal) } });
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
