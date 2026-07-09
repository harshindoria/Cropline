import { Request, Response } from 'express'
import { z } from 'zod'
import prisma from '../config/db'
import { uploadToCloudinary } from '../utils/cloudinaryUpload'
import { CropCategory, Prisma, CropStatus, OrderStatus, Role, RoleAccessStatus } from '@prisma/client'
import { haversineDistance } from '../utils/geoUtils'

const preprocessBoolean = (val: unknown) => {
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'true') return true;
    if (val.toLowerCase() === 'false') return false;
  }
  return val;
};

const createCropSchema = z.object({
  // NAYA: cropName aur category hata diye gaye hain, ab sirf catalogId aayega
  catalogId: z.string().min(1, 'Catalog item selection is required'),
  description: z.string().optional(),
  quantityKg: z.coerce.number().positive('Quantity must be positive'),
  basePricePerKg: z.coerce.number().positive('Price must be positive'),
  minOrderKg: z.coerce.number().positive('Minimum order must be positive'),
  harvestDate: z.string().min(1, 'Harvest date is required'),
  farmLatitude: z.coerce.number(),
  farmLongitude: z.coerce.number(),
  farmVillage: z.string().min(1),
  farmDistrict: z.string().min(1),
  farmState: z.string().min(1),
  selfPickupEnabled: z.preprocess(preprocessBoolean, z.boolean().optional().default(false)),
  isPreHarvest: z.preprocess(preprocessBoolean, z.boolean().optional().default(false)),
  preHarvestDeadline: z.string().optional(),
  
  // NAYA: Bulk Offer Logic (Optional)
  offerMinQuantityKg: z.coerce.number().positive('Offer minimum quantity must be positive').optional(),
  offerDiscountPercentage: z.coerce.number().min(1).max(100, 'Discount cannot exceed 100%').optional(),
});

const updateCropSchema = z.object({
  description: z.string().optional(),
  basePricePerKg: z.coerce.number().positive().optional(),
  minOrderKg: z.coerce.number().positive().optional(),
  selfPickupEnabled: z.preprocess(preprocessBoolean, z.boolean().optional()),
  
  // NAYA: Bulk Offer Update karne ke liye
  offerMinQuantityKg: z.coerce.number().positive().optional(),
  offerDiscountPercentage: z.coerce.number().min(1).max(100).optional(),
});

