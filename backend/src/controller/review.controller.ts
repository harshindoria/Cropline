import { Request, Response } from 'express';
import prisma from '../config/db';
import { ReviewTargetType } from '@prisma/client';

export const getMyReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const allReviews = await prisma.review.findMany({
      where: { targetId: userId },
      include: {
        reviewer: { select: { id: true, name: true } },
        order: {
          include: { crop: { select: { id: true, catalog: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    let totalRating = 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const textReviews: any[] = [];

    allReviews.forEach((r: any) => {
      totalRating += r.rating;
      distribution[r.rating as keyof typeof distribution] += 1;
      
      // Only return comments to frontend if there is text.
      if (r.comment && r.comment.trim() !== '') {
        textReviews.push(r);
      }
    });

    const averageRating = allReviews.length > 0 ? (totalRating / allReviews.length).toFixed(1) : '0.0';

    res.status(200).json({
      success: true,
      data: {
        averageRating: parseFloat(averageRating as string),
        totalCount: allReviews.length,
        distribution,
        textReviews
      }
    });

  } catch (error) {
    console.error('Get My Reviews Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
};

export const submitReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, targetId, targetType, rating, comment } = req.body;
    const reviewerId = req.user!.id;

    if (!orderId || !targetId || !targetType || !rating) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
      return;
    }

    // Verify order exists and belongs to the reviewer
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    if (order.buyerId !== reviewerId) {
      res.status(403).json({ success: false, message: 'You are not authorized to review this order' });
      return;
    }

    // Check if review already exists
    const existing = await prisma.review.findUnique({
      where: {
        orderId_reviewerId_targetId: {
          orderId,
          reviewerId,
          targetId
        }
      }
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'You have already reviewed this user for this order' });
      return;
    }

    // Create the review
    const review = await prisma.review.create({
      data: {
        orderId,
        reviewerId,
        targetId,
        targetType: targetType as ReviewTargetType,
        rating: Number(rating),
        comment: comment || null
      }
    });

    // Update target user's rating aggregate
    const allTargetReviews = await prisma.review.findMany({
      where: { targetId }
    });
    const avg = allTargetReviews.reduce((acc: number, r: any) => acc + r.rating, 0) / allTargetReviews.length;

    await prisma.user.update({
      where: { id: targetId },
      data: {
        rating: parseFloat(avg.toFixed(1)),
        ratingCount: allTargetReviews.length
      }
    });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    console.error('Submit Review Error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
};
