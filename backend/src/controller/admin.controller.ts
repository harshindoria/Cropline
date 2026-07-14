import { Request, Response } from 'express';
import prisma from '../config/db';
import { z } from 'zod';
import { Role, RoleAccessStatus, NotificationType, NotificationAlertLevel, ComplaintStatus, Prisma } from '@prisma/client';

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


export const getFarmers = async (req: Request, res: Response): Promise<void> => {
  try {
    const farmers = await prisma.user.findMany({
      where: { roles: { has: 'FARMER' } },
      include: {
        ordersAsFarmer: { where: { status: 'COMPLETED' } },
        crops: true
      }
    });

    const formattedFarmers = farmers.map(farmer => {
      let status = "Pending";
      if (farmer.isActive && farmer.isVerified) status = "Verified";
      else if (!farmer.isActive) status = "Suspended";

      const totalOrders = farmer.ordersAsFarmer.length;
      const earnings = farmer.ordersAsFarmer.reduce((sum, order) => sum + Number(order.farmerEarnings || 0), 0);

      const city = farmer.district || farmer.village || null;
      const state = farmer.state || null;

      return {
        id: farmer.id,
        name: farmer.name,
        email: farmer.email,
        phone: farmer.phone,
        location: city && state ? `${city}, ${state}` : city || state || "Unknown",
        city,
        state,
        primaryCrops: farmer.primaryCrops || "",
        listings: farmer.crops.length,
        totalOrders,
        earnings,
        status,
        joinedOn: farmer.createdAt
      };
    });

    const metrics = {
      totalFarmers: farmers.length,
      verifiedFarmers: farmers.filter(f => f.isVerified).length,
      activeFarmers: farmers.filter(f => f.isActive).length,
      suspendedFarmers: farmers.filter(f => !f.isActive).length
    };

    res.json({ success: true, metrics, farmers: formattedFarmers });
  } catch (error) {
    console.error("Get Farmers Error:", error);
    res.status(500).json({ success: false, message: "Could not fetch farmers" });
  }
};