export const createCrop = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Validate request body
    const parsed = createCropSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.issues,
      });
      return;
    }

    // 2. Check photos exist
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one crop photo is required',
      });
      return;
    }

    // 3. Extract data
    const {
      catalogId,
      quantityKg,
      minOrderKg,
      basePricePerKg,
      isPreHarvest,
      preHarvestDeadline,
      offerMinQuantityKg,
      offerDiscountPercentage
    } = parsed.data;

    // 4. Business logic validations
    if (minOrderKg > quantityKg) {
      res.status(400).json({ success: false, message: 'Minimum order quantity cannot exceed total quantity' });
      return;
    }

    if (isPreHarvest && !preHarvestDeadline) {
      res.status(400).json({ success: false, message: 'Pre-harvest deadline is required for pre-harvest listings' });
      return;
    }

    // NAYA: Offer ki dono fields ek sath honi chahiye
    if ((offerMinQuantityKg && !offerDiscountPercentage) || (!offerMinQuantityKg && offerDiscountPercentage)) {
      res.status(400).json({ success: false, message: 'Both minimum quantity and discount percentage are required to set a bulk offer.' });
      return;
    }

    // NAYA: Validate Catalog Item
    const catalogItem = await prisma.cropCatalog.findUnique({ where: { id: catalogId } });
    if (!catalogItem || !catalogItem.isActive) {
      res.status(400).json({ success: false, message: 'Selected crop type is invalid or currently inactive.' });
      return;
    }

    // 5. Upload photos to Cloudinary
    let photoUrls: string[];
    try {
      photoUrls = await Promise.all(
        files.map((file) => uploadToCloudinary(file.buffer, 'khetse/crops'))
      );
    } catch (uploadError) {
      console.error('Cloudinary upload failed:', uploadError);
      res.status(500).json({ success: false, message: 'Failed to upload photos. Please try again.' });
      return;
    }

    // 6. THE MAGIC: Save Crop and Optional Offer in one Atomic query
    const crop = await prisma.crop.create({
      data: {
        farmerId: req.user!.id,
        catalogId: catalogItem.id, // Linked to the catalog
        description: parsed.data.description,
        quantityKg: new Prisma.Decimal(quantityKg),
        quantityRemainingKg: new Prisma.Decimal(quantityKg),
        basePricePerKg: new Prisma.Decimal(basePricePerKg),
        minOrderKg: new Prisma.Decimal(minOrderKg),
        harvestDate: new Date(parsed.data.harvestDate),
        photos: photoUrls,
        farmLatitude: parsed.data.farmLatitude,
        farmLongitude: parsed.data.farmLongitude,
        farmVillage: parsed.data.farmVillage,
        farmDistrict: parsed.data.farmDistrict,
        farmState: parsed.data.farmState,
        selfPickupEnabled: parsed.data.selfPickupEnabled,
        isPreHarvest: parsed.data.isPreHarvest,
        preHarvestDeadline: preHarvestDeadline ? new Date(preHarvestDeadline) : null,
        
        // Agar kisaan ne offer daala hai, toh usko bhi sath mein create karo
        ...(offerMinQuantityKg && offerDiscountPercentage ? {
          offer: {
            create: {
              minQuantityKg: new Prisma.Decimal(offerMinQuantityKg),
              discountPercentage: new Prisma.Decimal(offerDiscountPercentage)
            }
          }
        } : {})
      },
      include: {
        catalog: true, // Response mein hindi/english naam bhejne ke liye
        offer: true    // Response mein offer details bhejne ke liye
      }
    });

    res.status(201).json({
      success: true,
      message: 'Crop listed successfully',
      data: {
        id: crop.id,
        cropName: crop.catalog.englishName, // Frontend ko dikhane ke liye
        hindiName: crop.catalog.hindiName,
        category: crop.catalog.category,
        quantityKg: crop.quantityKg,
        basePricePerKg: crop.basePricePerKg,
        offer: crop.offer,
        status: crop.status,
        photos: crop.photos,
        createdAt: crop.createdAt,
      },
    });
  } catch (error) {
    console.error('Create Crop Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create crop listing' });
  }
};

