import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSparePartGroupDto } from './dto/create-spare-part-group.dto';
import { UpdateSparePartGroupDto } from './dto/update-spare-part-group.dto';

@Injectable()
export class SparePartGroupsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateSparePartGroupDto) {
    // Check if group name already exists
    const existing = await this.prisma.sparePartGroup.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new BadRequestException(`Group "${data.name}" already exists`);
    }

    return this.prisma.sparePartGroup.create({
      data,
    });
  }

  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };

    return this.prisma.sparePartGroup.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            spareParts: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const group = await this.prisma.sparePartGroup.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            spareParts: true,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Spare part group not found');
    }

    return group;
  }

  async getSparePartsByGroup(groupId: string) {
    await this.findOne(groupId); // Check if exists

    return this.prisma.sparePart.findMany({
      where: { groupId },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, data: UpdateSparePartGroupDto) {
    await this.findOne(id); // Check if exists

    // Check name uniqueness if name is being updated
    if (data.name) {
      const existing = await this.prisma.sparePartGroup.findFirst({
        where: {
          name: data.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException(`Group "${data.name}" already exists`);
      }
    }

    return this.prisma.sparePartGroup.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    const group = await this.findOne(id);

    // Check if group has spare parts
    const sparePartCount = await this.prisma.sparePart.count({
      where: { groupId: id },
    });

    if (sparePartCount > 0) {
      throw new BadRequestException(
        `Cannot delete group "${group.name}" because it has ${sparePartCount} spare part(s). Remove or reassign spare parts first.`,
      );
    }

    return this.prisma.sparePartGroup.delete({
      where: { id },
    });
  }

  async toggleStatus(id: string) {
    const group = await this.findOne(id);

    return this.prisma.sparePartGroup.update({
      where: { id },
      data: {
        isActive: !group.isActive,
      },
    });
  }
}
