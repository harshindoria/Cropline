import { Request, Response } from 'express';
import prisma from '../config/db';
import { z } from 'zod';
import { Role, RoleAccessStatus } from '@prisma/client';

export const getRoleApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const applications = await prisma.userRoleAccess.findMany({
      where: { status: RoleAccessStatus.PENDING_APPROVAL },
      include: { user: true }
    });
    res.json({ success: true, applications });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not fetch applications" });
  }
};

export const processRoleApplication = async (req: Request<{id : string}>, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // UserRoleAccess ID
    const parsed = z.object({
      action: z.enum(['APPROVE', 'REJECT']),
      reason: z.string().optional()
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.issues });
      return;
    }

    const accessRecord = await prisma.userRoleAccess.findUnique({ where: { id } });
    if (!accessRecord) {
      res.status(404).json({ success: false, message: "Application not found" });
      return;
    }

    if (parsed.data.action === 'APPROVE') {
      await prisma.$transaction(async tx => {
        // Update UserRoleAccess
        await tx.userRoleAccess.update({
          where: { id },
          data: { status: RoleAccessStatus.ACTIVE }
        });
        // Push role to user
        const user = await tx.user.findUnique({ where: { id: accessRecord.userId } });
        if (user && !user.roles.includes(accessRecord.role)) {
          await tx.user.update({
            where: { id: accessRecord.userId },
            data: { roles: { push: accessRecord.role } }
          });
        }
      });
      res.json({ success: true, message: "Application approved" });
    } else {
      // Reject application
      await prisma.userRoleAccess.update({
        where: { id},
        data: { 
          status: RoleAccessStatus.BLOCKED, 
          reason: parsed.data.reason || 'Application rejected by Admin' 
        }
      });
      res.json({ success: true, message: "Application rejected" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error processing application" });
  }
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.query;
    const filter = role ? { roles: { has: role as Role } } : {};
    const users = await prisma.user.findMany({ where: filter });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not fetch users" });
  }
};

export const getBuyers = async (req: Request, res: Response): Promise<void> => {
  try {
    const buyers = await prisma.user.findMany({
      where: { roles: { has: Role.BUYER } },
      include: {
        ordersAsBuyer: {
          select: { totalBuyerPrice: true, createdAt: true, status: true }
        }
      }
    });

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const formattedBuyers = buyers.map(buyer => {
      // Only count and sum COMPLETED orders for totalOrders and totalSpent
      const completedOrders = buyer.ordersAsBuyer.filter(o => o.status === 'COMPLETED');
      const totalOrders = completedOrders.length;
      const totalSpent = completedOrders.reduce((sum, order) => sum + Number(order.totalBuyerPrice || 0), 0);
      
      let status = "Pending";
      if (buyer.isActive && buyer.isVerified) status = "Verified";
      else if (!buyer.isActive) status = "Suspended";

      const city = buyer.district || buyer.village || null;
      const state = buyer.state || null;

      return {
        id: buyer.id,
        name: buyer.name,
        email: buyer.email,
        phone: buyer.phone,
        location: city && state ? `${city}, ${state}` : city || state || "Unknown",
        city: city,
        state: state,
        totalOrders,
        totalSpent,
        status,
        joinedOn: buyer.createdAt
      };
    });

    const metrics = {
      totalBuyers: buyers.length,
      verifiedBuyers: buyers.filter(b => b.isVerified).length,
      newThisMonth: buyers.filter(b => new Date(b.createdAt) >= firstDayOfMonth).length,
      activeBuyers: buyers.filter(b => b.isActive).length,
      suspendedBuyers: buyers.filter(b => !b.isActive).length
    };

    res.json({ success: true, metrics, buyers: formattedBuyers });
  } catch (error) {
    console.error("Get Buyers Error:", error);
    res.status(500).json({ success: false, message: "Could not fetch buyers" });
  }
};


