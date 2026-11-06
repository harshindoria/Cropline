import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { settleCashLiability } from '../services/ledger.service';
import { ACTIVE_JOB, withOrderCurrentJob } from '../utils/deliveryJob';

export const getTransactionsOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [onlineSumRes, cashPendingSumRes, settlementsPendingSumRes, failedTxCount] = await Promise.all([
      prisma.paymentRecord.aggregate({
        _sum: { amount: true },
        where: { status: 'SUCCESS' }
      }),
      prisma.cashLiability.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: { status: 'PENDING_DEPOSIT' }
      }),
      prisma.ledgerEntry.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: { status: 'PENDING', type: { in: ['FARMER_EARNING', 'DELIVERY_EARNING'] } }
      }),
      prisma.paymentRecord.count({
        where: { status: 'FAILED' }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        onlinePayments: Number(onlineSumRes._sum.amount || 0),
        cashPendingDeposit: Number(cashPendingSumRes._sum.amount || 0),
        cashPendingOrdersCount: cashPendingSumRes._count.id,
        pendingSettlements: Number(settlementsPendingSumRes._sum.amount || 0),
        pendingSettlementsCount: settlementsPendingSumRes._count.id,
        failedTransactions: failedTxCount
      }
    });
  } catch (error) {
    console.error("Error in getTransactionsOverview:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getOnlinePayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const payments = await prisma.paymentRecord.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            totalBuyerPrice: true,
            farmerEarnings: true,
            deliveryPartnerPayout: true,
            platformFee: true,
            deliveryPlatformFee: true,
            discountAmount: true,
            completedAt: true,
            buyer: { select: { name: true, phone: true } },
            farmer: { select: { name: true, phone: true } },
            deliveryJobs: {
              where: ACTIVE_JOB,
              take: 1,
              select: {
                deliveryPartner: { select: { name: true, phone: true } },
                deliveredAt: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: payments.map(withOrderCurrentJob)
    });
  } catch (error) {
    console.error("Error in getOnlinePayments:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getCashCollections = async (req: Request, res: Response): Promise<void> => {
  try {
    const collections = await prisma.cashLiability.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        deliveryPartner: { select: { name: true, phone: true } },
        order: {
          select: {
            id: true,
            totalBuyerPrice: true,
            farmerEarnings: true,
            deliveryPartnerPayout: true,
            platformFee: true,
            deliveryPlatformFee: true,
            discountAmount: true,
            completedAt: true,
            buyer: { select: { name: true, phone: true } },
            farmer: { select: { name: true, phone: true } },
            deliveryJobs: {
              where: ACTIVE_JOB,
              take: 1,
              select: {
                deliveredAt: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: collections.map(withOrderCurrentJob)
    });
  } catch (error) {
    console.error("Error in getCashCollections:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getSettlements = async (req: Request, res: Response): Promise<void> => {
  try {
    const settlements = await prisma.ledgerEntry.findMany({
      where: {
        type: { in: ['FARMER_EARNING', 'DELIVERY_EARNING'] }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, phone: true } },
        order: {
          select: {
            id: true,
            totalBuyerPrice: true,
            farmerEarnings: true,
            deliveryPartnerPayout: true,
            platformFee: true,
            deliveryPlatformFee: true,
            discountAmount: true,
            completedAt: true,
            buyer: { select: { name: true, phone: true } },
            farmer: { select: { name: true, phone: true } },
            deliveryJobs: {
              where: ACTIVE_JOB,
              take: 1,
              select: {
                deliveryPartner: { select: { name: true, phone: true } },
                deliveredAt: true
              }
            },
            paymentRecord: {
              select: {
                status: true,
                capturedAt: true,
                provider: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: settlements.map(withOrderCurrentJob)
    });
  } catch (error) {
    console.error("Error in getSettlements:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const verifyCashDeposit = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    const liability = await prisma.cashLiability.findUnique({
      where: { id },
      include: { order: true }
    });

    if (!liability) {
      res.status(404).json({ success: false, message: "Cash liability not found" });
      return;
    }

    if (liability.status === 'VERIFIED') {
      res.status(400).json({ success: false, message: "Already verified" });
      return;
    }

    const settled = await prisma.$transaction((tx) => settleCashLiability(tx, id, req.user!.id));
    if (!settled) {
      res.status(400).json({ success: false, message: "Already verified" });
      return;
    }

    res.status(200).json({ success: true, message: "Cash deposit verified and earnings released" });
  } catch (error) {
    console.error("Error in verifyCashDeposit:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
