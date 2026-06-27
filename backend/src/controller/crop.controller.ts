import { Request, Response } from 'express'
import { z } from 'zod'
import prisma from '../config/db'
import { uploadToCloudinary } from '../utils/cloudinaryUpload'
import { CropCategory, Prisma, PlanType, CropStatus , OrderStatus} from '@prisma/client'
import { haversineDistance } from '../utils/geoUtils'

const createCropSchema = z.object({
  cropName: z.string().min(1, 'Crop name is required'),
  category: z.nativeEnum(CropCategory),
  description: z.string().optional(),
  quantityKg: z.coerce.number().positive('Quantity must be positive'),
  pricePerKg: z.coerce.number().positive('Price must be positive'),
  minOrderKg: z.coerce.number().positive('Minimum order must be positive'),
  harvestDate: z.string().min(1, 'Harvest date is required'),
  farmLatitude: z.coerce.number(),
  farmLongitude: z.coerce.number(),
  farmVillage: z.string().min(1),
  farmDistrict: z.string().min(1),
  farmState: z.string().min(1),
  selfPickupEnabled: z.coerce.boolean().optional().default(false),
  isPreHarvest: z.coerce.boolean().optional().default(false),
  preHarvestDeadline: z.string().optional(),
});

const updateCropSchema = z.object({
  description : z.string().optional(),
  pricePerKg : z.coerce.number().positive().optional(),
  minOrderKg : z.coerce.number().positive().optional(),
  selfPickupEnabled : z.coerce.boolean().optional(),
});

export const createCrop = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Validate request body
    const parsed = createCropSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.issues,
      })
      return;
    }

    // 2. Check photos exist
    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one crop photo is required',
      })
      return;
    }

    // 3. Business logic validation BEFORE any upload
    const {
      quantityKg,
      minOrderKg,
      pricePerKg,
      isPreHarvest,
      preHarvestDeadline,
    } = parsed.data

    if (minOrderKg > quantityKg) {
      res.status(400).json({
        success: false,
        message: 'Minimum order quantity cannot exceed total quantity',
      })
      return
    }

    if (isPreHarvest && !preHarvestDeadline) {
      res.status(400).json({
        success: false,
        message: 'Pre-harvest deadline is required for pre-harvest listings',
      })
      return
    }

    // 4. Plan limit check
    const membership = await prisma.membershipPayment.findUnique({
      where: { id: req.user!.id },
      select: { planType: true },
    })

    // Fix — use req.user directly, zero DB queries:
    if (req.user!.planType === PlanType.FREE) {
      const activeListings = await prisma.crop.count({
        where: {
          farmerId: req.user!.id,
          status: { in: [CropStatus.ACTIVE, CropStatus.PAUSED] },
        },
      })
      if (activeListings >= 3) {
        res.status(403).json({
          success: false,
          message: 'Free plan allows maximum 3 listings. Upgrade to Pro.',
        })
        return
      }
    }

    // 5. Upload photos to Cloudinary AFTER all validations pass
    let photoUrls: string[]
    try {
      photoUrls = await Promise.all(
        files.map((file) => uploadToCloudinary(file.buffer, 'khetse/crops'))
      )
    } catch (uploadError) {
      console.error('Cloudinary upload failed:', uploadError)
      res.status(500).json({
        success: false,
        message: 'Failed to upload photos. Please try again.',
      })
      return
    }

    // 6. Save to database
    const crop = await prisma.crop.create({
      data: {
        farmerId: req.user!.id,
        cropName: parsed.data.cropName,
        category: parsed.data.category,
        description: parsed.data.description,
        quantityKg: new Prisma.Decimal(quantityKg),
        quantityRemainingKg: new Prisma.Decimal(quantityKg),
        pricePerKg: new Prisma.Decimal(pricePerKg),
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
        preHarvestDeadline: preHarvestDeadline
          ? new Date(preHarvestDeadline)
          : null,
      },
    })

    res.status(201).json({
      success: true,
      message: 'Crop listed successfully',
      data: {
        id: crop.id,
        cropName: crop.cropName,
        category: crop.category,
        quantityKg: crop.quantityKg,
        pricePerKg: crop.pricePerKg,
        status: crop.status,
        photos: crop.photos,
        createdAt: crop.createdAt,
      },
    })
  } catch (error) {
    console.error('Create Crop Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create crop listing',
    })
  }
}

