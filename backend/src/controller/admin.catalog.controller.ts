import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/db';
import { uploadToCloudinary } from '../utils/cloudinaryUpload';
import { CropCategory, CropStatus } from '@prisma/client';

const createCatalogSchema = z.object({
  englishName: z.string().min(2),
  hindiName: z.string().min(2),
  category: z.nativeEnum(CropCategory),
  isActive: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional().default(true)),
});

const updateCatalogSchema = z.object({
  englishName: z.string().min(2).optional(),
  hindiName: z.string().min(2).optional(),
  category: z.nativeEnum(CropCategory).optional(),
  isActive: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()),
});

// GET /admin/catalog
export const getAdminCatalog = async (req: Request, res: Response): Promise<void> => {
  try {
    const catalog = await prisma.cropCatalog.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        crops: {
          select: {
            farmerId: true,
            status: true,
          }
        }
      }
    });

    const catalogWithStats = catalog.map(item => {
      const activeListings = item.crops.filter(c => c.status === CropStatus.ACTIVE).length;
      const uniqueFarmers = new Set(item.crops.map(c => c.farmerId)).size;
      return {
        id: item.id,
        englishName: item.englishName,
        hindiName: item.hindiName,
        category: item.category,
        imageTemplate: item.imageTemplate,
        isActive: item.isActive,
        createdAt: item.createdAt,
        stats: {
          activeListings,
          totalFarmersUsing: uniqueFarmers,
        }
      };
    });

    res.json({ success: true, catalog: catalogWithStats });
  } catch (error) {
    console.error('Error fetching admin catalog:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch catalog.' });
  }
};

// POST /admin/catalog
export const createCatalogItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createCatalogSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid data', errors: parsed.error.issues });
      return;
    }

    let imageTemplate = null;
    if (req.file) {
      imageTemplate = await uploadToCloudinary(req.file.buffer, 'crop_catalog');
    }

    const newItem = await prisma.cropCatalog.create({
      data: {
        ...parsed.data,
        imageTemplate,
      }
    });

    res.json({ success: true, item: newItem });
  } catch (error) {
    console.error('Error creating catalog item:', error);
    res.status(500).json({ success: false, message: 'Failed to create catalog item.' });
  }
};

// PATCH /admin/catalog/:id
export const updateCatalogItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const parsed = updateCatalogSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid data', errors: parsed.error.issues });
      return;
    }

    let imageTemplate = undefined;
    if (req.file) {
      imageTemplate = await uploadToCloudinary(req.file.buffer, 'crop_catalog');
    }

    const updatedItem = await prisma.cropCatalog.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(imageTemplate && { imageTemplate }),
      }
    });

    res.json({ success: true, item: updatedItem });
  } catch (error) {
    console.error('Error updating catalog item:', error);
    res.status(500).json({ success: false, message: 'Failed to update catalog item.' });
  }
};

// DELETE /admin/catalog/:id
export const deleteCatalogItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const count = await prisma.crop.count({ where: { catalogId: id } });
    if (count > 0) {
      res.status(400).json({ success: false, message: 'Cannot delete crop. It is currently being used by farmers.' });
      return;
    }

    await prisma.cropCatalog.delete({ where: { id } });
    res.json({ success: true, message: 'Catalog item deleted successfully.' });
  } catch (error) {
    console.error('Error deleting catalog item:', error);
    res.status(500).json({ success: false, message: 'Failed to delete catalog item.' });
  }
};
