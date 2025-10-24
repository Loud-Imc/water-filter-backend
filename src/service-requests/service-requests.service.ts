import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestDto } from './dto/update-service-request.dto';

@Injectable()
export class ServiceRequestsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateServiceRequestDto) {
    const creator = await this.prisma.user.findUnique({
      where: { id: dto.requestedById },
      include: { role: true },
    });

    if (!creator) {
      throw new NotFoundException('User not found');
    }

    let initialStatus = 'PENDING_APPROVAL';

    const salesRoles = ['Salesman', 'Sales Team Lead', 'Sales Manager'];
    if (salesRoles.includes(creator.role.name)) {
      initialStatus = 'PENDING_APPROVAL';
    }

    const request = await this.prisma.serviceRequest.create({
      data: { ...dto, status: initialStatus as any },
      include: {
        customer: true,
        region: true,
        requestedBy: {
          include: {
            role: true,
          },
        },
      },
    });

    await this.notificationsService.notifyRequestCreated(
      request.id,
      dto.requestedById,
    );

    return request;
  }

  async findAll() {
    return this.prisma.serviceRequest.findMany({
      include: {
        requestedBy: { include: { role: true } },
        approvedBy: true,
        assignedTo: true,
        customer: true,
        region: true,
        approvalHistory: { include: { approver: true } },
      },
    });
  }

  async findOne(id: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        requestedBy: { include: { role: true } },
        approvedBy: true,
        assignedTo: true,
        customer: true,
        region: true,
        workLogs: true,
        workMedia: true,
        approvalHistory: {
          include: { approver: true },
          orderBy: { approvedAt: 'asc' },
        },
      },
    });
    if (!request) throw new NotFoundException('Service request not found');
    return request;
  }

  async update(id: string, dto: UpdateServiceRequestDto) {
    await this.findOne(id);
    return this.prisma.serviceRequest.update({ where: { id }, data: dto });
  }

  // Sales Admin approval (first step for sales-created requests)
  async salesApprove(id: string, approverId: string, comments?: string) {
    const request = await this.findOne(id);
    const approver = await this.prisma.user.findUnique({
      where: { id: approverId },
      include: { role: true },
    });

    if (!approver) {
      throw new NotFoundException('Approver not found');
    }

    if (
      approver.role.name !== 'Sales Admin' &&
      approver.role.name !== 'Super Admin'
    ) {
      throw new ForbiddenException(
        'Only Sales Admin can perform sales approval',
      );
    }

    const salesRoles = ['Salesman', 'Sales Team Lead', 'Sales Manager'];
    if (!salesRoles.includes(request.requestedBy.role.name)) {
      throw new BadRequestException(
        'This request does not require sales approval',
      );
    }

    if (request.salesApproved) {
      throw new BadRequestException('Request already approved by sales');
    }

    await this.prisma.approvalHistory.create({
      data: {
        requestId: id,
        approverId,
        approverRole: approver.role.name,
        status: 'APPROVED',
        comments,
      },
    });

    const updatedRequest = await this.prisma.serviceRequest.update({
      where: { id },
      data: { salesApproved: true },
    });

    await this.notificationsService.createNotification(
      approverId,
      request.requestedById,
      `Your service request has been approved by Sales Admin`,
    );

    return updatedRequest;
  }

  // Service Admin approval (final approval)
  async serviceApprove(id: string, approverId: string, comments?: string) {
    const request = await this.findOne(id);
    const approver = await this.prisma.user.findUnique({
      where: { id: approverId },
      include: { role: true },
    });

    if (!approver) {
      throw new NotFoundException('Approver not found');
    }

    const approverRoles = [
      'Super Admin',
      'Service Admin',
      'Service Manager',
      'Service Team Lead',
    ];
    if (!approverRoles.includes(approver.role.name)) {
      throw new ForbiddenException('Insufficient permissions to approve');
    }

    if (request.status !== 'PENDING_APPROVAL') {
      throw new ForbiddenException('Request not pending approval');
    }

    const salesRoles = ['Salesman', 'Sales Team Lead', 'Sales Manager'];
    if (
      salesRoles.includes(request.requestedBy.role.name) &&
      !request.salesApproved
    ) {
      throw new BadRequestException(
        'Request must be approved by Sales Admin first',
      );
    }

    await this.prisma.approvalHistory.create({
      data: {
        requestId: id,
        approverId,
        approverRole: approver.role.name,
        status: 'APPROVED',
        comments,
      },
    });

    const updatedRequest = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: approverId,
      },
    });

    await this.notificationsService.notifyRequestApproved(id, approverId);

    return updatedRequest;
  }

  async rejectRequest(id: string, approverId: string, comments: string) {
    const request = await this.findOne(id);
    const approver = await this.prisma.user.findUnique({
      where: { id: approverId },
      include: { role: true },
    });

    if (!approver) {
      throw new NotFoundException('Approver not found');
    }

    const approverRoles = [
      'Super Admin',
      'Service Admin',
      'Sales Admin',
      'Service Manager',
      'Service Team Lead',
    ];
    if (!approverRoles.includes(approver.role.name)) {
      throw new ForbiddenException('Insufficient permissions to reject');
    }

    await this.prisma.approvalHistory.create({
      data: {
        requestId: id,
        approverId,
        approverRole: approver.role.name,
        status: 'REJECTED',
        comments,
      },
    });

    const updatedRequest = await this.prisma.serviceRequest.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    await this.notificationsService.createNotification(
      approverId,
      request.requestedById,
      `Your service request has been rejected: ${comments}`,
    );

    return updatedRequest;
  }

  // Auto-assign technician based on region
  async autoAssignTechnician(id: string) {
    const request = await this.findOne(id);

    if (request.status !== 'APPROVED') {
      throw new ForbiddenException(
        'Request must be approved before assignment',
      );
    }

    // Find available technician in the same region
    const technician = await this.prisma.user.findFirst({
      where: {
        regionId: request.regionId,
        role: { name: 'Technician' },
        status: 'ACTIVE',
      },
      include: { assignedRequests: true },
      orderBy: { assignedRequests: { _count: 'asc' } }, // Assign to technician with least tasks
    });

    if (!technician) {
      throw new NotFoundException(
        'No available technician found in this region',
      );
    }

    const updatedRequest = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'ASSIGNED',
        assignedToId: technician.id,
      },
    });

    // Trigger notification to technician
    await this.notificationsService.notifyRequestAssigned(id, technician.id);

    return updatedRequest;
  }

  // Manual assignment
  async manualAssignTechnician(id: string, technicianId: string) {
    const request = await this.findOne(id);
    if (request.status !== 'APPROVED') {
      throw new ForbiddenException(
        'Request must be approved before assignment',
      );
    }

    const technician = await this.prisma.user.findUnique({
      where: { id: technicianId },
      include: { role: true },
    });

    if (!technician || technician.role.name !== 'Technician') {
      throw new BadRequestException('Invalid technician');
    }

    const updatedRequest = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'ASSIGNED',
        assignedToId: technicianId,
      },
    });

    // Trigger notification to technician
    await this.notificationsService.notifyRequestAssigned(id, technicianId);

    return updatedRequest;
  }

  // Add this method
  async acknowledgeCompletion(id: string, userId: string, comments?: string) {
    const request = await this.findOne(id);

    if (request.status !== 'WORK_COMPLETED') {
      throw new BadRequestException('Work must be completed first');
    }

    return this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        acknowledgedById: userId,
        acknowledgedAt: new Date(),
        acknowledgmentComments: comments,
      },
    });
  }

  async getDashboardStats(userId: string, userRole: string) {
    // Base query conditions
    const baseConditions = this.getBaseConditions(userId, userRole);

    // Total requests
    const totalRequests = await this.prisma.serviceRequest.count({
      where: baseConditions,
    });

    // Pending approval
    const pendingApproval = await this.prisma.serviceRequest.count({
      where: {
        ...baseConditions,
        status: 'PENDING_APPROVAL',
      },
    });

    // Approved (waiting assignment)
    const approved = await this.prisma.serviceRequest.count({
      where: {
        ...baseConditions,
        status: 'APPROVED',
      },
    });

    // Assigned
    const assigned = await this.prisma.serviceRequest.count({
      where: {
        ...baseConditions,
        status: 'ASSIGNED',
      },
    });

    // In Progress
    const inProgress = await this.prisma.serviceRequest.count({
      where: {
        ...baseConditions,
        status: 'IN_PROGRESS',
      },
    });

    // Work Completed
    const workCompleted = await this.prisma.serviceRequest.count({
      where: {
        ...baseConditions,
        status: 'WORK_COMPLETED',
      },
    });

    // Completed
    const completed = await this.prisma.serviceRequest.count({
      where: {
        ...baseConditions,
        status: 'COMPLETED',
      },
    });

    // Rejected
    const rejected = await this.prisma.serviceRequest.count({
      where: {
        ...baseConditions,
        status: 'REJECTED',
      },
    });

    // Requests by type
    const byType = await this.prisma.serviceRequest.groupBy({
      by: ['type'],
      where: baseConditions,
      _count: true,
    });

    // Recent requests (last 5)
    const recentRequests = await this.prisma.serviceRequest.findMany({
      where: baseConditions,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        requestedBy: true,
        assignedTo: true,
        region: true,
      },
    });

    // Technician-specific stats
    let myTasks: any = null;
    if (userRole === 'Technician') {
      myTasks = {
        assigned: await this.prisma.serviceRequest.count({
          where: { assignedToId: userId, status: 'ASSIGNED' },
        }),
        inProgress: await this.prisma.serviceRequest.count({
          where: { assignedToId: userId, status: 'IN_PROGRESS' },
        }),
        workCompleted: await this.prisma.serviceRequest.count({
          where: { assignedToId: userId, status: 'WORK_COMPLETED' },
        }),
      };
    }

    return {
      totalRequests,
      pendingApproval,
      approved,
      assigned,
      inProgress,
      workCompleted,
      completed,
      rejected,
      byType: byType.map((item) => ({
        type: item.type,
        count: item._count,
      })),
      recentRequests,
      myTasks,
    };
  }

  // Helper method to get base query conditions
  private getBaseConditions(userId: string, userRole: string) {
    switch (userRole) {
      case 'Technician':
        return { assignedToId: userId };
      case 'Salesman':
      case 'Sales Team Lead':
      case 'Sales Manager':
        return { requestedById: userId };
      case 'Super Admin':
      case 'Service Admin':
      case 'Service Manager':
        return {}; // See all
      default:
        return { requestedById: userId };
    }
  }
}