export const getCrops = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      category, maxPrice, maxFreshnessDays, selfPickup, preHarvest,
      lat, lng, radius, sort, page, limit,
    } = req.query

    // ── Where clause ─────────────────────────────────────────────────────────
    const where: Prisma.CropWhereInput = {
      status: CropStatus.ACTIVE,
      farmer: { roleAccess: { some: { role: Role.FARMER, status: RoleAccessStatus.ACTIVE } } },
    }

    if (preHarvest === 'true') {
      where.isPreHarvest = true
    } else if (preHarvest === 'false') {
      where.isPreHarvest = false
    }

    // 💡 THE FIX: Category ab CropCatalog table ke andar check hogi
    if (category && Object.values(CropCategory).includes(category as CropCategory)) {
      where.catalog = {
        category: category as CropCategory
      }
    }
    
    if (maxPrice) {
      where.basePricePerKg = { lte: new Prisma.Decimal(Number(maxPrice)) }
    }
    if (maxFreshnessDays) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - Number(maxFreshnessDays))
      where.harvestDate = { gte: cutoffDate }
    }
    if (selfPickup === 'true') where.selfPickupEnabled = true

    // ── Pagination ────────────────────────────────────────────────────────────
    const pageNum  = Math.max(Number(page) || 1, 1)
    const limitNum = Math.min(Number(limit) || 12, 50)
    const skip     = (pageNum - 1) * limitNum

    // ── Sorting ───────────────────────────────────────────────────────────────
    let orderBy: Prisma.CropOrderByWithRelationInput = { harvestDate: 'desc' }
    if (sort === 'price_asc')  orderBy = { basePricePerKg: 'asc' }
    if (sort === 'price_desc') orderBy = { basePricePerKg: 'desc' }
    if (sort === 'newest')     orderBy = { createdAt: 'desc' }

    // ── Geo query or normal query ─────────────────────────────────────────────
    const isGeoQuery = !!(lat && lng && radius)
    const dbLimit = isGeoQuery ? 100 : limitNum
    const dbSkip  = isGeoQuery ? 0   : skip

    const [allCrops, dbTotal] = await prisma.$transaction([
      prisma.crop.findMany({
        where,
        include: {
          // 💡 NAYA: Catalog aur Offer ko DB se nikalna zaroori hai frontend ke liye
          catalog: true, 
          offer: true,   
          farmer: {
            select: {
              id: true,
              name: true,
              village: true,
              district: true,
              rating: true,
              ratingCount: true,
              isVerified: true,
            },
          },
        },
        orderBy,
        skip: dbSkip,
        take: dbLimit,
      }),
      prisma.crop.count({ where }),
    ])

    // ── Geospatial filter (application layer) ─────────────────────────────────
    let cropsAfterGeo = allCrops

    if (isGeoQuery) {
      const userLat  = Number(lat)
      const userLng  = Number(lng)
      const radiusKm = Number(radius)

      cropsAfterGeo = allCrops.filter((crop) => {
        const distance = haversineDistance(
          userLat, userLng,
          crop.farmLatitude, crop.farmLongitude
        )
        return distance <= radiusKm
      })
    }

    // ── Manual pagination for geo queries ─────────────────────────────────────
    const geoTotal     = cropsAfterGeo.length
    const geoSkip      = (pageNum - 1) * limitNum
    const finalCrops   = isGeoQuery
      ? cropsAfterGeo.slice(geoSkip, geoSkip + limitNum)
      : cropsAfterGeo

    // ── Add freshnessDays, marketPrice & Reshape Data for Frontend ─────────────
    const avgPrices = await prisma.crop.groupBy({
      by: ['catalogId'],
      where: { status: CropStatus.ACTIVE },
      _avg: { basePricePerKg: true }
    });
    const priceMap = new Map(avgPrices.map(p => [p.catalogId, p._avg.basePricePerKg ? Number(p._avg.basePricePerKg) : null]));

    const cropsWithFreshness = finalCrops.map((crop) => ({
      ...crop,
      cropName: crop.catalog?.englishName,
      hindiName: crop.catalog?.hindiName,
      category: crop.catalog?.category,
      marketPrice: priceMap.get(crop.catalogId) || (crop.basePricePerKg ? Number(crop.basePricePerKg) : null),
      freshnessDays: Math.floor(
        (Date.now() - new Date(crop.harvestDate).getTime()) / (1000 * 60 * 60 * 24)
      ),
    }))

    // ── Correct pagination numbers ────────────────────────────────────────────
    const total      = isGeoQuery ? geoTotal : dbTotal
    const totalPages = Math.ceil(total / limitNum)

    res.status(200).json({
      success: true,
      data: {
        crops: cropsWithFreshness,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
        },
      },
    })
  } catch (error) {
    console.error('Get Crops Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch crops',
    })
  }
}

export const getCropById = async (req : Request<{id : string}>, res : Response) : Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, message: 'Crop id is required' });
      return;
    }

    const crop = await prisma.crop.findUnique({
      where : {id},
      include : {
        catalog: true, // 👈 New: Name aur Category ke liye
        offer: true,   // 👈 New: Discount offer ke liye
        farmer : {
          select : {id : true, name : true, village : true, district : true, state : true, rating : true, ratingCount : true, isVerified : true, createdAt : true},
        }
      }
    });

    if (!crop) {
      res.status(404).json({ success: false, message: 'Crop not found' });
      return;
    }

    // Security check: views increment
    if(req.user?.id !== crop.farmerId){
      await prisma.crop.update({
        where : {id},
        data : {viewsCount : {increment : 1}}
      });
    }

    const avgPrice = await prisma.crop.aggregate({
      where: {
        catalogId: crop.catalogId,
        status: CropStatus.ACTIVE
      },
      _avg: {
        basePricePerKg: true
      }
    });

    const freshnessDays = Math.floor(
      (Date.now() - new Date(crop.harvestDate).getTime())/(1000*60*60*24)
    );

    res.status(200).json({
      success : true,
      data : {
        ...crop,
        // Frontend convenience ke liye flat fields
        cropName: crop.catalog.englishName,
        hindiName: crop.catalog.hindiName,
        marketPrice: avgPrice._avg.basePricePerKg ? Number(avgPrice._avg.basePricePerKg) : (crop.basePricePerKg ? Number(crop.basePricePerKg) : null),
        freshnessDays
      },
    });
  } catch (error) {
    console.error('Get Crop By ID Error : ',error);
    res.status(500).json({ success : false, message: 'Failed to fetch crop' });
  }
}

