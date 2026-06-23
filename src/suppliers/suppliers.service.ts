import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateSupplierDto) {
    // Check if supplier name already exists
    const existing = await this.prisma.supplier.findFirst({
      where: { name: { equals: data.name, mode: 'insensitive' } },
    });

    if (existing) {
      throw new BadRequestException(
        `Supplier "${data.name}" already exists`,
      );
    }

    return this.prisma.supplier.create({
      data,
    });
  }

  async findAll() {
    return this.prisma.supplier.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            products: true,
            spareParts: true,
            invoices: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
            spareParts: true,
            invoices: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async update(id: string, data: UpdateSupplierDto) {
    await this.findOne(id); // Check if exists

    // Check name uniqueness if name is being updated
    if (data.name) {
      const existing = await this.prisma.supplier.findFirst({
        where: {
          name: { equals: data.name, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException(
          `Supplier "${data.name}" already exists`,
        );
      }
    }

    return this.prisma.supplier.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    const supplier = await this.findOne(id);

    // Check if supplier has products, spare parts, or invoices
    if (supplier._count.products > 0) {
      throw new BadRequestException(
        `Cannot delete supplier "${supplier.name}" because they have ${supplier._count.products} products(s) linked. Remove or reassign products first.`,
      );
    }

    if (supplier._count.spareParts > 0) {
      throw new BadRequestException(
        `Cannot delete supplier "${supplier.name}" because they have ${supplier._count.spareParts} spare parts linked. Remove or reassign spare parts first.`,
      );
    }

    if (supplier._count.invoices > 0) {
      throw new BadRequestException(
        `Cannot delete supplier "${supplier.name}" because they have purchase invoices in the system.`,
      );
    }

    return this.prisma.supplier.delete({
      where: { id },
    });
  }
}
