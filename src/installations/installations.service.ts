import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInstallationDto } from './dto/create-installation.dto';
import { UpdateInstallationDto } from './dto/update-installation.dto';

@Injectable()
export class InstallationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(isActive?: boolean) {
    const where = isActive !== undefined ? { isActive } : {};

    return this.prisma.installation.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            primaryPhone: true,
          },
        },
        region: {
          select: {
            id: true,
            name: true,
            state: true,
            district: true,
            city: true,
          },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async searchInstallations(
    query: string,
    customerId?: string,
    regionId?: string,
    limit: number = 20,
  ) {
    const whereClause: any = {};

    // Build search conditions
    if (query && query.trim()) {
      whereClause.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } },
        { landmark: { contains: query, mode: 'insensitive' } },
        { contactPerson: { contains: query, mode: 'insensitive' } },
        { contactPhone: { contains: query } },
      ];
    }

    // Add customer filter
    if (customerId) {
      whereClause.customerId = customerId;
    }

    // Add region filter
    if (regionId) {
      whereClause.regionId = regionId;
    }

    const installations = await this.prisma.installation.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            primaryPhone: true,
          },
        },
        region: {
          select: {
            id: true,
            name: true,
            state: true,
            district: true,
          },
        },
      },
      take: limit,
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    });

    return installations;
  }

  async findOne(id: string) {
    const installation = await this.prisma.installation.findUnique({
      where: { id },
      include: {
        customer: true,
        region: true,
        serviceRequests: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            status: true,
            priority: true,
            createdAt: true,
          },
        },
      },
    });

    if (!installation) {
      throw new NotFoundException('Installation not found');
    }

    return installation;
  }

  async getByCustomer(customerId: string) {
    return this.prisma.installation.findMany({
      where: { customerId },
      include: {
        region: {
          select: {
            id: true,
            name: true,
            state: true,
            district: true,
          },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getByRegion(regionId: string) {
    return this.prisma.installation.findMany({
      where: { regionId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            primaryPhone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateInstallationDto) {
    // If this is marked as primary, unset other primary installations for this customer
    if (data.isPrimary) {
      await this.prisma.installation.updateMany({
        where: {
          customerId: data.customerId,
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    }

    return this.prisma.installation.create({
      data,
      include: {
        customer: true,
        region: true,
      },
    });
  }

  async update(id: string, data: UpdateInstallationDto) {
    await this.findOne(id);

    // If setting as primary, unset other primary installations
    if (data.isPrimary) {
      const installation = await this.prisma.installation.findUnique({
        where: { id },
        select: { customerId: true },
      });

      await this.prisma.installation.updateMany({
        where: {
          customerId: installation?.customerId,
          isPrimary: true,
          id: { not: id },
        },
        data: { isPrimary: false },
      });
    }

    return this.prisma.installation.update({
      where: { id },
      data,
      include: {
        customer: true,
        region: true,
      },
    });
  }

  async remove(id: string) {
    const installation = await this.findOne(id);

    // Check if installation has service requests
    const serviceRequestCount = await this.prisma.serviceRequest.count({
      where: { installationId: id },
    });

    if (serviceRequestCount > 0) {
      throw new BadRequestException(
        `Cannot delete installation with ${serviceRequestCount} service request(s). Consider deactivating instead.`,
      );
    }

    return this.prisma.installation.delete({ where: { id } });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.installation.update({
      where: { id },
      data: { isActive: false },
      include: {
        customer: true,
        region: true,
      },
    });
  }

  async setPrimary(id: string) {
    const installation = await this.findOne(id);

    // Unset other primary installations for this customer
    await this.prisma.installation.updateMany({
      where: {
        customerId: installation.customerId,
        isPrimary: true,
        id: { not: id },
      },
      data: { isPrimary: false },
    });

    // Set this as primary
    return this.prisma.installation.update({
      where: { id },
      data: { isPrimary: true },
      include: {
        customer: true,
        region: true,
      },
    });
  }

  async getInstallationHistory(installationId: string) {
    const installation = await this.findOne(installationId);

    const serviceHistory = await this.prisma.serviceRequest.findMany({
      where: { installationId },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        region: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      totalServices: serviceHistory.length,
      installations: serviceHistory.filter((s) => s.type === 'INSTALLATION')
        .length,
      reInstallations: serviceHistory.filter(
        (s) => s.type === 'RE_INSTALLATION',
      ).length,
      services: serviceHistory.filter((s) => s.type === 'SERVICE').length,
      complaints: serviceHistory.filter((s) => s.type === 'COMPLAINT').length,
      enquiries: serviceHistory.filter((s) => s.type === 'ENQUIRY').length,
      lastService: serviceHistory[0]?.createdAt || null,
      completedServices: serviceHistory.filter((s) => s.status === 'COMPLETED')
        .length,
    };

    return {
      installation,
      serviceHistory,
      statistics: stats,
    };
  }
}