export const getCrops = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      category, maxPrice, maxFreshnessDays, selfPickup, preHarvest,
      lat, lng, radius, sort, page, limit,
    } = req.query

    // ── Where clause ─────────────────────────────────────────────────────────
    const where: Prisma.CropWhereInput = {
      status: CropStatus.ACTIVE,
    }

    if (category && Object.values(CropCategory).includes(category as CropCategory)) {
      where.category = category as CropCategory
    }
    if (maxPrice) {
      where.pricePerKg = { lte: new Prisma.Decimal(Number(maxPrice)) }
    }
    if (maxFreshnessDays) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - Number(maxFreshnessDays))
      where.harvestDate = { gte: cutoffDate }
    }
    if (selfPickup === 'true') where.selfPickupEnabled = true
    if (preHarvest === 'true') where.isPreHarvest = true

    // ── Pagination ────────────────────────────────────────────────────────────
    const pageNum  = Math.max(Number(page) || 1, 1)
    const limitNum = Math.min(Number(limit) || 12, 50)
    const skip     = (pageNum - 1) * limitNum

    // ── Sorting ───────────────────────────────────────────────────────────────
    let orderBy: Prisma.CropOrderByWithRelationInput = { harvestDate: 'desc' }
    if (sort === 'price_asc')  orderBy = { pricePerKg: 'asc' }
    if (sort === 'price_desc') orderBy = { pricePerKg: 'desc' }
    if (sort === 'newest')     orderBy = { createdAt: 'desc' }

    // ── Geo query or normal query ─────────────────────────────────────────────
    // THE FIX FOR ISSUE 4:
    //
    // Problem: When lat/lng/radius is provided, we fetch only 'limitNum' crops
    // from DB (e.g. 12), then filter by distance. After filtering we might have
    // only 2-3 crops left, but there could be more within radius on the next
    // page that we never even fetched. Pagination also becomes wrong because
    // 'total' from DB count includes crops outside the radius.
    //
    // Solution: When geo filter is active, fetch a larger batch from DB (100)
    // starting from skip=0, filter ALL of them by distance, then manually
    // slice for pagination. This way we always have enough results.
    //
    // Note: This is an MVP solution. Phase 2 will use PostGIS ST_DWithin
    // which does the distance filter inside PostgreSQL — much faster at scale.

    const isGeoQuery = !!(lat && lng && radius)

    // When geo query: fetch up to 100 from DB (ignore pagination at DB level)
    // When normal:    fetch only limitNum with proper skip (standard pagination)
    const dbLimit = isGeoQuery ? 100 : limitNum
    const dbSkip  = isGeoQuery ? 0   : skip

    const [allCrops, dbTotal] = await prisma.$transaction([
      prisma.crop.findMany({
        where,
        include: {
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
    // For geo queries: cropsAfterGeo has all matching crops (up to 100)
    // We now manually slice it to give the correct page
    // For normal queries: DB already handled pagination, no slicing needed
    const geoTotal     = cropsAfterGeo.length
    const geoSkip      = (pageNum - 1) * limitNum
    const finalCrops   = isGeoQuery
      ? cropsAfterGeo.slice(geoSkip, geoSkip + limitNum)
      : cropsAfterGeo

    // ── Add freshnessDays ─────────────────────────────────────────────────────
    const cropsWithFreshness = finalCrops.map((crop) => ({
      ...crop,
      freshnessDays: Math.floor(
        (Date.now() - new Date(crop.harvestDate).getTime()) / (1000 * 60 * 60 * 24)
      ),
    }))

    // ── Correct pagination numbers ────────────────────────────────────────────
    // For geo queries: total and totalPages are based on distance-filtered count
    // For normal queries: total and totalPages are based on DB count
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
    
    const {id}  = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Crop id is required',
      });
      return;
    }

    const [crop] = await Promise.all([
      prisma.crop.findUnique({
        where : {id},
        include : {
          farmer : {
            select : {id : true, name : true, village : true,district : true, state : true, rating : true, ratingCount : true, isVerified : true, createdAt : true},
          }
        }
      }),

      prisma.crop.updateMany({
        where : {id},
        data : {viewsCount : {increment : 1}}
      }),
    ]);

    if (!crop) {
      res.status(404).json({
        success: false,
        message: 'Crop not found',
      });
      return;
    }

    const freshnessDays = Math.floor(
      (Date.now() - new Date(crop.harvestDate).getTime())/(1000*60*60*24)
    );

    res.status(200).json({
      success : true,
      data : {
        ...crop,
        freshnessDays
      },
    });

  } catch (error) {
    console.error('Get Crop By ID Error : ',error);
    res.status(500).json({
      success : false,
      message : 'Failed to fetch crop'
    });
  }
}

export const getMyCrops = async (req : Request, res : Response) : Promise<void> => {
  try {
    const {status} = req.query;

    const where : Prisma.CropWhereInput = {
      farmerId : req.user!.id
    }

    if(status){
      if(Object.values(CropStatus).includes(status as CropStatus)){
        where.status = status as CropStatus;
      }
      else{
        res.status(400).json({
          success : false,
          message : "Invalid request"
        });
        return;
      }
    }

    const crops = await prisma.crop.findMany({
      where,
      orderBy : {createdAt : 'desc'},
      include : {
        _count : {select : {orders : true}}
      }
    });

    const cropsWithMetaData = crops.map((crop)=>({
      ...crop,
      freshnessDays : Math.floor(
        (Date.now()-new Date(crop.harvestDate).getTime())/(1000*60*60*24)
      )
    }) );

    res.status(200).json({
      success : true,
      data : cropsWithMetaData
    });

    
  } catch (error) {
    console.error('Get My Crops Error : ',error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your crops',
    });
  }
}

export const updateCrop = async (req: Request<{id : string}>, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // Express mein direct id mil jati hai
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

    const updatedCrop = await prisma.crop.update({
      where: { id },
      data: {
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.pricePerKg !== undefined && { pricePerKg: new Prisma.Decimal(parsed.data.pricePerKg) }),
        ...(parsed.data.minOrderKg !== undefined && { minOrderKg: new Prisma.Decimal(parsed.data.minOrderKg) }),
        ...(parsed.data.selfPickupEnabled !== undefined && { selfPickupEnabled: parsed.data.selfPickupEnabled }),
      }
    });

    res.status(200).json({
      success: true,
      data: updatedCrop,
      message: "Crop updated successfully"
    });
  } catch (error) {
    console.error('Update Crop Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update crop' });
  }
}

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