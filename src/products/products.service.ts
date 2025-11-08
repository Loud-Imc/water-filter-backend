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

    return this.prisma.product.create({ data });
  }

  async findAll() {
    return this.prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: {
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
        stockHistory: {
          orderBy: { createdAt: 'desc' },
          take: 5, // Last 5 stock changes
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(id: string, data: UpdateProductDto) {
    await this.findOne(id); // Check if exists

    if (data.hasWarranty === false) {
      // Clear warranty fields if warranty is disabled
      return this.prisma.product.update({
        where: { id },
        data: {
          ...data,
          warrantyMonths: null,
          warrantyYears: null,
        },
      });
    }

    return this.prisma.product.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prisma.product.delete({ where: { id } });
  }

  // Get low stock products (stock < 5)
//   async getLowStockProducts() {
//     return this.prisma.product.findMany({
//       where: {
//         stock: {
//           lt: 5,
//         },
//       },
//       orderBy: { stock: 'asc' },
//     });
//   }

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

    // Log to stock history
    await this.prisma.stockHistory.create({
      data: {
        productId: id,
        quantityChange,
        reason,
      },
    });

    return { newStock, message: `Stock updated: ${reason}` };
  }

  // Add these methods:

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
    });
  }
}
