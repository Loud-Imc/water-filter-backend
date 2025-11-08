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

  // ✅ ADD THESE METHODS AT THE END:

  async reassignTechnician(
    id: string,
    newTechnicianId: string,
    reassignedById: string,
    reason: string,
  ) {
    const request = await this.findOne(id);
    const reassigner = await this.prisma.user.findUnique({
      where: { id: reassignedById },
      include: { role: true },
    });

    if (!reassigner) {
      throw new NotFoundException('Reassigner not found');
    }

    // ✅ ONLY ALLOW ASSIGNED STATUS (before work starts)
    if (request.status !== 'ASSIGNED') {
      throw new ForbiddenException(
        `Can only reassign technicians when status is ASSIGNED. Current status: ${request.status}`,
      );
    }

    // ✅ VERIFY REASSIGNER HAS PERMISSION
    const allowedRoles = [
      'Super Admin',
      'Service Admin',
      'Service Manager',
      'Service Team Lead',
    ];
    if (!allowedRoles.includes(reassigner.role.name)) {
      throw new ForbiddenException(
        'Insufficient permissions to reassign technician',
      );
    }

    // ✅ VALIDATE NEW TECHNICIAN
    const newTechnician = await this.prisma.user.findUnique({
      where: { id: newTechnicianId },
      include: { role: true },
    });

    if (!newTechnician || newTechnician.role.name !== 'Technician') {
      throw new BadRequestException('Invalid new technician');
    }

    if (newTechnician.id === request.assignedToId) {
      throw new BadRequestException(
        'Technician is already assigned to this request',
      );
    }

    // ✅ GET OLD TECHNICIAN FOR NOTIFICATION
    const oldTechnician = request.assignedToId
      ? await this.prisma.user.findUnique({
          where: { id: request.assignedToId },
        })
      : null;

    // ✅ CREATE REASSIGNMENT HISTORY (AUDIT TRAIL)
    await this.prisma.reassignmentHistory.create({
      data: {
        requestId: id,
        reassignedBy: reassignedById,
        previousTechId: request.assignedToId,
        newTechId: newTechnicianId,
        reason,
      },
    });

    // ✅ UPDATE REQUEST
    const updatedRequest = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        assignedToId: newTechnicianId,
      },
      include: {
        assignedTo: true,
        reassignmentHistory: {
          include: {
            reassigner: true,
            previousTech: true,
            newTech: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // ✅ NOTIFY OLD TECHNICIAN
    if (oldTechnician) {
      await this.notificationsService.createNotification(
        reassignedById,
        oldTechnician.id,
        `Service request #${id} has been reassigned from you. Reason: ${reason}`,
      );
    }

    // ✅ NOTIFY NEW TECHNICIAN
    await this.notificationsService.notifyRequestAssigned(id, newTechnicianId);

    return updatedRequest;
  }

  async getReassignmentHistory(id: string) {
    const request = await this.findOne(id); // Validate request exists

    return this.prisma.reassignmentHistory.findMany({
      where: { requestId: id },
      include: {
        reassigner: {
          select: { id: true, name: true, email: true },
        },
        previousTech: {
          select: { id: true, name: true, email: true },
        },
        newTech: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ✅ ADD THESE METHODS:

  async addUsedProducts(
    requestId: string,
    userId: string,
    usedProducts: Array<{
      productId: string;
      quantityUsed: number;
      notes?: string;
    }>,
  ) {
    const request = await this.findOne(requestId);
    const technician = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!technician) {
      throw new NotFoundException('User not found');
    }

    // ✅ ONLY TECHNICIAN CAN ADD USED PRODUCTS
    if (technician.role.name !== 'Technician') {
      throw new ForbiddenException('Only technicians can add used products');
    }

    // ✅ CHECK STATUS - WORK_COMPLETED ONLY
    if (request.status !== 'WORK_COMPLETED') {
      throw new ForbiddenException(
        'Products can only be added when work is completed. Current status: ' +
          request.status,
      );
    }

    // ✅ CHECK IF PRODUCTS ALREADY ADDED
    const existingProducts = await this.prisma.serviceUsedProduct.findMany({
      where: { requestId },
    });

    if (existingProducts.length > 0) {
      throw new BadRequestException(
        'Products already added for this service request. Editing is not allowed.',
      );
    }

    // ✅ VALIDATE & PROCESS EACH PRODUCT
    const addedProducts: any[] = [];

    for (const item of usedProducts) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      if (product.stock < item.quantityUsed) {
        throw new BadRequestException(
          `Insufficient stock for product "${product.name}". Available: ${product.stock}, Requested: ${item.quantityUsed}`,
        );
      }

      // ✅ CREATE USED PRODUCT RECORD
      const usedProduct = await this.prisma.serviceUsedProduct.create({
        data: {
          requestId,
          productId: item.productId,
          quantityUsed: item.quantityUsed,
          notes: item.notes,
          confirmedBy: userId,
        },
        include: {
          product: true,
          confirmedUser: true,
        },
      });

      // ✅ DECREASE STOCK QUANTITY
      await this.prisma.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantityUsed,
          },
        },
      });

      // ✅ LOG STOCK CHANGE
      await this.prisma.stockHistory.create({
        data: {
          productId: item.productId,
          quantityChange: -item.quantityUsed,
          reason: `Used in Service: Request #${requestId}`,
        },
      });

      addedProducts.push(usedProduct);
    }

    return addedProducts;
  }

  async getUsedProducts(requestId: string) {
    const request = await this.findOne(requestId);

    return this.prisma.serviceUsedProduct.findMany({
      where: { requestId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
          },
        },
        confirmedUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { confirmedAt: 'desc' },
    });
  }
}
