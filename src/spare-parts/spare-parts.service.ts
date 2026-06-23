import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSparePartDto } from './dto/create-spare-part.dto';
import { UpdateSparePartDto } from './dto/update-spare-part.dto';

@Injectable()
export class SparePartsService {
  constructor(private prisma: PrismaService) { }

  async create(data: CreateSparePartDto) {
    // Validate warranty input
    if (data.hasWarranty) {
      if (!data.warrantyMonths && !data.warrantyYears) {
        throw new BadRequestException(
          'Please provide warranty duration (months or years)',
        );
      }
    }

    // Validate group exists if provided
    if (data.groupId) {
      const group = await this.prisma.sparePartGroup.findUnique({
        where: { id: data.groupId },
      });

      if (!group) {
        throw new NotFoundException('Spare part group not found');
      }

      if (!group.isActive) {
        throw new BadRequestException(
          'Cannot assign spare part to inactive group',
        );
      }
    }

    // Validate supplier exists if provided
    if (data.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: data.supplierId },
      });

      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }
    }

    console.log('data :', data);
    return this.prisma.sparePart.create({
      data,
      include: {
        group: true,
        supplier: true,
      },
    });
  }

  async findAll(groupId?: string) {
    const where = groupId ? { groupId } : {};

    return this.prisma.sparePart.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        group: true,
        supplier: true,
        _count: {
          select: {
            stockHistory: true,
            technicianStock: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const sparePart = await this.prisma.sparePart.findUnique({
      where: { id },
      include: {
        group: true,
        supplier: true,
        stockHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Last 10 stock changes
        },
        technicianStock: {
          include: {
            technician: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!sparePart) {
      throw new NotFoundException('Spare part not found');
    }

    return sparePart;
  }

  async getByGroup(groupId: string) {
    const group = await this.prisma.sparePartGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return this.prisma.sparePart.findMany({
      where: { groupId },
      orderBy: { name: 'asc' },
      include: {
        group: true,
        supplier: true,
      },
    });
  }

  async update(id: string, data: UpdateSparePartDto) {
    await this.findOne(id); // Check if exists

    // Validate group if being updated
    if (data.groupId) {
      const group = await this.prisma.sparePartGroup.findUnique({
        where: { id: data.groupId },
      });

      if (!group) {
        throw new NotFoundException('Spare part group not found');
      }

      if (!group.isActive) {
        throw new BadRequestException(
          'Cannot assign spare part to inactive group',
        );
      }
    }

    // Validate supplier if being updated
    if (data.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: data.supplierId },
      });

      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }
    }

    if (data.hasWarranty === false) {
      // Clear warranty fields if warranty is disabled
      return this.prisma.sparePart.update({
        where: { id },
        data: {
          ...data,
          warrantyMonths: null,
          warrantyYears: null,
        },
        include: {
          group: true,
          supplier: true,
        },
      });
    }

    return this.prisma.sparePart.update({
      where: { id },
      data,
      include: {
        group: true,
        supplier: true,
      },
    });
  }

  async delete(id: string) {
    await this.findOne(id);

    // Check if spare part is used in any BOM templates
    const bomUsage = await this.prisma.bOMTemplateItem.count({
      where: { sparePartId: id },
    });

    if (bomUsage > 0) {
      throw new BadRequestException(
        'Cannot delete spare part because it is used in BOM template(s). Remove from templates first.',
      );
    }

    // Check if spare part is used in service requests
    const serviceUsage = await this.prisma.serviceUsedProduct.count({
      where: { sparePartId: id },
    });

    if (serviceUsage > 0) {
      throw new BadRequestException(
        'Cannot delete spare part because it has been used in service requests',
      );
    }

    // Check if technicians have stock
    const technicianStock = await this.prisma.technicianStock.count({
      where: { sparePartId: id, quantity: { gt: 0 } },
    });

    if (technicianStock > 0) {
      throw new BadRequestException(
        'Cannot delete spare part because technicians have stock. Collect stock first.',
      );
    }

    return this.prisma.sparePart.delete({ where: { id } });
  }

  // Stock management
  async updateStock(id: string, quantityChange: number, reason: string) {
    const sparePart = await this.findOne(id);

    const newStock = sparePart.stock + quantityChange;

    if (newStock < 0) {
      throw new BadRequestException('Insufficient stock');
    }

    // Update spare part stock
    await this.prisma.sparePart.update({
      where: { id },
      data: { stock: newStock },
    });

    // Log to stock history
    await this.prisma.sparePartStockHistory.create({
      data: {
        sparePartId: id,
        quantityChange,
        reason,
      },
    });

    return { newStock, message: `Stock updated: ${reason}` };
  }

  // Low stock management (reuse threshold from products)
  async getLowStockThreshold() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'low_stock_threshold' },
    });
    return setting ? JSON.parse(setting.value) : 5; // Default: 5
  }

  async getLowStockSpareParts(threshold?: number) {
    if (!threshold) {
      threshold = await this.getLowStockThreshold();
    }

    return this.prisma.sparePart.findMany({
      where: {
        stock: {
          lte: threshold,
        },
      },
      orderBy: { stock: 'asc' },
      include: {
        group: true,
      },
    });
  }

  async getLowStockCount(threshold?: number) {
    if (!threshold) {
      threshold = await this.getLowStockThreshold();
    }

    return this.prisma.sparePart.count({
      where: {
        stock: {
          lte: threshold,
        },
      },
    });
  }

  async getFilteredSpareParts(filters: {
    groupId?: string;
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

    if (filters.groupId) where.groupId = filters.groupId;
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

    return this.prisma.sparePart.findMany({
      where,
      orderBy: {
        [filters.sortBy || 'name']: filters.sortOrder || 'asc',
      },
      include: {
        group: true,
        supplier: true,
      },
    });
  }

  // ✅ Technician stock management
  async getTechnicianStock(sparePartId: string) {
    await this.findOne(sparePartId); // Validate spare part exists

    return this.prisma.technicianStock.findMany({
      where: {
        sparePartId,
        quantity: { gt: 0 }, // Only show technicians with stock
      },
      include: {
        technician: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            region: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        quantity: 'desc',
      },
    });
  }

  async transferToTechnician(
    sparePartId: string,
    technicianId: string,
    quantity: number,
  ) {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    const sparePart = await this.findOne(sparePartId);

    // Check warehouse stock
    if (sparePart.stock < quantity) {
      throw new BadRequestException(
        `Insufficient warehouse stock. Available: ${sparePart.stock}, Requested: ${quantity}`,
      );
    }

    // Verify technician exists
    const technician = await this.prisma.user.findUnique({
      where: { id: technicianId },
    });

    if (!technician) {
      throw new NotFoundException('Technician not found');
    }

    // Execute transfer in transaction
    return this.prisma.$transaction(async (tx) => {
      // Reduce warehouse stock
      await tx.sparePart.update({
        where: { id: sparePartId },
        data: {
          stock: {
            decrement: quantity,
          },
        },
      });

      // Log warehouse stock history
      await tx.sparePartStockHistory.create({
        data: {
          sparePartId,
          quantityChange: -quantity,
          reason: `Transferred to technician: ${technician.name}`,
        },
      });

      // ✅ Log technician stock transaction
      await tx.technicianStockTransaction.create({
        data: {
          technicianId,
          sparePartId,
          quantity,
          type: 'ISSUE',
          notes: `Received ${quantity} units from warehouse`,
        },
      });

      // Update or create technician stock
      const existingStock = await tx.technicianStock.findUnique({
        where: {
          technicianId_sparePartId: {
            technicianId,
            sparePartId,
          },
        },
      });

      if (existingStock) {
        await tx.technicianStock.update({
          where: { id: existingStock.id },
          data: {
            quantity: {
              increment: quantity,
            },
          },
        });
      } else {
        await tx.technicianStock.create({
          data: {
            technicianId,
            sparePartId,
            quantity,
          },
        });
      }

      return {
        success: true,
        message: `Transferred ${quantity} units to ${technician.name}`,
        warehouseStock: sparePart.stock - quantity,
      };
    });
  }

  async returnFromTechnician(
    sparePartId: string,
    technicianId: string,
    quantity: number,
  ) {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    const sparePart = await this.findOne(sparePartId);

    // Verify technician exists
    const technician = await this.prisma.user.findUnique({
      where: { id: technicianId },
    });

    if (!technician) {
      throw new NotFoundException('Technician not found');
    }

    // Check technician has stock
    const technicianStock = await this.prisma.technicianStock.findUnique({
      where: {
        technicianId_sparePartId: {
          technicianId,
          sparePartId,
        },
      },
    });

    if (!technicianStock) {
      throw new BadRequestException(
        `Technician ${technician.name} has no stock of this spare part`,
      );
    }

    if (technicianStock.quantity < quantity) {
      throw new BadRequestException(
        `Insufficient technician stock. Technician has: ${technicianStock.quantity}, Requested return: ${quantity}`,
      );
    }

    // Execute return in transaction
    return this.prisma.$transaction(async (tx) => {
      // Increase warehouse stock
      await tx.sparePart.update({
        where: { id: sparePartId },
        data: {
          stock: {
            increment: quantity,
          },
        },
      });

      // Log warehouse stock history
      await tx.sparePartStockHistory.create({
        data: {
          sparePartId,
          quantityChange: quantity,
          reason: `Returned from technician: ${technician.name}`,
        },
      });

      // ✅ Log technician stock transaction
      await tx.technicianStockTransaction.create({
        data: {
          technicianId,
          sparePartId,
          quantity: -quantity,
          type: 'RETURN',
          notes: `Returned ${quantity} units to warehouse`,
        },
      });

      // Decrease technician stock
      const newTechnicianQuantity = technicianStock.quantity - quantity;

      if (newTechnicianQuantity === 0) {
        // Delete the record if quantity becomes 0
        await tx.technicianStock.delete({
          where: { id: technicianStock.id },
        });
      } else {
        // Update the quantity
        await tx.technicianStock.update({
          where: { id: technicianStock.id },
          data: {
            quantity: newTechnicianQuantity,
          },
        });
      }

      return {
        success: true,
        message: `Returned ${quantity} units from ${technician.name}`,
        warehouseStock: sparePart.stock + quantity,
        technicianStock: newTechnicianQuantity,
      };
    });
  }
}