export const getDeliveryPartners = async (req: Request, res: Response): Promise<void> => {
  try {
    const partners = await prisma.user.findMany({
      where: { roles: { has: 'DELIVERY' } },
      include: {
        deliveryJobs: { where: { status: 'DELIVERED' } }
      }
    });

    const formattedPartners = partners.map(partner => {
      let status = "Pending";
      if (partner.isActive && partner.isVerified) status = "Verified";
      else if (!partner.isActive) status = "Suspended";

      const totalOrders = partner.deliveryJobs.length;
      // In a real scenario you would join the order to get the delivery partner payout, 
      // but let's mock it or use 0 for now as it's not strictly available on deliveryJob directly.
      const earnings = 0; 

      const city = partner.district || partner.village || null;
      const state = partner.state || null;

      return {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        location: city && state ? `${city}, ${state}` : city || state || "Unknown",
        city,
        state,
        vehicleType: partner.vehicleType || "UNKNOWN",
        vehicleNumber: partner.vehicleNumber || "N/A",
        totalOrders,
        earnings,
        status,
        joinedOn: partner.createdAt
      };
    });

    const metrics = {
      totalPartners: partners.length,
      verifiedPartners: partners.filter(p => p.isVerified).length,
      activePartners: partners.filter(p => p.isActive).length,
      suspendedPartners: partners.filter(p => !p.isActive).length
    };

    res.json({ success: true, metrics, partners: formattedPartners });
  } catch (error) {
    console.error("Get Delivery Partners Error:", error);
    res.status(500).json({ success: false, message: "Could not fetch delivery partners" });
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

export const getVerificationDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { aadhaarUrl: { not: null } },
          { dlUrl: { not: null } },
          { rcUrl: { not: null } }
        ]
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        activeRole: true,
        aadhaarUrl: true,
        aadhaarVerified: true,
        dlUrl: true,
        dlVerified: true,
        rcUrl: true,
        rcVerified: true,
        updatedAt: true
      }
    });

    const documents: any[] = [];
    let pendingAadhaar = 0;
    let pendingDl = 0;
    let pendingRc = 0;

    users.forEach(user => {
      // Aadhaar
      if (user.aadhaarUrl) {
        const isPending = !user.aadhaarVerified;
        if (isPending) pendingAadhaar++;
        documents.push({
          id: `aadhaar-${user.id}`,
          userId: user.id,
          applicantName: user.name,
          applicantPhone: user.phone,
          applicantEmail: user.email,
          userType: user.activeRole === 'FARMER' ? 'Farmer' : (user.activeRole === 'DELIVERY' ? 'Delivery Boy' : user.activeRole),
          docType: 'Aadhar Card',
          docTypeEnum: 'aadhaar',
          docUrl: user.aadhaarUrl,
          status: user.aadhaarVerified ? 'Approved' : 'Pending',
          submittedOn: user.updatedAt
        });
      }
      // DL
      if (user.dlUrl) {
        const isPending = !user.dlVerified;
        if (isPending) pendingDl++;
        documents.push({
          id: `dl-${user.id}`,
          userId: user.id,
          applicantName: user.name,
          applicantPhone: user.phone,
          applicantEmail: user.email,
          userType: user.activeRole === 'FARMER' ? 'Farmer' : (user.activeRole === 'DELIVERY' ? 'Delivery Boy' : user.activeRole),
          docType: 'Driving License',
          docTypeEnum: 'dl',
          docUrl: user.dlUrl,
          status: user.dlVerified ? 'Approved' : 'Pending',
          submittedOn: user.updatedAt
        });
      }
      // RC
      if (user.rcUrl) {
        const isPending = !user.rcVerified;
        if (isPending) pendingRc++;
        documents.push({
          id: `rc-${user.id}`,
          userId: user.id,
          applicantName: user.name,
          applicantPhone: user.phone,
          applicantEmail: user.email,
          userType: user.activeRole === 'FARMER' ? 'Farmer' : (user.activeRole === 'DELIVERY' ? 'Delivery Boy' : user.activeRole),
          docType: 'RC (Vehicle)',
          docTypeEnum: 'rc',
          docUrl: user.rcUrl,
          status: user.rcVerified ? 'Approved' : 'Pending',
          submittedOn: user.updatedAt
        });
      }
    });

    documents.sort((a, b) => new Date(b.submittedOn).getTime() - new Date(a.submittedOn).getTime());

    const metrics = {
      totalPending: pendingAadhaar + pendingDl + pendingRc,
      pendingAadhaar,
      pendingDl,
      pendingRc
    };

    res.json({ success: true, documents, metrics });
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
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
      recentComplaints,
      recentCashPending,
      recentPayouts
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
          type: 'WARNING',
          alertLevel: { in: ['WARNING', 'CRITICAL'] },
          isRead: false
        }
      }),
      // 10. Resolved Complaints Today
      prisma.complaint.count({
        where: { status: 'APPROVED', updatedAt: { gte: today } }
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
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, reason: true, status: true, createdAt: true, complainer: { select: { name: true } }, accused: { select: { name: true } } }
      }),
      // 14. Recent Activities: Cash Deposits
      prisma.cashLiability.findMany({
        take: 5,
        where: { status: 'PENDING_DEPOSIT' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, amount: true, createdAt: true, deliveryPartner: { select: { name: true } } }
      }),
      // 15. Recent Activities: Payouts
      prisma.ledgerEntry.findMany({
        take: 5,
        where: { type: 'PAYOUT', status: 'SETTLED' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, amount: true, createdAt: true, user: { select: { name: true, roles: true } } }
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
      title: `New complaint filed`,
      desc: `${c.complainer.name} filed a complaint against ${c.accused.name}.`,
      timestamp: c.createdAt
    }));
    recentCashPending.forEach(c => activities.push({
      id: c.id,
      type: 'CASH_DEPOSIT_PENDING',
      title: `Cash deposit pending`,
      desc: `${c.deliveryPartner.name} has a pending cash deposit of ₹${c.amount}.`,
      timestamp: c.createdAt
    }));
    recentPayouts.forEach(p => activities.push({
      id: p.id,
      type: 'PAYOUT_SUCCESSFUL',
      title: `Payout successful`,
      desc: `₹${p.amount} paid to ${p.user?.name || 'User'} (${p.user?.roles?.[0] || 'Unknown'}).`,
      timestamp: p.createdAt
    }));

    // Calculate Market Growth (Last 6 Months)
    const marketGrowth = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0, 23, 59, 59, 999);
      
      const [mOrders, mRevenueAgg, mUsers] = await Promise.all([
        prisma.order.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
        prisma.ledgerEntry.aggregate({
          where: {
            createdAt: { gte: monthStart, lte: monthEnd },
            type: { in: ['PLATFORM_CROP_FEE', 'PLATFORM_DELIVERY_FEE'] },
            status: 'SETTLED'
          },
          _sum: { amount: true }
        }),
        prisma.user.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } })
      ]);

      const monthName = monthStart.toLocaleString('default', { month: 'short' });
      marketGrowth.push({
        month: monthName,
        orders: mOrders,
        revenue: Number(mRevenueAgg._sum.amount || 0),
        users: mUsers
      });
    }

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
        marketGrowth,
        activities: activities.slice(0, 20) // top 20
      }
    });

  } catch (error) {
    console.error("Error in getDashboardOverview:", error);
    res.status(500).json({ success: false, message: "Could not fetch overview data" });
  }
};

