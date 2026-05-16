import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(page: number = 1, limit: number = 10, regionId?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (regionId) {
      where.regionId = regionId;
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: { region: true },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async searchCustomers(query: string, regionId?: string, limit: number = 20) {
    const likeQuery = `%${query}%`;

    // Build SQL with conditional region filter
    let sqlQuery = `
    SELECT *
    FROM "Customer"
    WHERE (
      name ILIKE $1
      OR "primaryPhone" LIKE $1
      OR email ILIKE $1
      OR address ILIKE $1
      OR EXISTS (
        SELECT 1 FROM unnest("phoneNumbers") AS pn WHERE pn ILIKE $1
      )
    )
  `;

    const params: any[] = [likeQuery];

    // Add region filter if provided
    if (regionId) {
      sqlQuery += ` AND "regionId" = $2`;
      params.push(regionId);
      sqlQuery += ` ORDER BY name ASC LIMIT $3`;
      params.push(limit);
    } else {
      sqlQuery += ` ORDER BY name ASC LIMIT $2`;
      params.push(limit);
    }

    const customers = await this.prisma.$queryRawUnsafe(sqlQuery, ...params);

    return customers;
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        region: true,
        installations: {
          where: { isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(data: CreateCustomerDto) {
    try {
      const result = await this.prisma.customer.create({
        data,
        include: { region: true },
      });
      console.log('Created customer:', result);
      return result;
    } catch (error) {
      console.error('Error creating customer:', error);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = error.meta?.target as string[];

          if (target?.includes('primaryPhone')) {
            throw new ConflictException(
              'A customer with this phone number already exists',
            );
          }

          if (target?.includes('email')) {
            throw new ConflictException(
              'A customer with this email already exists',
            );
          }

          throw new ConflictException(
            `A customer with this ${target?.join(', ')} already exists`,
          );
        }

        if (error.code === 'P2003') {
          throw new BadRequestException('Invalid region selected');
        }
      }

      throw error;
    }
  }

  async update(id: string, data: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({
      where: { id },
      data,
      include: { region: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.customer.delete({ where: { id } });
  }

  async getCustomerHistory(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        region: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const serviceHistory = await this.prisma.serviceRequest.findMany({
      where: { customerId },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        workMedia: true,
        region: true,
        workLogs: true,
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
      customer,
      serviceHistory,
      statistics: stats,
    };
  }

  async getCustomersByRegion(regionId: string) {
    return this.prisma.customer.findMany({
      where: { regionId },
      include: { region: true },
      orderBy: { name: 'asc' },
    });
  }

  async getCustomerStats() {
    const [total, withEmail, byRegion] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customer.count({ where: { email: { not: null } } }),
      this.prisma.customer.groupBy({
        by: ['regionId'],
        _count: true,
      }),
    ]);

    return {
      totalCustomers: total,
      withEmail,
      withoutEmail: total - withEmail,
      byRegion,
    };
  }

  // ============================================
  // CUSTOMER MERGE LOGIC
  // ============================================

  async createMergeRequest(
    userId: string,
    sourceId: string,
    targetId: string,
    reason?: string,
  ) {
    if (sourceId === targetId) {
      throw new BadRequestException('Cannot merge a customer into themselves');
    }

    // Verify both customers exist
    const [source, target] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: sourceId } }),
      this.prisma.customer.findUnique({ where: { id: targetId } }),
    ]);

    if (!source || !target) {
      throw new NotFoundException('One or both customers not found');
    }

    // Check if a pending request already exists
    const existing = await this.prisma.customerMergeRequest.findFirst({
      where: {
        sourceId,
        targetId,
        status: 'PENDING',
      },
    });

    if (existing) {
      throw new BadRequestException('A merge request for these customers is already pending');
    }

    return this.prisma.customerMergeRequest.create({
      data: {
        source: { connect: { id: sourceId } },
        target: { connect: { id: targetId } },
        requestedBy: { connect: { id: userId } },
        reason,
      },
      include: {
        source: true,
        target: true,
        requestedBy: {
          select: { name: true, email: true },
        },
      },
    });
  }

  async getMergeRequests(status?: string) {
    return this.prisma.customerMergeRequest.findMany({
      where: status ? { status } : {},
      include: {
        source: true,
        target: true,
        requestedBy: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async processMergeRequest(
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
    adminNotes?: string,
  ) {
    const request = await this.prisma.customerMergeRequest.findUnique({
      where: { id: requestId },
      include: { source: true, target: true },
    });

    if (!request) {
      throw new NotFoundException('Merge request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request already ${request.status.toLowerCase()}`);
    }

    if (status === 'REJECTED') {
      return this.prisma.customerMergeRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          adminNotes,
          processedAt: new Date(),
        },
      });
    }

    // EXECUTE MERGE
    return this.prisma.$transaction(async (tx) => {
      const { sourceId, targetId } = request;

      // 1. Move all installations
      await tx.installation.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });

      // 2. Move all service requests
      await tx.serviceRequest.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });

      // 3. Consolidate phone numbers
      const combinedPhones = Array.from(new Set([
        ...request.target.phoneNumbers,
        request.source.primaryPhone,
        ...request.source.phoneNumbers
      ])).filter(p => p !== request.target.primaryPhone);

      await tx.customer.update({
        where: { id: targetId },
        data: {
          phoneNumbers: combinedPhones,
        },
      });

      // 4. Mark source as merged
      await tx.customer.update({
        where: { id: sourceId },
        data: {
          isMerged: true,
          mergedToId: targetId,
          // Clear unique fields to avoid conflicts in future imports
          primaryPhone: `MERGED_${sourceId}_${request.source.primaryPhone}`,
          email: request.source.email ? `MERGED_${sourceId}_${request.source.email}` : null,
        },
      });

      // 5. Update request status
      return tx.customerMergeRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          adminNotes,
          processedAt: new Date(),
        },
      });
    });
  }
}
