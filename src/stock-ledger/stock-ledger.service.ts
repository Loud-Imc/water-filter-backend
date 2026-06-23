import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StockLedgerService {
  constructor(private prisma: PrismaService) {}

  async getLedger(query: {
    itemType?: 'PRODUCT' | 'SPARE_PART';
    itemId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const { itemType, itemId, startDate, endDate, search } = query;
    let productHistory: any[] = [];
    let sparePartHistory: any[] = [];

    // Base conditions for product stock history
    const productWhere: any = {};
    if (itemId) {
      productWhere.productId = itemId;
    }
    if (startDate || endDate) {
      productWhere.createdAt = {};
      if (startDate) productWhere.createdAt.gte = new Date(startDate);
      if (endDate) productWhere.createdAt.lte = new Date(endDate);
    }
    if (search) {
      productWhere.OR = [
        { reason: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { product: { sku: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Base conditions for spare part stock history
    const sparePartWhere: any = {};
    if (itemId) {
      sparePartWhere.sparePartId = itemId;
    }
    if (startDate || endDate) {
      sparePartWhere.createdAt = {};
      if (startDate) sparePartWhere.createdAt.gte = new Date(startDate);
      if (endDate) sparePartWhere.createdAt.lte = new Date(endDate);
    }
    if (search) {
      sparePartWhere.OR = [
        { reason: { contains: search, mode: 'insensitive' } },
        { sparePart: { name: { contains: search, mode: 'insensitive' } } },
        { sparePart: { sku: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Fetch product history if needed
    if (!itemType || itemType === 'PRODUCT') {
      productHistory = await this.prisma.productStockHistory.findMany({
        where: productWhere,
        include: {
          product: {
            select: {
              name: true,
              sku: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Fetch spare part history if needed
    if (!itemType || itemType === 'SPARE_PART') {
      sparePartHistory = await this.prisma.sparePartStockHistory.findMany({
        where: sparePartWhere,
        include: {
          sparePart: {
            select: {
              name: true,
              sku: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Map and merge
    const productMapped = productHistory.map((item) => ({
      id: item.id,
      itemId: item.productId,
      itemName: item.product.name,
      itemType: 'PRODUCT',
      sku: item.product.sku,
      quantityChange: item.quantityChange,
      reason: item.reason,
      createdAt: item.createdAt,
    }));

    const sparePartMapped = sparePartHistory.map((item) => ({
      id: item.id,
      itemId: item.sparePartId,
      itemName: item.sparePart.name,
      itemType: 'SPARE_PART',
      sku: item.sparePart.sku,
      quantityChange: item.quantityChange,
      reason: item.reason,
      createdAt: item.createdAt,
    }));

    const merged = [...productMapped, ...sparePartMapped];

    // Sort by createdAt descending
    merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return merged;
  }
}