export const getMyCrops = async (req : Request, res : Response) : Promise<void> => {
  try {
    const {status} = req.query;
    const where : Prisma.CropWhereInput = { farmerId : req.user!.id }

    if(status){
      if(Object.values(CropStatus).includes(status as CropStatus)){
        where.status = status as CropStatus;
      } else {
        res.status(400).json({ success : false, message : "Invalid request" });
        return;
      }
    }

    const crops = await prisma.crop.findMany({
      where,
      orderBy : {createdAt : 'desc'},
      include : {
        catalog: true, // 👈 New: Name ke liye
        offer: true,   // 👈 New: Offer status ke liye
        _count : {select : {orders : true}}
      }
    });

    const avgPrices = await prisma.crop.groupBy({
      by: ['catalogId'],
      where: { status: CropStatus.ACTIVE },
      _avg: { basePricePerKg: true }
    });
    const priceMap = new Map(avgPrices.map(p => [p.catalogId, p._avg.basePricePerKg ? Number(p._avg.basePricePerKg) : null]));

    const cropsWithMetaData = crops.map((crop)=>({
      ...crop,
      cropName: crop.catalog.englishName,
      hindiName: crop.catalog.hindiName,
      marketPrice: priceMap.get(crop.catalogId) || (crop.basePricePerKg ? Number(crop.basePricePerKg) : null),
      freshnessDays : Math.floor(
        (Date.now()-new Date(crop.harvestDate).getTime())/(1000*60*60*24)
      )
    }));

    res.status(200).json({ success : true, data : cropsWithMetaData });
  } catch (error) {
    console.error('Get My Crops Error : ',error);
    res.status(500).json({ success: false, message: 'Failed to fetch your crops' });
  }
}

export const updateCrop = async (req: Request<{id: string}>, res: Response): Promise<void> => {
  try {
    const { id } = req.params; 
    const crop = await prisma.crop.findUnique({ where: { id } });

    if (!crop) {
      res.status(404).json({ success: false, message: "Crop not found" });
      return;
    }

    if (!req.user || crop.farmerId !== req.user.id) {
      res.status(403).json({ success: false, message: "You can only edit your own crops" });
      return;
    }

    if (['BOOKED', 'HARVESTED', 'CLOSED'].includes(crop.status)) {
      res.status(400).json({ success: false, message: `Cannot edit a crop with status: ${crop.status}` });
      return;
    }

    const parsed = updateCropSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.issues });
      return;
    }

    if (parsed.data.minOrderKg && parsed.data.minOrderKg > Number(crop.quantityRemainingKg)) {
      res.status(400).json({ success: false, message: "Minimum order cannot exceed remaining quantity" });
      return;
    }

    // NAYA: Offer validation
    const { offerMinQuantityKg, offerDiscountPercentage } = parsed.data;
    if ((offerMinQuantityKg && !offerDiscountPercentage) || (!offerMinQuantityKg && offerDiscountPercentage)) {
      res.status(400).json({ success: false, message: 'Both minimum quantity and discount percentage are required to update the offer.' });
      return;
    }

    const updatedCrop = await prisma.crop.update({
      where: { id },
      data: {
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.basePricePerKg !== undefined && { basePricePerKg: new Prisma.Decimal(parsed.data.basePricePerKg) }),
        ...(parsed.data.minOrderKg !== undefined && { minOrderKg: new Prisma.Decimal(parsed.data.minOrderKg) }),
        ...(parsed.data.selfPickupEnabled !== undefined && { selfPickupEnabled: parsed.data.selfPickupEnabled }),
        
        // NAYA: Handle Offer Add/Update logic securely
        ...(offerMinQuantityKg && offerDiscountPercentage ? {
          offer: {
            upsert: {
              create: {
                minQuantityKg: new Prisma.Decimal(offerMinQuantityKg),
                discountPercentage: new Prisma.Decimal(offerDiscountPercentage)
              },
              update: {
                minQuantityKg: new Prisma.Decimal(offerMinQuantityKg),
                discountPercentage: new Prisma.Decimal(offerDiscountPercentage)
              }
            }
          }
        } : {})
      },
      include: {
        catalog: true,
        offer: true
      }
    });

    res.status(200).json({
      success: true,
      message: "Crop updated successfully",
      data: updatedCrop
    });
  } catch (error) {
    console.error('Update Crop Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update crop' });
  }
};

