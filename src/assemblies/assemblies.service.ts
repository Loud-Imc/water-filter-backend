import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssembliesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    productId?: string;
    bomTemplateId?: string;
    assembledBy?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    const where: any = {};

    if (filters.productId) where.productId = filters.productId;
    if (filters.bomTemplateId) where.bomTemplateId = filters.bomTemplateId;
    if (filters.assembledBy) where.assembledBy = filters.assembledBy;

    if (filters.startDate || filters.endDate) {
      where.assembledAt = {};
      if (filters.startDate) {
        where.assembledAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.assembledAt.lte = new Date(filters.endDate);
      }
    }

    return this.prisma.assemblyHistory.findMany({
      where,
      orderBy: { assembledAt: 'desc' },
      take: filters.limit,
      include: {
        product: {
          include: {
            category: true,
          },
        },
        bomTemplate: true,
        assembler: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        usedParts: {
          include: {
            sparePart: {
              include: {
                group: true,
              },
            },
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const assembly = await this.prisma.assemblyHistory.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            category: true,
          },
        },
        bomTemplate: {
          include: {
            items: {
              include: {
                sparePart: true,
              },
            },
          },
        },
        assembler: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        usedParts: {
          include: {
            sparePart: {
              include: {
                group: true,
              },
            },
          },
        },
      },
    });

    if (!assembly) {
      throw new NotFoundException('Assembly record not found');
    }

    return assembly;
  }

  async getByProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.assemblyHistory.findMany({
      where: { productId },
      orderBy: { assembledAt: 'desc' },
      include: {
        bomTemplate: true,
        assembler: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        usedParts: {
          include: {
            sparePart: true,
          },
        },
      },
    });
  }

  async getByAssembler(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.assemblyHistory.findMany({
      where: { assembledBy: userId },
      orderBy: { assembledAt: 'desc' },
      include: {
        product: true,
        bomTemplate: true,
        usedParts: {
          include: {
            sparePart: true,
          },
        },
      },
    });
  }

  async getRecent(limit = 10) {
    return this.prisma.assemblyHistory.findMany({
      orderBy: { assembledAt: 'desc' },
      take: limit,
      include: {
        product: {
          include: {
            category: true,
          },
        },
        bomTemplate: true,
        assembler: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            usedParts: true,
          },
        },
      },
    });
  }

  async getCostBreakdown(id: string) {
    const assembly = await this.findOne(id);

    const breakdown = assembly.usedParts.map((part) => ({
      sparePartId: part.sparePartId,
      sparePartName: part.sparePart.name,
      sparePartSku: part.sparePart.sku,
      group: part.sparePart.group?.name || 'Uncategorized',
      quantityUsed: part.quantityUsed,
      unitCost: Number(part.costAtTime),
      totalCost: Number(part.costAtTime) * part.quantityUsed,
    }));

    const totalCost = breakdown.reduce((sum, item) => sum + item.totalCost, 0);

    return {
      assemblyId: assembly.id,
      product: assembly.product.name,
      assembledAt: assembly.assembledAt,
      assembledBy: assembly.assembler.name,
      totalCost,
      breakdown,
    };
  }

  async getStats(filters: { startDate?: string; endDate?: string }) {
    const where: any = {};

    if (filters.startDate || filters.endDate) {
      where.assembledAt = {};
      if (filters.startDate) {
        where.assembledAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.assembledAt.lte = new Date(filters.endDate);
      }
    }

    // Total assemblies
    const totalAssemblies = await this.prisma.assemblyHistory.count({ where });

    // Total cost
    const assemblies = await this.prisma.assemblyHistory.findMany({
      where,
      select: {
        totalCost: true,
      },
    });
    const totalCost = assemblies.reduce(
      (sum, a) => sum + Number(a.totalCost),
      0,
    );

    // Assemblies by product
    const byProduct = await this.prisma.assemblyHistory.groupBy({
      by: ['productId'],
      where,
      _count: {
        productId: true,
      },
      _sum: {
        totalCost: true,
      },
    });

    const productStats = await Promise.all(
      byProduct.map(async (stat) => {
        const product = await this.prisma.product.findUnique({
          where: { id: stat.productId },
          select: { name: true, category: { select: { name: true } } },
        });
        return {
          productId: stat.productId,
          productName: product?.name || 'Unknown',
          category: product?.category?.name || 'Uncategorized',
          assemblyCount: stat._count.productId,
          totalCost: Number(stat._sum.totalCost || 0),
        };
      }),
    );

    // Assemblies by user
    const byAssembler = await this.prisma.assemblyHistory.groupBy({
      by: ['assembledBy'],
      where,
      _count: {
        assembledBy: true,
      },
      _sum: {
        totalCost: true,
      },
    });

    const assemblerStats = await Promise.all(
      byAssembler.map(async (stat) => {
        const user = await this.prisma.user.findUnique({
          where: { id: stat.assembledBy },
          select: { name: true, email: true },
        });
        return {
          userId: stat.assembledBy,
          userName: user?.name || 'Unknown',
          email: user?.email || '',
          assemblyCount: stat._count.assembledBy,
          totalCost: Number(stat._sum.totalCost || 0),
        };
      }),
    );

    // Most used spare parts
    const usedParts = await this.prisma.assemblyUsedPart.groupBy({
      by: ['sparePartId'],
      where: {
        assemblyHistory: where.assembledAt ? { assembledAt: where.assembledAt } : {},
      },
      _sum: {
        quantityUsed: true,
        costAtTime: true,
      },
      _count: {
        sparePartId: true,
      },
      orderBy: {
        _sum: {
          quantityUsed: 'desc',
        },
      },
      take: 10,
    });

    const sparePartStats = await Promise.all(
      usedParts.map(async (stat) => {
        const sparePart = await this.prisma.sparePart.findUnique({
          where: { id: stat.sparePartId },
          select: { name: true, sku: true, group: { select: { name: true } } },
        });
        return {
          sparePartId: stat.sparePartId,
          sparePartName: sparePart?.name || 'Unknown',
          sku: sparePart?.sku || '',
          group: sparePart?.group?.name || 'Uncategorized',
          totalQuantityUsed: stat._sum.quantityUsed || 0,
          timesUsed: stat._count.sparePartId,
          totalCost: Number(stat._sum.costAtTime || 0),
        };
      }),
    );

    return {
      totalAssemblies,
      totalCost,
      averageCostPerAssembly: totalAssemblies > 0 ? totalCost / totalAssemblies : 0,
      byProduct: productStats.sort((a, b) => b.assemblyCount - a.assemblyCount),
      byAssembler: assemblerStats.sort((a, b) => b.assemblyCount - a.assemblyCount),
      topSparePartsUsed: sparePartStats,
    };
  }
}