// Merge two duplicate user accounts (keep primaryId, delete secondaryId)
export const mergeUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { primaryId, secondaryId } = req.body;
    if (!primaryId || !secondaryId) {
      res.status(400).json({ success: false, message: "primaryId and secondaryId are required" });
      return;
    }

    const primary = await prisma.user.findUnique({ where: { id: primaryId } });
    const secondary = await prisma.user.findUnique({ where: { id: secondaryId } });

    if (!primary || !secondary) {
      res.status(404).json({ success: false, message: "One or both users not found" });
      return;
    }

    // Merge: Update all secondary references to point to primary, then delete secondary
    await prisma.$transaction(async (tx) => {
      // Re-assign orders
      await tx.order.updateMany({ where: { buyerId: secondaryId }, data: { buyerId: primaryId } });
      await tx.order.updateMany({ where: { farmerId: secondaryId }, data: { farmerId: primaryId } });
      // Re-assign delivery jobs
      await tx.deliveryJob.updateMany({ where: { deliveryPartnerId: secondaryId }, data: { deliveryPartnerId: primaryId } });
      // Re-assign reviews
      await tx.review.updateMany({ where: { reviewerId: secondaryId }, data: { reviewerId: primaryId } });
      await tx.review.updateMany({ where: { targetId: secondaryId }, data: { targetId: primaryId } });
      // Notifications
      await tx.notification.updateMany({ where: { userId: secondaryId }, data: { userId: primaryId } });
      // Complaints
      await tx.complaint.updateMany({ where: { complainerId: secondaryId }, data: { complainerId: primaryId } });
      await tx.complaint.updateMany({ where: { accusedId: secondaryId }, data: { accusedId: primaryId } });

      // Merge fields into primary if primary is missing them
      const mergeData: any = {};
      if (!primary.email && secondary.email) mergeData.email = secondary.email;
      if (!primary.phone && secondary.phone) mergeData.phone = secondary.phone;
      if (!primary.name && secondary.name) mergeData.name = secondary.name;
      if (!primary.firebaseUid && secondary.firebaseUid) mergeData.firebaseUid = secondary.firebaseUid;
      if (Object.keys(mergeData).length > 0) {
        await tx.user.update({ where: { id: primaryId }, data: mergeData });
      }

      // Delete secondary roleAccess and the user
      await tx.userRoleAccess.deleteMany({ where: { userId: secondaryId } });
      await tx.user.delete({ where: { id: secondaryId } });
    });

    res.json({ success: true, message: "Accounts merged successfully" });
  } catch (error) {
    console.error("Merge Users Error:", error);
    res.status(500).json({ success: false, message: "Could not merge accounts" });
  }
};

// Block or unblock a buyer
export const blockBuyer = async (req: Request<{id: string}>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { block } = req.body; // true = block, false = unblock

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: !block }
    });

    res.json({ success: true, message: block ? "Buyer blocked" : "Buyer unblocked", user });
  } catch (error) {
    console.error("Block Buyer Error:", error);
    res.status(500).json({ success: false, message: "Could not update buyer status" });
  }
};

export const deleteReview = async (req: Request<{id : string}>, res: Response): Promise<void> => {
  try {
    await prisma.review.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Review deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not delete review" });
  }
};

export const deleteComplaint = async (req: Request<{id : string}>, res: Response): Promise<void> => {
  try {
    await prisma.complaint.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Complaint deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not delete complaint" });
  }
};

export const processWithdrawalRequest = async (req: Request, res: Response): Promise<void> => {
  // Mock logic
  res.json({ success: true, message: "Withdrawal processed" });
};