export const pauseCrop = async(req : Request<{id : string}>, res : Response) : Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, message: 'Crop id is required' });
      return;
    }
    const crop = await prisma.crop.findUnique({where : {id}});
    if(!crop){
      res.status(404).json({
        success : false,
        message : "Crop Not Found"
      })
      return;
    }
    if(crop.farmerId !== req.user!.id){
      res.status(403).json({
        success : false,
        message : "You can only pause your own crops"
      });
      return;
    }

    if(crop.status !== CropStatus.ACTIVE){
      res.status(400).json({
        success : false,
        message : "Only ACTIVE crops can be paused"
      });
      return;
    }

    const updated = await prisma.crop.update({
      where : {id},
      data : {status : CropStatus.PAUSED}
    });

    res.status(200).json({ success: true, message: 'Crop paused', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to pause crop' });
  }
}

export const resumeCrop = async (req : Request<{id : string}>, res : Response) : Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, message: 'Crop id is required' });
      return;
    }
    const crop = await prisma.crop.findUnique({where : {id}});
    if(!crop){
      res.status(404).json({
        success : false,
        message : "Crop Not Found"
      })
      return;
    }
    if(crop.farmerId !== req.user!.id){
      res.status(403).json({
        success : false,
        message : "You can only resume your own crops"
      });
      return;
    }

    if(crop.status !== CropStatus.PAUSED){
      res.status(400).json({
        success : false,
        message : "Only PAUSED crops can be resumed"
      });
      return;
    }

    const updated = await prisma.crop.update({
      where : {id},
      data : {status : CropStatus.ACTIVE}
    });

    res.status(200).json({ success: true, message: 'Crop resumed', data: updated });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to resume crop' });
  }
}

