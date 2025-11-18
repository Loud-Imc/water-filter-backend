import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';

@Injectable()
export class ProductCategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateProductCategoryDto) {
    // Check if category name already exists
    const existing = await this.prisma.productCategory.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new BadRequestException(
        `Category "${data.name}" already exists`,
      );
    }

    return this.prisma.productCategory.create({
      data,
    });
  }

  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };

    return this.prisma.productCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.productCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Product category not found');
    }

    return category;
  }

  async getProductsByCategory(categoryId: string) {
    await this.findOne(categoryId); // Check if exists

    return this.prisma.product.findMany({
      where: { categoryId },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, data: UpdateProductCategoryDto) {
    await this.findOne(id); // Check if exists

    // Check name uniqueness if name is being updated
    if (data.name) {
      const existing = await this.prisma.productCategory.findFirst({
        where: {
          name: data.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException(
          `Category "${data.name}" already exists`,
        );
      }
    }

    return this.prisma.productCategory.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    const category = await this.findOne(id);

    // Check if category has products
    const productCount = await this.prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}" because it has ${productCount} product(s). Remove or reassign products first.`,
      );
    }

    return this.prisma.productCategory.delete({
      where: { id },
    });
  }

  async toggleStatus(id: string) {
    const category = await this.findOne(id);

    return this.prisma.productCategory.update({
      where: { id },
      data: {
        isActive: !category.isActive,
      },
    });
  }
}
