import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

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
    const whereClause: any = {};

    // Build search conditions
    if (query && query.trim()) {
      whereClause.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { primaryPhone: { contains: query } },
        { email: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } },
        // Search in additional phone numbers array
        {
          phoneNumbers: {
            hasSome: [query],
          },
        },
      ];
    }

    // Add region filter
    if (regionId) {
      whereClause.regionId = regionId;
    }

    const customers = await this.prisma.customer.findMany({
      where: whereClause,
      include: {
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
      take: limit,
      orderBy: [{ name: 'asc' }],
    });

    return customers;
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { region: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(data: CreateCustomerDto) {
    return this.prisma.customer.create({
      data,
      include: { region: true },
    });
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
      },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      totalServices: serviceHistory.length,
      installations: serviceHistory.filter((s) => s.type === 'INSTALLATION')
        .length,
      reInstallations: serviceHistory.filter(
        (s) => s.type === 'RE_INSTALLATION',
      ).length, // ✅ NEW
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

  // ✅ NEW: Get customers by region (useful for filtering)
  async getCustomersByRegion(regionId: string) {
    return this.prisma.customer.findMany({
      where: { regionId },
      include: { region: true },
      orderBy: { name: 'asc' },
    });
  }

  // ✅ NEW: Get customer statistics
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
