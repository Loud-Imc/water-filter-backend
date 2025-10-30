import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';

@Injectable()
export class RegionsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.region.findMany();
  }

  async searchRegions(query: string, limit: number = 20) {
    return this.prisma.region.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
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
    return this.prisma.region.create({ data });
  }

  async update(id: string, data: UpdateRegionDto) {
    await this.findOne(id);
    return this.prisma.region.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.region.delete({ where: { id } });
  }
}
