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

  async findAll() {
    return this.prisma.customer.findMany({
      include: { region: true },
      orderBy: { name: 'asc' },
    });
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
}
