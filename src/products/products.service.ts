import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateProductDto) {
    // Validate warranty input
    if (data.hasWarranty) {
      if (!data.warrantyMonths && !data.warrantyYears) {
        throw new BadRequestException(
          'Please provide warranty duration (months or years)',
        );
      }
    }

    // ✅ NEW: Validate category exists if provided
    if (data.categoryId) {
      const category = await this.prisma.productCategory.findUnique({
        where: { id: data.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Product category not found');
      }

      if (!category.isActive) {
        throw new BadRequestException(
          'Cannot assign product to inactive category',
        );
      }
    }

    return this.prisma.product.create({
      data,
      include: {
        category: true, // ✅ NEW: Include category in response
      },
    });
  }

  async findAll(categoryId?: string) {
    const where = categoryId ? { categoryId } : {};

    return this.prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        category: true, // ✅ NEW: Include category
        _count: {
          select: {
            stockHistory: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true, // ✅ NEW: Include category
        stockHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Last 10 stock changes
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  // ✅ NEW: Get products by category
  async getByCategory(categoryId: string) {
    const category = await this.prisma.productCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.product.findMany({
      where: { categoryId },
      orderBy: { name: 'asc' },
      include: {
        category: true,
      },
    });
  }

  async update(id: string, data: UpdateProductDto) {
    await this.findOne(id); // Check if exists

    // ✅ NEW: Validate category if being updated
    if (data.categoryId) {
      const category = await this.prisma.productCategory.findUnique({
        where: { id: data.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Product category not found');
      }

      if (!category.isActive) {
        throw new BadRequestException(
          'Cannot assign product to inactive category',
        );
      }
    }

    if (data.hasWarranty === false) {
      // Clear warranty fields if warranty is disabled
      return this.prisma.product.update({
        where: { id },
        data: {
          ...data,
          warrantyMonths: null,
          warrantyYears: null,
        },
        include: {
          category: true, // ✅ NEW
        },
      });
    }

    return this.prisma.product.update({
      where: { id },
      data,
      include: {
        category: true, // ✅ NEW
      },
    });
  }

  async delete(id: string) {
    await this.findOne(id);

    // ✅ NEW: Check if product is used in any BOM templates
    const bomUsage = await this.prisma.bOMTemplate.count({
      where: { productId: id },
    });

    if (bomUsage > 0) {
      throw new BadRequestException(
        'Cannot delete product because it has BOM template(s). Delete BOM templates first.',
      );
    }

    // Check if product is used in service requests
    const serviceUsage = await this.prisma.serviceUsedProduct.count({
      where: { productId: id },
    });

    if (serviceUsage > 0) {
      throw new BadRequestException(
        'Cannot delete product because it has been used in service requests',
      );
    }

    return this.prisma.product.delete({ where: { id } });
  }

  // Update stock
  async updateStock(id: string, quantityChange: number, reason: string) {
    const product = await this.findOne(id);

    const newStock = product.stock + quantityChange;

    if (newStock < 0) {
      throw new BadRequestException('Insufficient stock');
    }

    // Update product stock
    await this.prisma.product.update({
      where: { id },
      data: { stock: newStock },
    });

    // Log to stock history (using ProductStockHistory, not StockHistory)
    await this.prisma.productStockHistory.create({
      data: {
        productId: id,
        quantityChange,
        reason,
      },
    });

    return { newStock, message: `Stock updated: ${reason}` };
  }

  // System settings helper methods
  async getSystemSetting(key: string) {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    return setting ? JSON.parse(setting.value) : null;
  }

  async setSystemSetting(key: string, value: any, userId?: string) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: {
        value: JSON.stringify(value),
        updatedBy: userId,
      },
      create: {
        key,
        value: JSON.stringify(value),
        updatedBy: userId,
      },
    });
  }

  async getLowStockThreshold() {
    const threshold = await this.getSystemSetting('low_stock_threshold');
    return threshold || 5; // Default: 5
  }

  async setLowStockThreshold(value: number, userId?: string) {
    if (value < 0) throw new BadRequestException('Threshold must be positive');
    return this.setSystemSetting('low_stock_threshold', value, userId);
  }

  async getLowStockProducts(threshold?: number) {
    if (!threshold) {
      threshold = await this.getLowStockThreshold();
    }

    return this.prisma.product.findMany({
      where: {
        stock: {
          lte: threshold,
        },
      },
      orderBy: { stock: 'asc' },
      include: {
        category: true, // ✅ NEW
      },
    });
  }

  async getLowStockCount(threshold?: number) {
    if (!threshold) {
      threshold = await this.getLowStockThreshold();
    }

    return this.prisma.product.count({
      where: {
        stock: {
          lte: threshold,
        },
      },
    });
  }

  async getFilteredProducts(filters: {
    categoryId?: string; // ✅ NEW
    company?: string;
    minPrice?: number;
    maxPrice?: number;
    minStock?: number;
    maxStock?: number;
    searchTerm?: string;
    sortBy?: 'name' | 'price' | 'stock';
    sortOrder?: 'asc' | 'desc';
  }) {
    const where: any = {};

    // ✅ NEW: Filter by category
    if (filters.categoryId) where.categoryId = filters.categoryId;

    if (filters.company) where.company = filters.company;

    if (filters.searchTerm) {
      where.OR = [
        { name: { contains: filters.searchTerm, mode: 'insensitive' } },
        { sku: { contains: filters.searchTerm, mode: 'insensitive' } },
      ];
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) where.price.gte = filters.minPrice;
      if (filters.maxPrice !== undefined) where.price.lte = filters.maxPrice;
    }

    if (filters.minStock !== undefined || filters.maxStock !== undefined) {
      where.stock = {};
      if (filters.minStock !== undefined) where.stock.gte = filters.minStock;
      if (filters.maxStock !== undefined) where.stock.lte = filters.maxStock;
    }

    return this.prisma.product.findMany({
      where,
      orderBy: {
        [filters.sortBy || 'name']: filters.sortOrder || 'asc',
      },
      include: {
        category: true, // ✅ NEW
      },
    });
  }
}