// ── DELETE CROP (soft delete) ─────────────────────────────────────────────────
export const deleteCrop = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, message: 'Crop id is required' });
      return;
    }

    // 1. Find crop
    const crop = await prisma.crop.findUnique({ where: { id } });

    if (!crop) {
      res.status(404).json({ success: false, message: 'Crop not found' });
      return;
    }

    // 2. Ownership verification
    if (crop.farmerId !== req.user!.id) {
      res.status(403).json({ success: false, message: 'You can only delete your own crops' });
      return;
    }

    // 3. Status check
    if (crop.status === CropStatus.CLOSED) {
      res.status(400).json({ success: false, message: 'Crop is already closed' });
      return;
    }

    // 4. Active Orders Check (The most critical business rule)
    const activeOrderCount = await prisma.order.count({
      where: {
        cropId: id,
        status: {
          in: [
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.READY_FOR_PICKUP,
            OrderStatus.ASSIGNED,
            OrderStatus.PICKED_UP,
            OrderStatus.IN_DELIVERY
          ],
        },
      },
    });

    if (activeOrderCount > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot close crop with ${activeOrderCount} active order(s). Wait for them to complete.`,
      });
      return;
    }

    // 5. Soft Delete (Update status instead of deleting the record)
    await prisma.crop.update({
      where: { id },
      data: { status: CropStatus.CLOSED },
    });

    res.status(200).json({ success: true, message: 'Crop listing closed successfully' });
  } catch (error) {
    console.error('Delete Crop Error:', error);
    res.status(500).json({ success: false, message: 'Failed to close crop' });
  }
};

// ── GET CATALOG ─ Returns all active CropCatalog items grouped by category ──
export const getCatalog = async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await prisma.cropCatalog.findMany({
      where: { isActive: true },
      orderBy: { englishName: 'asc' },
    });

    const avgPrices = await prisma.crop.groupBy({
      by: ['catalogId'],
      where: { status: CropStatus.ACTIVE },
      _avg: { basePricePerKg: true }
    });
    const priceMap = new Map(avgPrices.map(p => [p.catalogId, p._avg.basePricePerKg ? Number(p._avg.basePricePerKg) : null]));

    const itemsWithMarketPrice = items.map(item => ({
      ...item,
      marketPrice: priceMap.get(item.id) || null
    }));

    // Group by category
    const grouped: Record<string, typeof itemsWithMarketPrice> = {};
    for (const item of itemsWithMarketPrice) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    res.json({ success: true, catalog: itemsWithMarketPrice, grouped });
  } catch (error) {
    console.error('Get Catalog Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch catalog' });
  }
};

// ── GET FARMER STATS ─ Aggregated earnings, monthly breakdown, crop sales ──
export const getFarmerStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false }); return; }
    const farmerId = req.user.id;

    // 1. Crop counts
    const crops = await prisma.crop.findMany({
      where: { farmerId },
      select: {
        id: true, status: true, quantityKg: true, quantityRemainingKg: true,
        basePricePerKg: true, catalogId: true,
        catalog: { select: { englishName: true, hindiName: true, category: true } },
      },
    });

    const activeCrops = crops.filter(c => c.status === CropStatus.ACTIVE).length;
    const totalCrops = crops.length;

    // 2. Order stats
    const orders = await prisma.order.findMany({
      where: { farmerId },
      select: {
        id: true, status: true, farmerEarnings: true, quantityKg: true,
        createdAt: true,
        crop: { select: { catalog: { select: { englishName: true } } } },
      },
    });

    const completedOrders = orders.filter(o =>
      o.status === OrderStatus.COMPLETED || o.status === OrderStatus.DELIVERED
    );
    const pendingOrders = orders.filter(o =>
      o.status === OrderStatus.PENDING || o.status === OrderStatus.CONFIRMED ||
      o.status === OrderStatus.READY_FOR_PICKUP
    );

    // 3. Total earnings
    const totalEarnings = completedOrders.reduce(
      (sum, o) => sum + Number(o.farmerEarnings), 0
    );
    const totalQuantitySold = completedOrders.reduce(
      (sum, o) => sum + Number(o.quantityKg), 0
    );

    // 4. Monthly earnings (last 6 months)
    const now = new Date();
    const monthlyEarnings: { month: string; earnings: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const monthName = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });

      const monthOrders = completedOrders.filter(o =>
        o.createdAt >= monthStart && o.createdAt <= monthEnd
      );
      const earnings = monthOrders.reduce((s, o) => s + Number(o.farmerEarnings), 0);
      monthlyEarnings.push({ month: monthName, earnings });
    }

    // 5. Crop-wise sales
    const cropSalesMap: Record<string, { name: string; sold: number; earned: number }> = {};
    for (const o of completedOrders) {
      const name = o.crop?.catalog?.englishName || 'Unknown';
      if (!cropSalesMap[name]) cropSalesMap[name] = { name, sold: 0, earned: 0 };
      cropSalesMap[name].sold += Number(o.quantityKg);
      cropSalesMap[name].earned += Number(o.farmerEarnings);
    }
    const cropSales = Object.values(cropSalesMap).sort((a, b) => b.earned - a.earned);

    // 6. Recent transactions (last 10 completed orders)
    const recentTransactions = completedOrders
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map(o => ({
        id: o.id,
        cropName: o.crop?.catalog?.englishName || 'Unknown',
        quantityKg: Number(o.quantityKg),
        earned: Number(o.farmerEarnings),
        date: o.createdAt,
      }));

    res.json({
      success: true,
      stats: {
        totalCrops,
        activeCrops,
        totalOrders: orders.length,
        pendingOrders: pendingOrders.length,
        completedOrders: completedOrders.length,
        totalEarnings,
        totalQuantitySold,
        walletBalance: Number(req.user.walletBalance),
        monthlyEarnings,
        cropSales,
        recentTransactions,
      },
    });
  } catch (error) {
    console.error('Get Farmer Stats Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch farmer stats' });
  }
};
