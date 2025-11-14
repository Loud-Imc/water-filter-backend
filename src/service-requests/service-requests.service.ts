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
import { ReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class ServiceRequestsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // async create(dto: CreateServiceRequestDto) {
  //   const creator = await this.prisma.user.findUnique({
  //     where: { id: dto.requestedById },
  //     include: { role: true },
  //   });

  //   if (!creator) {
  //     throw new NotFoundException('User not found');
  //   }

  //   let initialStatus = 'PENDING_APPROVAL';

  //   const salesRoles = ['Salesman', 'Sales Team Lead', 'Sales Manager'];
  //   if (salesRoles.includes(creator.role.name)) {
  //     initialStatus = 'PENDING_APPROVAL';
  //   }

  //   const request = await this.prisma.serviceRequest.create({
  //     data: { ...dto, status: initialStatus as any },
  //     include: {
  //       customer: true,
  //       region: true,
  //       requestedBy: {
  //         include: {
  //           role: true,
  //         },
  //       },
  //     },
  //   });

  //   await this.notificationsService.notifyRequestCreated(
  //     request.id,
  //     dto.requestedById,
  //   );

  //   return request;
  // }

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

  // ✅ NEW METHOD: Get customer service history for technician
  // Add this method to your ServiceRequestsService class
  async getCustomerServiceHistory(serviceRequestId: string) {
    // 1. Get the service request to extract customer info
    const serviceRequest = await this.prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      select: {
        id: true,
        customerId: true,
        customer: {
          select: {
            id: true,
            name: true,
            primaryPhone: true,
            email: true,
            address: true,
            createdAt: true,
            region: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!serviceRequest) {
      throw new NotFoundException('Service request not found');
    }

    const customerId = serviceRequest.customerId;

    // 2. Fetch all service history for this customer (excluding DRAFT)
    const serviceHistory = await this.prisma.serviceRequest.findMany({
      where: {
        customerId: customerId,
        status: {
          not: 'DRAFT', // Exclude drafts from history
        },
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        region: {
          select: {
            id: true,
            name: true,
          },
        },
        installation: {
          select: {
            id: true,
            name: true,
            address: true,
            contactPerson: true,
            contactPhone: true,
          },
        },
        workMedia: {
          select: {
            id: true,
            fileUrl: true,
            uploadedAt: true,
          },
          orderBy: {
            uploadedAt: 'desc',
          },
        },
        usedProducts: {
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
        },
        approvalHistory: {
          include: {
            approver: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            approvedAt: 'desc',
          },
        },
        workLogs: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            duration: true,
            notes: true,
          },
          orderBy: {
            startTime: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Most recent first
      },
    });

    // 3. Calculate statistics (matching your pattern from reports)
    const statistics = {
      totalServices: serviceHistory.length,
      installations: await this.prisma.serviceRequest.count({
        where: { customerId, type: 'INSTALLATION' },
      }),
      reInstallations: await this.prisma.serviceRequest.count({
        where: { customerId, type: 'RE_INSTALLATION' },
      }),
      services: await this.prisma.serviceRequest.count({
        where: { customerId, type: 'SERVICE' },
      }),
      complaints: await this.prisma.serviceRequest.count({
        where: { customerId, type: 'COMPLAINT' },
      }),
      enquiries: await this.prisma.serviceRequest.count({
        where: { customerId, type: 'ENQUIRY' },
      }),
      completedServices: await this.prisma.serviceRequest.count({
        where: {
          customerId,
          status: 'COMPLETED',
        },
      }),
      lastService:
        serviceHistory.length > 0
          ? serviceHistory[0].createdAt.toISOString()
          : null,
    };

    // 4. Return data in same format as admin's customer history endpoint
    return {
      customer: serviceRequest.customer,
      serviceHistory,
      statistics,
    };
  }

  // ✅ FIXED: Helper method to get date range
  private getDateRange(query: ReportQueryDto) {
    // Start date - beginning of the day (00:00:00)
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    // ✅ FIX: End date - end of the day (23:59:59.999)
    let endDate: Date;
    if (query.endDate) {
      endDate = new Date(query.endDate);
      // Set to end of day
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = new Date();
      // Set to end of current day
      endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  }

  // ✅ NEW: Comprehensive Report (All-in-One)
  async getComprehensiveReport(query: ReportQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    const [
      serviceRequestsReport,
      technicianPerformance,
      regionalBreakdown,
      customerActivity,
      productUsage,
    ] = await Promise.all([
      this.getServiceRequestsReport(query),
      this.getTechnicianPerformanceReport(query),
      this.getRegionalBreakdownReport(query),
      this.getCustomerActivityReport(query),
      this.getProductUsageReport(query),
    ]);

    return {
      period: {
        startDate,
        endDate,
      },
      serviceRequests: serviceRequestsReport,
      technicianPerformance,
      regionalBreakdown,
      customerActivity,
      productUsage,
      generatedAt: new Date(),
    };
  }

  // ✅ NEW: Service Requests Report
  async getServiceRequestsReport(query: ReportQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    const baseWhere = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(query.regionId && { regionId: query.regionId }),
    };

    // Total requests
    const total = await this.prisma.serviceRequest.count({
      where: baseWhere,
    });

    // By status
    const byStatus = await this.prisma.serviceRequest.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: true,
    });

    // By type
    const byType = await this.prisma.serviceRequest.groupBy({
      by: ['type'],
      where: baseWhere,
      _count: true,
    });

    // Completion rate
    const completed = await this.prisma.serviceRequest.count({
      where: { ...baseWhere, status: 'COMPLETED' },
    });

    // Average completion time (in days)
    const completedRequests = await this.prisma.serviceRequest.findMany({
      where: { ...baseWhere, status: 'COMPLETED' },
      select: {
        createdAt: true,
        workLogs: {
          select: { endTime: true },
          orderBy: { endTime: 'desc' },
          take: 1,
        },
      },
    });

    const completionTimes = completedRequests
      .filter((req) => req.workLogs[0]?.endTime)
      .map((req) => {
        const start = req.createdAt;
        const end = req.workLogs[0].endTime!;
        return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24); // Days
      });

    const avgCompletionTime =
      completionTimes.length > 0
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
        : 0;

    return {
      total,
      byStatus: byStatus.map((item) => ({
        status: item.status,
        count: item._count,
        percentage: ((item._count / total) * 100).toFixed(1),
      })),
      byType: byType.map((item) => ({
        type: item.type,
        count: item._count,
        percentage: ((item._count / total) * 100).toFixed(1),
      })),
      completionRate: ((completed / total) * 100).toFixed(1),
      avgCompletionTimeDays: avgCompletionTime.toFixed(1),
    };
  }

  // ✅ NEW: Technician Performance Report
  async getTechnicianPerformanceReport(query: ReportQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    const technicians = await this.prisma.user.findMany({
      where: {
        role: { name: 'Technician' },
        ...(query.regionId && { regionId: query.regionId }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        region: { select: { name: true } },
      },
    });

    const performanceData = await Promise.all(
      technicians.map(async (tech) => {
        const assigned = await this.prisma.serviceRequest.count({
          where: {
            assignedToId: tech.id,
            createdAt: { gte: startDate, lte: endDate },
          },
        });

        const completed = await this.prisma.serviceRequest.count({
          where: {
            assignedToId: tech.id,
            status: 'COMPLETED',
            createdAt: { gte: startDate, lte: endDate },
          },
        });

        const inProgress = await this.prisma.serviceRequest.count({
          where: {
            assignedToId: tech.id,
            status: 'IN_PROGRESS',
            createdAt: { gte: startDate, lte: endDate },
          },
        });

        // Calculate average work duration
        const workLogs = await this.prisma.workLog.findMany({
          where: {
            technicianId: tech.id,
            startTime: { gte: startDate, lte: endDate },
            endTime: { not: null },
          },
          select: { duration: true },
        });

        const avgDuration =
          workLogs.length > 0
            ? workLogs.reduce((sum, log) => sum + (log.duration || 0), 0) /
              workLogs.length
            : 0;

        return {
          technicianId: tech.id,
          name: tech.name,
          email: tech.email,
          region: tech.region?.name || 'N/A',
          assigned,
          completed,
          inProgress,
          completionRate:
            assigned > 0 ? ((completed / assigned) * 100).toFixed(1) : '0',
          avgWorkDurationHours: (avgDuration / 60).toFixed(1), // Convert minutes to hours
        };
      }),
    );

    return performanceData.sort((a, b) => b.completed - a.completed);
  }

  // ✅ NEW: Regional Breakdown Report
  async getRegionalBreakdownReport(query: ReportQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    const regions = await this.prisma.region.findMany({
      select: {
        id: true,
        name: true,
        district: true,
        city: true,
      },
    });

    const regionalData = await Promise.all(
      regions.map(async (region) => {
        const requests = await this.prisma.serviceRequest.count({
          where: {
            regionId: region.id,
            createdAt: { gte: startDate, lte: endDate },
          },
        });

        const completed = await this.prisma.serviceRequest.count({
          where: {
            regionId: region.id,
            status: 'COMPLETED',
            createdAt: { gte: startDate, lte: endDate },
          },
        });

        const customers = await this.prisma.customer.count({
          where: { regionId: region.id },
        });

        const technicians = await this.prisma.user.count({
          where: {
            regionId: region.id,
            role: { name: 'Technician' },
          },
        });

        return {
          regionId: region.id,
          name: region.name,
          district: region.district,
          city: region.city,
          totalRequests: requests,
          completedRequests: completed,
          completionRate:
            requests > 0 ? ((completed / requests) * 100).toFixed(1) : '0',
          totalCustomers: customers,
          totalTechnicians: technicians,
        };
      }),
    );

    return regionalData.sort((a, b) => b.totalRequests - a.totalRequests);
  }

  // ✅ NEW: Customer Activity Report
  async getCustomerActivityReport(query: ReportQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    // New customers in period
    const newCustomers = await this.prisma.customer.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...(query.regionId && { regionId: query.regionId }),
      },
    });

    // Total customers
    const totalCustomers = await this.prisma.customer.count({
      where: query.regionId ? { regionId: query.regionId } : {},
    });

    // Top customers by service count
    const topCustomers = await this.prisma.customer.findMany({
      where: query.regionId ? { regionId: query.regionId } : {},
      select: {
        id: true,
        name: true,
        primaryPhone: true,
        region: { select: { name: true } },
        requests: {
          where: {
            createdAt: { gte: startDate, lte: endDate },
          },
          select: { id: true, status: true },
        },
      },
      take: 10,
    });

    const topCustomersWithStats = topCustomers
      .map((customer) => ({
        customerId: customer.id,
        name: customer.name,
        phone: customer.primaryPhone,
        region: customer.region?.name || 'N/A',
        totalServices: customer.requests.length,
        completedServices: customer.requests.filter(
          (r) => r.status === 'COMPLETED',
        ).length,
      }))
      .sort((a, b) => b.totalServices - a.totalServices);

    // Average services per customer
    const avgServicesPerCustomer =
      totalCustomers > 0
        ? (
            (await this.prisma.serviceRequest.count({
              where: {
                createdAt: { gte: startDate, lte: endDate },
                ...(query.regionId && { regionId: query.regionId }),
              },
            })) / totalCustomers
          ).toFixed(2)
        : '0';

    return {
      newCustomers,
      totalCustomers,
      avgServicesPerCustomer,
      topCustomers: topCustomersWithStats,
    };
  }

  // ✅ NEW: Product Usage Report
  async getProductUsageReport(query: ReportQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    // Most used products
    const productUsage = await this.prisma.serviceUsedProduct.groupBy({
      by: ['productId'],
      where: {
        confirmedAt: { gte: startDate, lte: endDate },
      },
      _sum: {
        quantityUsed: true,
      },
      _count: true,
    });

    const productDetails: any = await Promise.all(
      productUsage.map(async (usage) => {
        const product: any = await this.prisma.product.findUnique({
          where: { id: usage.productId },
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            stock: true,
          },
        });

        return {
          productId: usage.productId,
          name: product?.name || 'Unknown',
          sku: product?.sku || 'N/A',
          currentStock: product?.stock || 0,
          totalQuantityUsed: usage._sum.quantityUsed || 0,
          timesUsed: usage._count,
          estimatedValue:
            (product?.price || 0) * (usage._sum.quantityUsed || 0),
        };
      }),
    );

    // Low stock products
    const lowStockProducts = await this.prisma.product.findMany({
      where: {
        stock: { lte: 5 },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        price: true,
      },
      take: 10,
    });

    // Total product value consumed
    const totalValueConsumed = productDetails.reduce(
      (sum, p) => sum + Number(p.estimatedValue),
      0,
    );

    return {
      mostUsedProducts: productDetails
        .sort((a, b) => b.totalQuantityUsed - a.totalQuantityUsed)
        .slice(0, 10),
      lowStockProducts,
      totalValueConsumed: totalValueConsumed.toFixed(2),
      totalProductsUsed: productUsage.length,
    };
  }

  // ✅ ADD this method to ServiceRequestsService class

  async getTechnicianWorkload(technicianId: string): Promise<number> {
    // Count pending tasks (ASSIGNED + IN_PROGRESS)
    return this.prisma.serviceRequest.count({
      where: {
        assignedToId: technicianId,
        status: {
          in: ['ASSIGNED', 'IN_PROGRESS'],
        },
      },
    });
  }

  // ✅ ADD: Get all technicians with their workload
  async getTechniciansWithWorkload(regionId?: string) {
    const technicians = await this.prisma.user.findMany({
      where: {
        role: { name: 'Technician' },
        status: 'ACTIVE',
        ...(regionId && { regionId }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        region: {
          select: { name: true },
        },
      },
    });

    // Get workload for each technician
    const techniciansWithWorkload = await Promise.all(
      technicians.map(async (tech) => {
        const pendingCount = await this.getTechnicianWorkload(tech.id);
        return {
          ...tech,
          pendingTasks: pendingCount,
        };
      }),
    );

    // Sort by workload (least busy first)
    return techniciansWithWorkload.sort(
      (a, b) => a.pendingTasks - b.pendingTasks,
    );
  }

  // ✅ UPDATE: Create method to handle new workflow
  async create(dto: CreateServiceRequestDto, userId: string) {
    // Validate that assigned technician exists and is active
    const technician = await this.prisma.user.findFirst({
      where: {
        id: dto.assignedToId,
        role: { name: 'Technician' },
        status: 'ACTIVE',
      },
    });

    if (!technician) {
      throw new NotFoundException(
        'Invalid technician or technician is not active',
      );
    }

    // Create service request with ASSIGNED status directly
    const serviceRequest = await this.prisma.serviceRequest.create({
      data: {
        type: dto.type,
        description: dto.description,
        customerId: dto.customerId,
        regionId: dto.regionId,
        requestedById: userId,
        assignedToId: dto.assignedToId, // ✅ Assign directly
        priority: dto.priority || 'NORMAL', // ✅ Set priority
        status: 'ASSIGNED', // ✅ Skip DRAFT, PENDING_APPROVAL, APPROVED
      },
      include: {
        customer: true,
        region: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return serviceRequest;
  }
}
