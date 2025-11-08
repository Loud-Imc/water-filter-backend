import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';

@Injectable()
export class RegionsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.region.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async searchRegions(query: string, limit: number = 20) {
    return this.prisma.region.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { state: { contains: query, mode: 'insensitive' } },
          { district: { contains: query, mode: 'insensitive' } },
          { city: { contains: query, mode: 'insensitive' } },
          { pincode: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        state: true,
        district: true,
        city: true,
        pincode: true,
        _count: {
          select: {
            customers: true,
            technicians: true,
          },
        },
      },
      take: limit,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const region = await this.prisma.region.findUnique({ where: { id } });
    if (!region) throw new NotFoundException('Region not found');
    return region;
  }

  async create(data: CreateRegionDto) {
    // Check if region name already exists
    const existing = await this.prisma.region.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new BadRequestException('Region with this name already exists');
    }

    return this.prisma.region.create({ data });
  }

  async update(id: string, data: UpdateRegionDto) {
    await this.findOne(id);

    // Check if new name conflicts with existing
    if (data.name) {
      const existing = await this.prisma.region.findFirst({
        where: {
          name: data.name,
          NOT: { id },
        },
      });

      if (existing) {
        throw new BadRequestException('Region with this name already exists');
      }
    }

    return this.prisma.region.update({ where: { id }, data });
  }

  async remove(id: string) {
    // const region = await this.findOne(id);
    await this.findOne(id);

    // Check if region is in use
    const usageCount = await this.prisma.region.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            customers: true,
            technicians: true,
            serviceRequests: true,
          },
        },
      },
    });

    // ✅ Fixed: Use nullish coalescing operator with default values
    const customersCount = usageCount?._count?.customers ?? 0;
    const techniciansCount = usageCount?._count?.technicians ?? 0;
    const serviceRequestsCount = usageCount?._count?.serviceRequests ?? 0;

    const totalUsage = customersCount + techniciansCount + serviceRequestsCount;

    if (totalUsage > 0) {
      throw new BadRequestException(
        `Cannot delete region. It is assigned to ${totalUsage} records (${customersCount} customers, ${techniciansCount} users, ${serviceRequestsCount} service requests)`,
      );
    }

    return this.prisma.region.delete({ where: { id } });
  }
}