export const verifyDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = z.object({
      userId: z.string(),
      docType: z.enum(['aadhaar', 'dl', 'rc']),
      status: z.boolean()
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.issues });
      return;
    }

    const { userId, docType, status } = parsed.data;
    
    // Also update global isVerified if aadhaar is verified (or based on business logic)
    const updateData: any = { [`${docType}Verified`]: status };
    if (docType === 'aadhaar' && status === true) {
      updateData.isVerified = true;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    res.json({ success: true, message: `Document ${docType} verification updated to ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to verify document" });
  }
};

export const getDashboardOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalFarmers,
      totalBuyers,
      deliveryPartners,
      ordersToday,
      revenueTodayAgg,
      farmersPending,
      deliveryPending,
      openComplaints,
      highPriorityComplaints,
      resolvedToday,
      recentUsers,
      recentOrders,
      recentComplaints
    ] = await Promise.all([
      // 1. Total Farmers
      prisma.user.count({ where: { roles: { has: 'FARMER' } } }),
      // 2. Total Buyers
      prisma.user.count({ where: { roles: { has: 'BUYER' } } }),
      // 3. Total Delivery Partners
      prisma.user.count({ where: { roles: { has: 'DELIVERY' } } }),
      // 4. Orders Today
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      // 5. Revenue Today
      prisma.ledgerEntry.aggregate({
        where: {
          createdAt: { gte: today },
          type: { in: ['PLATFORM_CROP_FEE', 'PLATFORM_DELIVERY_FEE'] },
          status: 'SETTLED'
        },
        _sum: { amount: true }
      }),
      // 6. Farmers Pending Verification
      prisma.userRoleAccess.count({ where: { role: 'FARMER', status: 'PENDING_APPROVAL' } }),
      // 7. Delivery Pending Verification
      prisma.userRoleAccess.count({ where: { role: 'DELIVERY', status: 'PENDING_APPROVAL' } }),
      // 8. Open Complaints
      prisma.complaint.count({ where: { status: 'PENDING' } }),
      // 9. High Priority Complaints
      prisma.notification.count({
        where: {
          type: 'COMPLAINT',
          alertLevel: { in: ['WARNING', 'CRITICAL'] },
          isRead: false
        }
      }),
      // 10. Resolved Complaints Today
      prisma.complaint.count({
        where: { status: 'RESOLVED', updatedAt: { gte: today } }
      }),
      // 11. Recent Activities: Users
      prisma.user.findMany({
        take: 2,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, roles: true, createdAt: true }
      }),
      // 12. Recent Activities: Orders
      prisma.order.findMany({
        take: 2,
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, totalBuyerPrice: true, createdAt: true, buyer: { select: { name: true } } }
      }),
      // 13. Recent Activities: Complaints
      prisma.complaint.findMany({
        take: 2,
        orderBy: { createdAt: 'desc' },
        select: { id: true, reason: true, status: true, createdAt: true, complainer: { select: { name: true } } }
      })
    ]);

    const revenueToday = revenueTodayAgg._sum.amount || 0;

    // Build Recent Activities array
    const activities: any[] = [];
    recentUsers.forEach(u => activities.push({
      id: u.id,
      type: 'USER_REGISTERED',
      title: `New ${u.roles[0]} Registered`,
      desc: `${u.name} just joined`,
      timestamp: u.createdAt
    }));
    recentOrders.forEach(o => activities.push({
      id: o.id,
      type: 'ORDER_PLACED',
      title: `New Order Placed`,
      desc: `Order ${o.id.slice(-6)} by ${o.buyer.name}`,
      timestamp: o.createdAt
    }));
    recentComplaints.forEach(c => activities.push({
      id: c.id,
      type: 'COMPLAINT_RAISED',
      title: `Complaint Raised`,
      desc: `${c.reason} by ${c.complainer.name}`,
      timestamp: c.createdAt
    }));

    // Sort descending by timestamp
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Send response
    res.json({
      success: true,
      data: {
        metrics: {
          totalFarmers,
          totalBuyers,
          deliveryPartners,
          ordersToday,
          revenueToday
        },
        verifications: {
          farmersPending,
          deliveryPending
        },
        complaints: {
          open: openComplaints,
          highPriority: highPriorityComplaints,
          resolvedToday
        },
        activities: activities.slice(0, 5) // top 5
      }
    });

  } catch (error) {
    console.error("Error in getDashboardOverview:", error);
    res.status(500).json({ success: false, message: "Could not fetch overview data" });
  }
};