export const sendBulkNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sendTo, userId, type, title, message, priority } = req.body;

    // Validate type against the Enum
    if (!['GENERAL', 'ANNOUNCEMENT', 'WARNING', 'MAINTENANCE', 'OFFER'].includes(type)) {
      res.status(400).json({ success: false, message: 'Invalid notification type' });
      return;
    }

    let targetUserIds: string[] = [];

    if (sendTo === 'Specific Users') {
      if (!userId) {
        res.status(400).json({ success: false, message: 'userId is required for specific users' });
        return;
      }
      targetUserIds = [userId];
    } else {
      let roleFilter: Role | undefined;
      if (sendTo === 'All Buyers') roleFilter = Role.BUYER;
      if (sendTo === 'All Farmers') roleFilter = Role.FARMER;
      if (sendTo === 'All Delivery Partners') roleFilter = Role.DELIVERY;

      const users = await prisma.user.findMany({
        where: roleFilter ? { roles: { has: roleFilter } } : {},
        select: { id: true }
      });
      targetUserIds = users.map(u => u.id);
    }

    if (targetUserIds.length === 0) {
      res.status(404).json({ success: false, message: 'No users found for this target' });
      return;
    }

    // Insert notifications
    const notificationsToInsert = targetUserIds.map(id => ({
      userId: id,
      type: type as NotificationType,
      title,
      body: message,
      alertLevel: priority === 'Important' ? 'WARNING' as const : 'INFO' as const,
    }));

    await prisma.notification.createMany({
      data: notificationsToInsert
    });

    res.status(200).json({ success: true, message: `Notification sent to ${targetUserIds.length} users.` });
  } catch (error) {
    console.error("Error sending bulk notifications:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getNotificationHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    // Basic history logic: group by title and body, to show "bulk" sends as one row
    // Since prisma doesn't support grouping by all these fields easily with counts natively without raw,
    // let's fetch raw or just get distinct logs.
    const history = await prisma.$queryRaw`
      SELECT 
        "type", 
        "title", 
        "body", 
        MAX("createdAt") as "sentOn", 
        COUNT(*) as "sentCount"
      FROM "Notification"
      GROUP BY "type", "title", "body"
      ORDER BY "sentOn" DESC
      LIMIT 50
    `;

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    console.error("Error fetching notification history:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const searchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.length < 2) {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } }
        ]
      },
      select: {
        id: true,
        name: true,
        phone: true,
        roles: true,
      },
      take: 10
    });

    res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── COMPLAINTS MANAGEMENT ────────────────────────────────────────────────────────

