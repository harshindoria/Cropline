import { Request, Response } from 'express';
import prisma from '../config/db';
import { haversineDistance } from '../utils/geoUtils';
import { Role, RoleAccessStatus, CropStatus } from '@prisma/client';

export const getSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      search, 
      lat, 
      lng, 
      radius = 50, 
      minRating = 0,
      limit = 20,
      page = 1
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Build the query where clause for users
    const whereClause: any = {
      roles: {
        has: Role.FARMER
      },
      roleAccess: {
        some: {
          role: Role.FARMER,
          status: RoleAccessStatus.ACTIVE
        }
      }
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { village: { contains: String(search), mode: 'insensitive' } },
        { district: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    if (Number(minRating) > 0) {
      whereClause.rating = {
        gte: Number(minRating)
      };
    }

    // Since we need to calculate distances, we'll fetch more than we need (or all that match search/rating) 
    // and then filter in memory if lat/lng is provided. For a huge scale app, we'd use PostGIS, but memory filter is fine here.
    
    // We also need to fetch their active crops to display on the card.
    const farmers = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        village: true,
        district: true,
        state: true,
        latitude: true,
        longitude: true,
        rating: true,
        ratingCount: true,
        isVerified: true,
        createdAt: true,
        crops: {
          where: {
            status: CropStatus.ACTIVE,
            quantityRemainingKg: { gt: 0 }
          },
          select: {
            id: true,
            basePricePerKg: true,
            quantityRemainingKg: true,
            photos: true,
            catalog: {
              select: {
                englishName: true,
                category: true
              }
            }
          },
          take: 4, // Just get up to 4 for the horizontal preview
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    // Post-process for distance filtering
    let processedFarmers = farmers.map(farmer => {
      let distanceKm = null;
      if (lat && lng && farmer.latitude && farmer.longitude) {
        distanceKm = haversineDistance(
          Number(lat), 
          Number(lng), 
          farmer.latitude, 
          farmer.longitude
        );
      }

      // Extract unique categories they sell from their active crops preview
      const categories = new Set<string>();
      farmer.crops.forEach(c => categories.add(c.catalog.category));

      return {
        ...farmer,
        distanceKm,
        categories: Array.from(categories)
      };
    });

    // Filter by radius if coordinates were provided
    if (lat && lng) {
      processedFarmers = processedFarmers.filter(f => 
        f.distanceKm !== null && f.distanceKm <= Number(radius)
      );
      
      // Sort by distance
      processedFarmers.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    } else {
      // Sort by rating if no distance
      processedFarmers.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    // Apply pagination
    const totalCount = processedFarmers.length;
    const paginatedFarmers = processedFarmers.slice(skip, skip + Number(limit));

    res.status(200).json({
      success: true,
      data: {
        suppliers: paginatedFarmers,
        pagination: {
          total: totalCount,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(totalCount / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
