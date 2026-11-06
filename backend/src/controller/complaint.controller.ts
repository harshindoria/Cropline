import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import prisma from '../config/db';
import { ACTIVE_JOB } from '../utils/deliveryJob';

const complaintSchema = z.object({
  orderId: z.string().min(1),
  accusedId: z.string().min(1),
  reason: z.enum(['Late Delivery', 'Damaged Goods', 'Wrong Product', 'Misbehavior', 'Fraud', 'Payment Issue', 'Other']),
  description: z.string().trim().max(2000).optional(),
});

export const createComplaint = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = complaintSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: parsed.error.issues[0].message });
      return;
    }

    const { orderId, accusedId, reason, description } = parsed.data;
    const complainerId = req.user!.id;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { deliveryJobs: { where: ACTIVE_JOB, take: 1 } },
    });
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Only the people on an order can complain about it, and only about each other.
    const roleOnOrder = new Map<string, Role>([
      [order.buyerId, Role.BUYER],
      [order.farmerId, Role.FARMER],
    ]);
    const partnerId = order.deliveryJobs[0]?.deliveryPartnerId;
    if (partnerId) roleOnOrder.set(partnerId, Role.DELIVERY);

    if (!roleOnOrder.has(complainerId)) {
      res.status(403).json({ success: false, message: 'You are not part of this order' });
      return;
    }

    const accusedRole = roleOnOrder.get(accusedId);
    if (!accusedRole || accusedId === complainerId) {
      res.status(400).json({ success: false, message: 'You can only complain about someone else on this order' });
      return;
    }

    const complaint = await prisma.complaint.create({
      data: { orderId, complainerId, accusedId, accusedRole, reason, description },
    });
    res.status(201).json({ success: true, data: complaint });
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      res.status(409).json({ success: false, message: 'You have already complained about this person on this order.' });
      return;
    }
    console.error('Create Complaint Error:', error);
    res.status(500).json({ success: false, message: 'Could not submit your complaint' });
  }
};
