import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBOMTemplateDto } from './dto/create-bom-template.dto';
import { UpdateBOMTemplateDto } from './dto/update-bom-template.dto';
import { AddBOMItemDto } from './dto/add-bom-item.dto';

@Injectable()
export class BOMTemplatesService {
  constructor(private prisma: PrismaService) {}

  // ===== BOM Template CRUD =====
  async create(data: CreateBOMTemplateDto) {
    // Validate product exists
    const product = await this.prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if BOM already exists for this product
    const existing = await this.prisma.bOMTemplate.findUnique({
      where: { productId: data.productId },
    });

    if (existing) {
      throw new BadRequestException(
        `BOM template already exists for product "${product.name}". Update the existing template or delete it first.`,
      );
    }

    return this.prisma.bOMTemplate.create({
      data,
      include: {
        product: true,
        items: {
          include: {
            sparePart: true,
          },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.bOMTemplate.findMany({
      orderBy: { name: 'asc' },
      include: {
        product: true,
        items: {
          include: {
            sparePart: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            items: true,
            assemblies: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.bOMTemplate.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            category: true,
          },
        },
        items: {
          include: {
            sparePart: {
              include: {
                group: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            assemblies: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('BOM template not found');
    }

    return template;
  }

  async getByProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const template = await this.prisma.bOMTemplate.findUnique({
      where: { productId },
      include: {
        product: true,
        items: {
          include: {
            sparePart: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(
        `No BOM template found for product "${product.name}"`,
      );
    }

    return template;
  }

  async update(id: string, data: UpdateBOMTemplateDto) {
    await this.findOne(id);

    return this.prisma.bOMTemplate.update({
      where: { id },
      data,
      include: {
        product: true,
        items: {
          include: {
            sparePart: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    const template = await this.findOne(id);

    // Check if template has been used in assemblies
    const assemblyCount = await this.prisma.assemblyHistory.count({
      where: { bomTemplateId: id },
    });

    if (assemblyCount > 0) {
      throw new BadRequestException(
        `Cannot delete BOM template "${template.name}" because it has ${assemblyCount} assembly record(s). This is for historical tracking.`,
      );
    }

    // Delete will cascade to BOMTemplateItems
    return this.prisma.bOMTemplate.delete({
      where: { id },
    });
  }

  async toggleStatus(id: string) {
    const template = await this.findOne(id);

    return this.prisma.bOMTemplate.update({
      where: { id },
      data: {
        isActive: !template.isActive,
      },
    });
  }

  // ===== BOM Items Management =====
  async addItem(templateId: string, data: AddBOMItemDto) {
    const template = await this.findOne(templateId);

    // Validate spare part exists
    const sparePart = await this.prisma.sparePart.findUnique({
      where: { id: data.sparePartId },
    });

    if (!sparePart) {
      throw new NotFoundException('Spare part not found');
    }

    // Check if item already exists in template
    const existing = await this.prisma.bOMTemplateItem.findUnique({
      where: {
        bomTemplateId_sparePartId: {
          bomTemplateId: templateId,
          sparePartId: data.sparePartId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Spare part "${sparePart.name}" is already in this BOM template`,
      );
    }

    return this.prisma.bOMTemplateItem.create({
      data: {
        bomTemplateId: templateId,
        ...data,
      },
      include: {
        sparePart: true,
      },
    });
  }

  async updateItem(
    templateId: string,
    itemId: string,
    data: { quantity?: number; isOptional?: boolean; notes?: string },
  ) {
    await this.findOne(templateId);

    const item = await this.prisma.bOMTemplateItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.bomTemplateId !== templateId) {
      throw new NotFoundException('BOM item not found in this template');
    }

    return this.prisma.bOMTemplateItem.update({
      where: { id: itemId },
      data,
      include: {
        sparePart: true,
      },
    });
  }

  async removeItem(templateId: string, itemId: string) {
    await this.findOne(templateId);

    const item = await this.prisma.bOMTemplateItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.bomTemplateId !== templateId) {
      throw new NotFoundException('BOM item not found in this template');
    }

    return this.prisma.bOMTemplateItem.delete({
      where: { id: itemId },
    });
  }

  // ===== Assembly Execution =====
  async executeAssembly(
    templateId: string,
    selectedSparePartIds: string[],
    assembledBy: string,
    notes?: string,
  ) {
    const template = await this.findOne(templateId);

    if (!template.isActive) {
      throw new BadRequestException(
        'Cannot execute assembly with inactive template',
      );
    }

    if (template.items.length === 0) {
      throw new BadRequestException(
        'Cannot execute assembly with no spare parts in template',
      );
    }

    // Get items to assemble (either selected or all required)
    const itemsToAssemble = template.items.filter(
      (item) =>
        selectedSparePartIds.includes(item.sparePartId) ||
        (!item.isOptional && selectedSparePartIds.length === 0), // If no selection, use all required
    );

    if (itemsToAssemble.length === 0) {
      throw new BadRequestException('No spare parts selected for assembly');
    }

    // Validate stock availability
    const stockValidation: any = await Promise.all(
      itemsToAssemble.map(async (item) => {
        const sparePart = await this.prisma.sparePart.findUnique({
          where: { id: item.sparePartId },
        });

        if (!sparePart) {
          throw new NotFoundException(
            `Spare part not found: ${item.sparePartId}`,
          );
        }

        if (sparePart.stock < item.quantity) {
          return {
            valid: false,
            sparePartName: sparePart.name,
            required: item.quantity,
            available: sparePart.stock,
          };
        }

        return {
          valid: true,
          sparePartId: item.sparePartId,
          quantity: item.quantity,
          price: sparePart.price,
        };
      }),
    );

    // Check for insufficient stock
    const insufficientStock = stockValidation.filter((v) => !v.valid);
    if (insufficientStock.length > 0) {
      const errors = insufficientStock
        .map(
          (v) =>
            `${v.sparePartName}: required ${v.required}, available ${v.available}`,
        )
        .join('; ');
      throw new BadRequestException(`Insufficient stock: ${errors}`);
    }

    // Calculate total cost
    const totalCost = stockValidation.reduce(
      (sum, v) => sum + Number(v.price) * v.quantity,
      0,
    );

    // Execute assembly in transaction
    return this.prisma.$transaction(async (tx) => {
      // 1. Create assembly history record
      const assembly = await tx.assemblyHistory.create({
        data: {
          productId: template.productId,
          bomTemplateId: templateId,
          assembledBy,
          notes,
          totalCost,
        },
      });

      // 2. Deduct spare parts stock and record usage
      for (const item of stockValidation) {
        if (!item.valid) continue;

        // Deduct warehouse stock
        await tx.sparePart.update({
          where: { id: item.sparePartId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        // Log spare part stock history
        await tx.sparePartStockHistory.create({
          data: {
            sparePartId: item.sparePartId,
            quantityChange: -item.quantity,
            reason: `Used in assembly: ${template.name}`,
          },
        });

        // Record assembly usage
        await tx.assemblyUsedPart.create({
          data: {
            assemblyHistoryId: assembly.id,
            sparePartId: item.sparePartId,
            quantityUsed: item.quantity,
            costAtTime: item.price,
          },
        });
      }

      // 3. Increase product stock
      await tx.product.update({
        where: { id: template.productId },
        data: {
          stock: {
            increment: 1, // Assembled 1 unit
          },
        },
      });

      // 4. Log product stock history
      await tx.productStockHistory.create({
        data: {
          productId: template.productId,
          quantityChange: 1,
          reason: `Assembled from BOM: ${template.name}`,
        },
      });

      // Return assembly details
      const assemblyDetails = await tx.assemblyHistory.findUnique({
        where: { id: assembly.id },
        include: {
          product: true,
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

      return {
        success: true,
        message: `Successfully assembled 1 unit of "${template.product.name}"`,
        assembly: assemblyDetails,
      };
    });
  }

  // ===== Assembly History =====
  async getAssemblyHistory(templateId: string) {
    await this.findOne(templateId);

    return this.prisma.assemblyHistory.findMany({
      where: { bomTemplateId: templateId },
      orderBy: { assembledAt: 'desc' },
      include: {
        product: true,
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
}
