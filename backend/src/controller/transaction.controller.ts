import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { CashDepositStatus, LedgerEntryStatus, LedgerEntryType } from '@prisma/client';

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
        where: { status: 'PENDING' }
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
            deliveryJob: {
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
      data: payments
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
            deliveryJob: {
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
      data: collections
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
            deliveryJob: {
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
      data: settlements
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

    await prisma.$transaction(async (tx: any) => {
      // Mark CashLiability as verified
      await tx.cashLiability.update({
        where: { id },
        data: {
          status: 'VERIFIED',
          reconciledAt: new Date(),
          reconciledByAdminId: req.user!.id
        }
      });

      // Find pending ledger entry for the farmer of this order
      const ledgerEntry = await tx.ledgerEntry.findFirst({
        where: {
          orderId: liability.orderId,
          type: 'FARMER_EARNING',
          status: 'PENDING'
        }
      });

      if (ledgerEntry) {
        // Release farmer payout to be available
        await tx.ledgerEntry.update({
          where: { id: ledgerEntry.id },
          data: {
            status: 'AVAILABLE',
            availableAt: new Date()
          }
        });
      }
    });

    res.status(200).json({ success: true, message: "Cash deposit verified and farmer funds unlocked" });
  } catch (error) {
    console.error("Error in verifyCashDeposit:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
