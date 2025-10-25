import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.customer.findMany({ include: { region: true } });
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(data: CreateCustomerDto) {
    return this.prisma.customer.create({ data });
  }

  async update(id: string, data: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.customer.delete({ where: { id } });
  }

  async getCustomerHistory(customerId: string) {
    // Get customer details
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        region: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Get all service requests for this customer
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

    // Calculate statistics
    const stats = {
      totalServices: serviceHistory.length,
      installations: serviceHistory.filter((s) => s.type === 'INSTALLATION')
        .length,
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
}
