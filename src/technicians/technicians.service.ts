import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TechniciansService {
  constructor(private prisma: PrismaService) {}

  // Get all tasks assigned to technician
  async getMyTasks(technicianId: string) {
    return this.prisma.serviceRequest.findMany({
      where: {
        assignedToId: technicianId,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      },
      include: {
        customer: true,
        region: true,
        requestedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get task history (completed tasks)
  async getTaskHistory(technicianId: string) {
    return this.prisma.serviceRequest.findMany({
      where: {
        assignedToId: technicianId,
        status: { in: ['WORK_COMPLETED', 'COMPLETED', 'REJECTED'] },
      },
      include: {
        customer: true,
        region: true,
        workLogs: true,
        workMedia: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get specific task details
  async getTaskDetails(technicianId: string, requestId: string) {
    const task = await this.prisma.serviceRequest.findFirst({
      where: {
        id: requestId,
        assignedToId: technicianId,
      },
      include: {
        customer: true,
        region: true,
        requestedBy: { select: { name: true, email: true } },
        approvedBy: { select: { name: true, email: true } },
        workLogs: true,
        workMedia: true,
        approvalHistory: { include: { approver: { select: { name: true, email: true } } } },
      },
    });

    if (!task) throw new NotFoundException('Task not found or not assigned to you');
    return task;
  }

  // Get technician statistics
  async getMyStats(technicianId: string) {
    const [assigned, inProgress, completed, totalWorkTime] = await Promise.all([
      this.prisma.serviceRequest.count({
        where: { assignedToId: technicianId, status: 'ASSIGNED' },
      }),
      this.prisma.serviceRequest.count({
        where: { assignedToId: technicianId, status: 'IN_PROGRESS' },
      }),
      this.prisma.serviceRequest.count({
        where: { assignedToId: technicianId, status: 'COMPLETED' },
      }),
      this.prisma.workLog.aggregate({
        where: { technicianId },
        _sum: { duration: true },
      }),
    ]);

    return {
      assigned,
      inProgress,
      completed,
      totalWorkTime: totalWorkTime._sum.duration || 0,
    };
  }
}