export const getComplaints = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, role, reason, startDate, endDate } = req.query;

    const where: Prisma.ComplaintWhereInput = {};

    if (status && status !== 'All Status') {
      where.status = status as ComplaintStatus;
    }

    if (role && role !== 'All Roles') {
      where.accusedRole = role as Role;
    }

    if (reason && reason !== 'All Reasons') {
      where.reason = reason as string;
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const complaints = await prisma.complaint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        complainer: { select: { id: true, name: true, phone: true } },
        accused: { select: { id: true, name: true, phone: true, strikeCount: true } },
        order: {
          select: {
            id: true,
            createdAt: true,
            farmerAcceptedAt: true,
            dispatchStartedAt: true,
            completedAt: true,
            farmer: { select: { id: true, name: true, phone: true } },
            buyer: { select: { id: true, name: true, phone: true } },
            deliveryJob: {
              select: {
                pickedUpAt: true,
                deliveredAt: true,
                deliveryPartner: { select: { id: true, name: true, phone: true } }
              }
            }
          }
        }
      }
    });

    res.json({ success: true, data: complaints });
  } catch (error) {
    console.error("Error fetching complaints:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getComplaintStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const [openCount, underReviewCount, resolvedCount, blockedUsersCount] = await Promise.all([
      prisma.complaint.count({ where: { status: 'PENDING' } }),
      prisma.complaint.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.complaint.count({ where: { status: 'APPROVED' } }), // Resolved = Approved in this context
      prisma.userRoleAccess.count({ where: { status: 'BLOCKED' } })
    ]);

    res.json({
      success: true,
      data: {
        openComplaints: openCount,
        underReview: underReviewCount,
        resolved: resolvedCount,
        blockedUsers: blockedUsersCount
      }
    });
  } catch (error) {
    console.error("Error fetching complaint stats:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const processComplaint = async (req: Request<{id: string}>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, adminRemark } = req.body; // action: 'APPROVE', 'DISMISS', 'REQUEST_MORE_EVIDENCE'

    if (!['APPROVE', 'DISMISS', 'REQUEST_MORE_EVIDENCE'].includes(action)) {
      res.status(400).json({ success: false, message: "Invalid action" });
      return;
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: { accused: true, complainer: true }
    });

    if (!complaint) {
      res.status(404).json({ success: false, message: "Complaint not found" });
      return;
    }

    let updatedStatus: ComplaintStatus = 'PENDING';
    if (action === 'APPROVE') updatedStatus = 'APPROVED';
    if (action === 'DISMISS') updatedStatus = 'DISMISSED';
    if (action === 'REQUEST_MORE_EVIDENCE') updatedStatus = 'UNDER_REVIEW';

    // Transaction for atomic updates
    await prisma.$transaction(async (tx) => {
      // 1. Update Complaint
      await tx.complaint.update({
        where: { id },
        data: { status: updatedStatus, adminRemark }
      });

      // 2. Logic based on action
      if (action === 'APPROVE') {
        const newStrikeCount = complaint.accused.strikeCount + 1;
        
        // Increment global strike count on user
        await tx.user.update({
          where: { id: complaint.accusedId },
          data: { strikeCount: newStrikeCount }
        });

        // Notify Complainer
        await tx.notification.create({
          data: {
            userId: complaint.complainerId,
            type: 'GENERAL',
            alertLevel: 'SUCCESS',
            title: 'Complaint Approved',
            body: `Your complaint regarding order ${complaint.orderId} has been approved. Appropriate action has been taken against the accused.`,
          }
        });

        // Strike rules application
        if (newStrikeCount === 5) {
          // Warning
          await tx.notification.create({
            data: {
              userId: complaint.accusedId,
              type: 'WARNING',
              alertLevel: 'WARNING',
              title: 'Warning: 5 Strikes Reached',
              body: `You have reached 5 strikes due to approved complaints. Please adhere to the guidelines to avoid account suspension.`
            }
          });
        } else if (newStrikeCount === 7) {
          // Suspend role for 24h
          const tomorrow = new Date();
          tomorrow.setHours(tomorrow.getHours() + 24);

          await tx.userRoleAccess.upsert({
            where: { userId_role: { userId: complaint.accusedId, role: complaint.accusedRole } },
            create: {
              userId: complaint.accusedId,
              role: complaint.accusedRole,
              status: 'BLOCKED',
              blockedUntil: tomorrow,
              reason: 'Reached 7 strikes'
            },
            update: {
              status: 'BLOCKED',
              blockedUntil: tomorrow,
              reason: 'Reached 7 strikes'
            }
          });

          await tx.notification.create({
            data: {
              userId: complaint.accusedId,
              type: 'WARNING',
              alertLevel: 'CRITICAL',
              title: 'Role Suspended',
              body: `Your ${complaint.accusedRole} role has been suspended for 24 hours due to reaching 7 strikes.`
            }
          });
        } else if (newStrikeCount >= 10) {
          // Block role & impose fee
          await tx.userRoleAccess.upsert({
            where: { userId_role: { userId: complaint.accusedId, role: complaint.accusedRole } },
            create: {
              userId: complaint.accusedId,
              role: complaint.accusedRole,
              status: 'BLOCKED',
              reason: 'Reached 10 strikes',
              unbanFeeStatus: 'PENDING',
              unbanFeeAmount: 1000
            },
            update: {
              status: 'BLOCKED',
              blockedUntil: null,
              reason: 'Reached 10 strikes',
              unbanFeeStatus: 'PENDING',
              unbanFeeAmount: 1000
            }
          });

          await tx.notification.create({
            data: {
              userId: complaint.accusedId,
              type: 'WARNING',
              alertLevel: 'CRITICAL',
              title: 'Role Blocked',
              body: `Your ${complaint.accusedRole} role has been permanently blocked due to 10 strikes. An unban fee of ₹1000 is required.`
            }
          });
        } else {
           // Notify accused of normal strike
           await tx.notification.create({
             data: {
               userId: complaint.accusedId,
               type: 'WARNING',
               alertLevel: 'WARNING',
               title: 'Complaint Approved Against You',
               body: `A complaint against you has been approved. You now have ${newStrikeCount} strikes.`
             }
           });
        }
      } else if (action === 'DISMISS') {
        // Notify Complainer
        await tx.notification.create({
          data: {
            userId: complaint.complainerId,
            type: 'GENERAL',
            alertLevel: 'INFO',
            title: 'Complaint Dismissed',
            body: `Your complaint regarding order ${complaint.orderId} has been reviewed and dismissed. Reason: ${adminRemark || 'No sufficient evidence'}.`,
          }
        });
      } else if (action === 'REQUEST_MORE_EVIDENCE') {
        // Notify Complainer
        await tx.notification.create({
          data: {
            userId: complaint.complainerId,
            type: 'GENERAL',
            alertLevel: 'WARNING',
            title: 'More Evidence Required',
            body: `Admin requested more evidence for your complaint on order ${complaint.orderId}. Please contact support.`,
          }
        });
      }
    });

    res.json({ success: true, message: `Complaint processed successfully: ${action}` });
  } catch (error) {
    console.error("Error processing complaint:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
