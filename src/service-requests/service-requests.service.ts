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
import * as XLSX from 'xlsx';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ServiceRequestsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) { }

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

  async findAll(
    page: number = 1,
    limit: number = 10,
    status?: string,
    userId?: string,
    search?: string,
    searchBy: string = "general",
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc'
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by status if provided
    if (status && status !== "ALL") {
      where.status = status;
    }

    // Filter by assigned technician if userId provided
    if (userId) {
      where.assignedToId = userId;
    }

    // 🔍 Search functionality
    if (search) {
      if (searchBy === "technician") {
        where.assignedTo = {
          name: { contains: search, mode: "insensitive" },
        };
      } else {
        where.OR = [
          { customer: { name: { contains: search, mode: "insensitive" } } },
          { description: { contains: search, mode: "insensitive" } },
          { id: { contains: search, mode: "insensitive" } },
        ];
      }
    }

    // 📈 Sorting logic
    let requests: any[];
    let total: number;

    if (sortBy === 'workCompletedAt') {
      // Custom query for sorting by latest work log end time
      const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';
      const nullsDir = sortOrder === 'asc' ? 'NULLS FIRST' : 'NULLS LAST';

      // Construct raw query to get ordered IDs
      // We still need to respect filters
      let filterSql = 'WHERE 1=1';
      const params: any[] = [];

      if (status && status !== 'ALL') {
        filterSql += ` AND sr.status = $${params.length + 1}`;
        params.push(status);
      }
      if (userId) {
        filterSql += ` AND sr."assignedToId" = $${params.length + 1}`;
        params.push(userId);
      }
      if (search) {
        if (searchBy === 'technician') {
          // This requires a join with User table for assignedTo
          filterSql += ` AND EXISTS (SELECT 1 FROM "User" u WHERE u.id = sr."assignedToId" AND u.name ILIKE $${params.length + 1})`;
          params.push(`%${search}%`);
        } else {
          filterSql += ` AND (sr.description ILIKE $${params.length + 1} OR sr.id::text ILIKE $${params.length + 1} OR EXISTS (SELECT 1 FROM "Customer" c WHERE c.id = sr."customerId" AND c.name ILIKE $${params.length + 1}))`;
          params.push(`%${search}%`);
        }
      }

      const totalResult: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "ServiceRequest" sr ${filterSql}`,
        ...params
      );
      total = Number(totalResult[0].count);

      const idResults: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT sr.id FROM "ServiceRequest" sr
         LEFT JOIN (
           SELECT "requestId", MAX("endTime") as max_end
           FROM "WorkLog"
           GROUP BY "requestId"
         ) wl ON sr.id = wl."requestId"
         ${filterSql}
         ORDER BY wl.max_end ${orderDir} ${nullsDir}, sr."createdAt" DESC
         LIMIT ${limit} OFFSET ${skip}`,
        ...params
      );

      const ids = idResults.map(r => r.id);
      
      // Fetch full details for these IDs and maintain order
      const fetchedRequests = await this.prisma.serviceRequest.findMany({
        where: { id: { in: ids } },
        include: {
          requestedBy: { include: { role: true } },
          approvedBy: true,
          assignedTo: true,
          customer: true,
          region: true,
          approvalHistory: { include: { approver: true } },
          workLogs: {
            orderBy: { endTime: 'desc' },
            take: 1,
          },
        }
      });

      // Sort fetched requests to match the order of IDs
      requests = ids.map(id => fetchedRequests.find(r => r.id === id)).filter(Boolean);

    } else {
      // Standard Prisma sorting for createdAt or other direct fields
      const orderBy: any = {};
      if (sortBy === 'createdAt') {
        orderBy.createdAt = sortOrder;
      } else {
        orderBy.createdAt = 'desc'; // Default
      }

      [requests, total] = await Promise.all([
        this.prisma.serviceRequest.findMany({
          where,
          include: {
            requestedBy: { include: { role: true } },
            approvedBy: true,
            assignedTo: true,
            customer: true,
            region: true,
            approvalHistory: { include: { approver: true } },
            workLogs: {
              orderBy: { endTime: 'desc' },
              take: 1,
            },
          },
          orderBy,
          skip,
          take: limit,
        }),
        this.prisma.serviceRequest.count({ where }),
      ]);
    }

    return {
      data: requests,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        acknowledgedBy: true,
        requestedBy: { include: { role: true } },
        approvedBy: true,
        assignedTo: true,
        customer: true,
        region: true,
        workLogs: true,
        workMedia: true,
        reassignmentHistory: true,
        installation: true,
        approvalHistory: {
          include: { approver: true },
          orderBy: { approvedAt: 'asc' },
        },
        category: true,
        invoices: true,
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
    if (request.status !== 'APPROVED' && request.status !== 'UNASSIGNED') {
      throw new ForbiddenException(
        'Request must be approved or unassigned before assignment',
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

  // ✅ NEW: Update description (Tele Caller, Super Admin, Service Admin only)
  async updateDescription(id: string, description: string, userId: string) {
    const request = await this.findOne(id);

    // Verify user has permission
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const allowedRoles = ['Super Admin', 'Service Admin', 'Tele Caller'];
    if (!allowedRoles.includes(user.role.name)) {
      throw new ForbiddenException(
        'Only Tele Caller, Super Admin, and Service Admin can edit descriptions',
      );
    }

    return this.prisma.serviceRequest.update({
      where: { id },
      data: { description },
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

    const reAssigned = await this.prisma.serviceRequest.count({
      where: {
        ...baseConditions,
        status: 'RE_ASSIGNED',
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
        reAssigned: await this.prisma.serviceRequest.count({
          where: { assignedToId: userId, status: 'RE_ASSIGNED' },
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
      reAssigned,
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
      case 'Tele Caller':
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
    const originalRequest = await this.findOne(id);
    const reassigner = await this.prisma.user.findUnique({
      where: { id: reassignedById },
      include: { role: true },
    });

    if (!reassigner) throw new NotFoundException('Reassigner not found');

    if (['IN_PROGRESS'].includes(originalRequest.status)) {
      throw new ForbiddenException(
        `Cannot reassign while work in progress. Status: ${originalRequest.status}`,
      );
    }

    const allowedStatuses = [
      'WORK_COMPLETED',
      'COMPLETED',
      'ASSIGNED',
      'RE_ASSIGNED',
      'RE_INSTALLATION',
    ];
    if (!allowedStatuses.includes(originalRequest.status)) {
      throw new ForbiddenException(
        `Reassignment not allowed in status: ${originalRequest.status}`,
      );
    }

    // if (
    //   ![
    //     'Super Admin',
    //     'Service Admin',
    //     'Service Manager',
    //     'Service Team Lead',
    //   ].includes(reassigner.role.name)
    // ) {
    //   throw new ForbiddenException('Insufficient permissions');
    // }

    const newTechnician = await this.prisma.user.findUnique({
      where: { id: newTechnicianId },
      include: { role: true },
    });

    if (!newTechnician || newTechnician.role.name !== 'Technician')
      throw new BadRequestException('Invalid new technician');

    const isPostWork = ['WORK_COMPLETED', 'COMPLETED', 'RE_ASSIGNED'].includes(
      originalRequest.status,
    );

    if (newTechnician.id === originalRequest.assignedToId && !isPostWork)
      throw new BadRequestException('Technician already assigned');

    if (isPostWork) {
      // CREATE A NEW SERVICE REQUEST BASED ON ORIGINAL
      const newRequest = await this.prisma.serviceRequest.create({
        data: {
          type: originalRequest.type,
          description: originalRequest.description,
          priority: originalRequest.priority,
          requestedById: originalRequest.requestedById,
          regionId: originalRequest.regionId,
          customerId: originalRequest.customerId,
          categoryId: originalRequest.categoryId,
          installationId: originalRequest.installationId,
          assignedToId: newTechnicianId,
          status: 'RE_ASSIGNED',
          salesApproved: false,
          postWorkReassignCount: 0,
        },
      });

      // ✅ CREATE REASSIGNMENT HISTORY FOR THE NEW REQUEST (not the old one)
      await this.prisma.reassignmentHistory.create({
        data: {
          requestId: newRequest.id, // Link to NEW request ID
          reassignedBy: reassignedById,
          previousTechId: originalRequest.assignedToId,
          newTechId: newTechnicianId,
          reason,
        },
      });

      // ✅ ALSO CREATE A HISTORY RECORD FOR THE ORIGINAL REQUEST (optional for audit)
      await this.prisma.reassignmentHistory.create({
        data: {
          requestId: id, // Link to ORIGINAL request ID
          reassignedBy: reassignedById,
          previousTechId: originalRequest.assignedToId,
          newTechId: newTechnicianId,
          reason,
        },
      });

      // Fetch the new request with all relations including reassignmentHistory
      const newRequestWithHistory = await this.prisma.serviceRequest.findUnique(
        {
          where: { id: newRequest.id },
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
        },
      );

      // Notify new technician
      await this.notificationsService.notifyRequestAssigned(
        newRequest.id,
        newTechnicianId,
      );

      console.log(
        'New Request with Reassignment History:',
        newRequestWithHistory,
      );
      return newRequestWithHistory;
    } else {
      // PRE-WORK REASSIGNMENT - Update existing request

      // Create reassignment history for original request
      await this.prisma.reassignmentHistory.create({
        data: {
          requestId: id,
          reassignedBy: reassignedById,
          previousTechId: originalRequest.assignedToId,
          newTechId: newTechnicianId,
          reason,
        },
      });

      const updatedRequest = await this.prisma.serviceRequest.update({
        where: { id },
        data: {
          assignedToId: newTechnicianId,
          status: 'ASSIGNED',
          acknowledgedById: null,
          acknowledgedAt: null,
          acknowledgmentComments: null,
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

      // Notify old and new technicians
      if (originalRequest.assignedToId) {
        await this.notificationsService.createNotification(
          reassignedById,
          originalRequest.assignedToId,
          `Service request #${id} reassigned from you. Reason: ${reason}`,
        );
      }
      await this.notificationsService.notifyRequestAssigned(
        id,
        newTechnicianId,
      );

      return updatedRequest;
    }
  }

  async reassignCompletedService({
    requestId,
    newTechnicianId,
    reason,
    reassignedBy,
  }: {
    requestId: string;
    newTechnicianId: string;
    reason: string;
    reassignedBy: string;
  }) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException();

    if (!['WORK_COMPLETED', 'COMPLETED'].includes(request.status))
      throw new BadRequestException('Request not eligible for reassignment');

    await this.prisma.reassignmentHistory.create({
      data: {
        requestId,
        reassignedBy: reassignedBy,
        previousTechId: request.assignedToId,
        newTechId: newTechnicianId,
        reason,
      },
    });

    await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        assignedToId: newTechnicianId,
        status: 'ASSIGNED',
        acknowledgedById: null,
        acknowledgedAt: null,
        acknowledgmentComments: null,
      },
    });
    return { message: 'Reassignment successful' };
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

  // async addUsedProducts(
  //   requestId: string,
  //   userId: string,
  //   usedProducts: Array<{
  //     productId: string;
  //     quantityUsed: number;
  //     notes?: string;
  //   }>,
  // ) {
  //   const request = await this.findOne(requestId);
  //   const technician = await this.prisma.user.findUnique({
  //     where: { id: userId },
  //     include: { role: true },
  //   });

  //   if (!technician) {
  //     throw new NotFoundException('User not found');
  //   }

  //   // ✅ ONLY TECHNICIAN CAN ADD USED PRODUCTS
  //   if (technician.role.name !== 'Technician') {
  //     throw new ForbiddenException('Only technicians can add used products');
  //   }

  //   // ✅ CHECK STATUS - WORK_COMPLETED ONLY
  //   if (request.status !== 'WORK_COMPLETED') {
  //     throw new ForbiddenException(
  //       'Products can only be added when work is completed. Current status: ' +
  //         request.status,
  //     );
  //   }

  //   // ✅ CHECK IF PRODUCTS ALREADY ADDED
  //   const existingProducts = await this.prisma.serviceUsedProduct.findMany({
  //     where: { requestId },
  //   });

  //   if (existingProducts.length > 0) {
  //     throw new BadRequestException(
  //       'Products already added for this service request. Editing is not allowed.',
  //     );
  //   }

  //   // ✅ VALIDATE & PROCESS EACH PRODUCT
  //   const addedProducts: any[] = [];

  //   for (const item of usedProducts) {
  //     const product = await this.prisma.product.findUnique({
  //       where: { id: item.productId },
  //     });

  //     if (!product) {
  //       throw new NotFoundException(`Product ${item.productId} not found`);
  //     }

  //     if (product.stock < item.quantityUsed) {
  //       throw new BadRequestException(
  //         `Insufficient stock for product "${product.name}". Available: ${product.stock}, Requested: ${item.quantityUsed}`,
  //       );
  //     }

  //     // ✅ CREATE USED PRODUCT RECORD
  //     const usedProduct = await this.prisma.serviceUsedProduct.create({
  //       data: {
  //         requestId,
  //         productId: item.productId,
  //         quantityUsed: item.quantityUsed,
  //         notes: item.notes,
  //         confirmedBy: userId,
  //       },
  //       include: {
  //         product: true,
  //         confirmedUser: true,
  //       },
  //     });

  //     // ✅ DECREASE STOCK QUANTITY
  //     await this.prisma.product.update({
  //       where: { id: item.productId },
  //       data: {
  //         stock: {
  //           decrement: item.quantityUsed,
  //         },
  //       },
  //     });

  //     // ✅ LOG STOCK CHANGE
  //     // ✅ LOG STOCK CHANGE
  //     await this.prisma.productStockHistory.create({
  //       data: {
  //         productId: item.productId,
  //         quantityChange: -item.quantityUsed,
  //         reason: `Used in Service: Request #${requestId}`,
  //       },
  //     });

  //     addedProducts.push(usedProduct);
  //   }

  //   return addedProducts;
  // }

  // async addUsedItems(
  //   requestId: string,
  //   userId: string,
  //   usedItems: Array<{
  //     type: string;
  //     id: string;
  //     quantityUsed: number;
  //     notes?: string;
  //   }>,
  // ) {
  //   const request = await this.findOne(requestId);
  //   const technician = await this.prisma.user.findUnique({
  //     where: { id: userId },
  //     include: { role: true },
  //   });

  //   if (!technician) throw new NotFoundException('User not found');
  //   if (technician.role.name !== 'Technician')
  //     throw new ForbiddenException('Only technicians can add used items');
  //   if (request.status !== 'WORK_COMPLETED')
  //     throw new ForbiddenException(
  //       `Can only add after work completed. Status: ${request.status}`,
  //     );

  //   const existingProducts = await this.prisma.serviceUsedProduct.findMany({
  //     where: { requestId },
  //   });
  //   if (existingProducts.length > 0)
  //     throw new BadRequestException(
  //       'Used products already added; editing disallowed.',
  //     );

  //   const addedItems: any[] = [];

  //   for (const item of usedItems) {
  //     if (item.type === 'product') {
  //       const product = await this.prisma.product.findUnique({
  //         where: { id: item.id },
  //       });
  //       if (!product)
  //         throw new NotFoundException(`Product ${item.id} not found`);
  //       if (product.stock < item.quantityUsed)
  //         throw new BadRequestException(
  //           `Insufficient stock for product "${product.name}".`,
  //         );

  //       const usedProduct = await this.prisma.serviceUsedProduct.create({
  //         data: {
  //           requestId,
  //           productId: item.id,
  //           quantityUsed: item.quantityUsed,
  //           notes: item.notes,
  //           confirmedBy: userId,
  //         },
  //         include: { product: true, confirmedUser: true },
  //       });

  //       await this.prisma.product.update({
  //         where: { id: item.id },
  //         data: { stock: { decrement: item.quantityUsed } },
  //       });

  //       await this.prisma.productStockHistory.create({
  //         data: {
  //           productId: item.id,
  //           quantityChange: -item.quantityUsed,
  //           reason: `Used in Service Request #${requestId}`,
  //         },
  //       });

  //       addedItems.push(usedProduct);
  //     } else if (item.type === 'sparePart') {
  //       const sparePart = await this.prisma.sparePart.findUnique({
  //         where: { id: item.id },
  //       });
  //       if (!sparePart)
  //         throw new NotFoundException(`Spare part ${item.id} not found`);
  //       if (sparePart.stock < item.quantityUsed)
  //         throw new BadRequestException(
  //           `Insufficient stock for spare part "${sparePart.name}".`,
  //         );

  //       const usedSparePart = await this.prisma.serviceUsedProduct.create({
  //         data: {
  //           requestId,
  //           sparePartId: item.id,
  //           quantityUsed: item.quantityUsed,
  //           notes: item.notes,
  //           confirmedBy: userId,
  //         },
  //         include: { sparePart: true, confirmedUser: true },
  //       });

  //       await this.prisma.sparePart.update({
  //         where: { id: item.id },
  //         data: { stock: { decrement: item.quantityUsed } },
  //       });

  //       await this.prisma.sparePartStockHistory.create({
  //         data: {
  //           sparePartId: item.id,
  //           quantityChange: -item.quantityUsed,
  //           reason: `Used in Service Request #${requestId}`,
  //         },
  //       });

  //       addedItems.push(usedSparePart);
  //     }
  //   }

  //   return addedItems;
  // }

  async addUsedItems(
    requestId: string,
    userId: string,
    usedItems: Array<{
      type: string;
      id: string;
      quantityUsed: number;
      notes?: string;
      source: 'warehouse' | 'technician'; // NEW parameter
    }>,
  ) {
    const request = await this.findOne(requestId);

    const technician = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!technician) throw new NotFoundException('User not found');
    if (technician.role.name !== 'Technician')
      throw new ForbiddenException('Only technicians can add used items');
    if (request.status !== 'WORK_COMPLETED')
      throw new ForbiddenException(
        `Can only add after work completed. Status: ${request.status}`,
      );

    // Relaxed check to allow adding more products/spare parts
    /*
    const existingProducts = await this.prisma.serviceUsedProduct.findMany({
      where: { requestId },
    });
    if (existingProducts.length > 0)
      throw new BadRequestException(
        'Used products already added; editing disallowed.',
      );
    */

    const addedItems: any[] = [];

    for (const item of usedItems) {
      if (item.type === 'product') {
        const product = await this.prisma.product.findUnique({
          where: { id: item.id },
        });
        if (!product)
          throw new NotFoundException(`Product ${item.id} not found`);

        if (item.source === 'warehouse') {
          if (product.stock < item.quantityUsed)
            throw new BadRequestException(
              `Insufficient warehouse stock for product "${product.name}".`,
            );

          // Reduce warehouse stock
          await this.prisma.product.update({
            where: { id: item.id },
            data: { stock: { decrement: item.quantityUsed } },
          });
        } else if (item.source === 'technician') {
          // Reduce technician stock
          const techStockRecord = await this.prisma.technicianStock.findUnique({
            where: {
              technicianId_productId: {
                technicianId: userId,
                productId: item.id,
              },
            },
          });
          if (
            !techStockRecord ||
            techStockRecord.quantity < item.quantityUsed
          ) {
            throw new BadRequestException(
              `Insufficient technician stock for product "${product.name}".`,
            );
          }
          await this.prisma.technicianStock.update({
            where: { id: techStockRecord.id },
            data: { quantity: { decrement: item.quantityUsed } },
          });
        }

        const usedProduct = await this.prisma.serviceUsedProduct.create({
          data: {
            requestId,
            productId: item.id,
            quantityUsed: item.quantityUsed,
            source: item.source, // Saved from parameter
            notes: item.notes,
            confirmedBy: userId,
          },
          include: { product: true, confirmedUser: true },
        });

        // Log stock history for warehouse stock only (optional: log technician stock separately)
        if (item.source === 'warehouse') {
          await this.prisma.productStockHistory.create({
            data: {
              productId: item.id,
              quantityChange: -item.quantityUsed,
              reason: `Used in Service Request #${requestId}`,
            },
          });
        }

        addedItems.push(usedProduct);
      } else if (item.type === 'sparePart') {
        const sparePart = await this.prisma.sparePart.findUnique({
          where: { id: item.id },
        });
        if (!sparePart)
          throw new NotFoundException(`Spare part ${item.id} not found`);

        if (item.source === 'warehouse') {
          if (sparePart.stock < item.quantityUsed)
            throw new BadRequestException(
              `Insufficient warehouse stock for spare part "${sparePart.name}".`,
            );

          // Reduce warehouse stock
          await this.prisma.sparePart.update({
            where: { id: item.id },
            data: { stock: { decrement: item.quantityUsed } },
          });
        } else if (item.source === 'technician') {
          // Reduce technician stock
          const techStockRecord = await this.prisma.technicianStock.findUnique({
            where: {
              technicianId_sparePartId: {
                technicianId: userId,
                sparePartId: item.id,
              },
            },
          });
          if (
            !techStockRecord ||
            techStockRecord.quantity < item.quantityUsed
          ) {
            throw new BadRequestException(
              `Insufficient technician stock for spare part "${sparePart.name}".`,
            );
          }
          await this.prisma.technicianStock.update({
            where: { id: techStockRecord.id },
            data: { quantity: { decrement: item.quantityUsed } },
          });
        }

        const usedSparePart = await this.prisma.serviceUsedProduct.create({
          data: {
            requestId,
            sparePartId: item.id,
            quantityUsed: item.quantityUsed,
            source: item.source, // Saved from parameter
            notes: item.notes,
            confirmedBy: userId,
          },
          include: { sparePart: true, confirmedUser: true },
        });

        // Log stock history for warehouse stock only
        if (item.source === 'warehouse') {
          await this.prisma.sparePartStockHistory.create({
            data: {
              sparePartId: item.id,
              quantityChange: -item.quantityUsed,
              reason: `Used in Service Request #${requestId}`,
            },
          });
        }

        addedItems.push(usedSparePart);
      }
    }

    return addedItems;
  }

  // ✅ ADDED: Admin facility for freelancer work
  async recordFreelancerWork(
    requestId: string,
    adminId: string,
    dto: any, // We can type this with RecordFreelancerWorkDto
  ) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { assignedTo: true },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (request.status !== 'ASSIGNED' && request.status !== 'RE_ASSIGNED') {
      throw new BadRequestException('Request must be ASSIGNED or RE_ASSIGNED to record work');
    }

    // 1. Create the WorkLog
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    await this.prisma.workLog.create({
      data: {
        requestId,
        technicianId: request.assignedToId!,
        startTime,
        endTime,
        duration,
        notes: dto.notes,
      },
    });

    // 2. Process Used Items (if any)
    if (dto.usedItems && dto.usedItems.length > 0) {
      const standardItems: any[] = [];
      for (const item of dto.usedItems) {
        if (item.source === 'external') {
          // Direct insertion for external items without stock deduction
          await this.prisma.serviceUsedProduct.create({
            data: {
              requestId,
              quantityUsed: item.quantityUsed,
              source: 'external',
              notes: item.notes,
              confirmedBy: adminId,
              isExternal: true,
              externalName: item.externalName,
              externalPrice: item.externalPrice,
              externalWarrantyMonths: item.externalWarrantyMonths ? Number(item.externalWarrantyMonths) : null,
            },
          });
        } else {
          standardItems.push(item);
        }
      }

      // Delegate warehouse/technician items to existing logic
      if (standardItems.length > 0) {
        await this.addUsedItems(requestId, adminId, standardItems);
      }
    }

    // 3. Mark as WORK_COMPLETED
    const updatedRequest = await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: 'WORK_COMPLETED' },
    });

    return updatedRequest;
  }

  async updateUsedItem(
    requestId: string,
    userId: string,
    usedItemId: string,
    quantityUsed: number,
  ) {
    const usedItem = await this.prisma.serviceUsedProduct.findUnique({
      where: { id: usedItemId },
    });

    if (!usedItem || usedItem.requestId !== requestId) {
      throw new NotFoundException('Used item not found in this request');
    }

    const diff = quantityUsed - usedItem.quantityUsed;
    if (diff === 0) return usedItem;

    // Determine type and source
    const isProduct = !!usedItem.productId;
    const itemId = usedItem.productId || usedItem.sparePartId;
    const source = usedItem.source as 'warehouse' | 'technician';

    if (source === 'warehouse') {
      if (isProduct) {
        const product = await this.prisma.product.findUnique({
          where: { id: usedItem.productId! },
        });
        if (!product) throw new NotFoundException('Product not found');
        if (diff > 0 && product.stock < diff) {
          throw new BadRequestException('Insufficient warehouse stock');
        }
        await this.prisma.product.update({
          where: { id: usedItem.productId! },
          data: { stock: { decrement: diff } },
        });
        await this.prisma.productStockHistory.create({
          data: {
            productId: usedItem.productId!,
            quantityChange: -diff,
            reason: `Updated in Service Request #${requestId}`,
          },
        });
      } else {
        const sparePart = await this.prisma.sparePart.findUnique({
          where: { id: usedItem.sparePartId! },
        });
        if (!sparePart) throw new NotFoundException('Spare part not found');
        if (diff > 0 && sparePart.stock < diff) {
          throw new BadRequestException('Insufficient warehouse stock');
        }
        await this.prisma.sparePart.update({
          where: { id: usedItem.sparePartId! },
          data: { stock: { decrement: diff } },
        });
        await this.prisma.sparePartStockHistory.create({
          data: {
            sparePartId: usedItem.sparePartId!,
            quantityChange: -diff,
            reason: `Updated in Service Request #${requestId}`,
          },
        });
      }
    } else if (source === 'technician') {
      const techStockWhere = isProduct
        ? {
          technicianId_productId: {
            technicianId: usedItem.confirmedBy,
            productId: usedItem.productId!,
          },
        }
        : {
          technicianId_sparePartId: {
            technicianId: usedItem.confirmedBy,
            sparePartId: usedItem.sparePartId!,
          },
        };

      const techStock = await this.prisma.technicianStock.findUnique({
        where: techStockWhere as any,
      });

      if (!techStock || (diff > 0 && techStock.quantity < diff)) {
        throw new BadRequestException('Insufficient technician stock');
      }

      await this.prisma.technicianStock.update({
        where: { id: techStock.id },
        data: { quantity: { decrement: diff } },
      });

      // ✅ Log technician stock transaction
      await this.prisma.technicianStockTransaction.create({
        data: {
          technicianId: usedItem.confirmedBy,
          [isProduct ? 'productId' : 'sparePartId']: itemId,
          quantity: -diff,
          type: 'CONSUMPTION',
          notes: `Updated usage in Service Request #${requestId}`,
        },
      });
    }

    return this.prisma.serviceUsedProduct.update({
      where: { id: usedItemId },
      data: { quantityUsed },
    });
  }

  async deleteUsedItem(requestId: string, userId: string, usedItemId: string) {
    const usedItem = await this.prisma.serviceUsedProduct.findUnique({
      where: { id: usedItemId },
    });

    if (!usedItem || usedItem.requestId !== requestId) {
      throw new NotFoundException('Used item not found in this request');
    }

    const isProduct = !!usedItem.productId;
    const source = usedItem.source as 'warehouse' | 'technician';
    const qtyToRestore = usedItem.quantityUsed;

    if (source === 'warehouse') {
      if (isProduct) {
        await this.prisma.product.update({
          where: { id: usedItem.productId! },
          data: { stock: { increment: qtyToRestore } },
        });
        await this.prisma.productStockHistory.create({
          data: {
            productId: usedItem.productId!,
            quantityChange: qtyToRestore,
            reason: `Deleted from Service Request #${requestId}`,
          },
        });
      } else {
        await this.prisma.sparePart.update({
          where: { id: usedItem.sparePartId! },
          data: { stock: { increment: qtyToRestore } },
        });
        await this.prisma.sparePartStockHistory.create({
          data: {
            sparePartId: usedItem.sparePartId!,
            quantityChange: qtyToRestore,
            reason: `Deleted from Service Request #${requestId}`,
          },
        });
      }
    } else if (source === 'technician') {
      const techStockWhere = isProduct
        ? {
          technicianId_productId: {
            technicianId: usedItem.confirmedBy,
            productId: usedItem.productId!,
          },
        }
        : {
          technicianId_sparePartId: {
            technicianId: usedItem.confirmedBy,
            sparePartId: usedItem.sparePartId!,
          },
        };

      const techStock = await this.prisma.technicianStock.findUnique({
        where: techStockWhere as any,
      });

      if (techStock) {
        await this.prisma.technicianStock.update({
          where: { id: techStock.id },
          data: { quantity: { increment: qtyToRestore } },
        });

        // ✅ Log technician stock transaction (Restoration)
        await this.prisma.technicianStockTransaction.create({
          data: {
            technicianId: usedItem.confirmedBy,
            [isProduct ? 'productId' : 'sparePartId']: isProduct ? usedItem.productId : usedItem.sparePartId,
            quantity: qtyToRestore,
            type: 'ISSUE', // Restoration is like an issue back to tech stock
            notes: `Deleted usage in Service Request #${requestId}`,
          },
        });
      }
    }

    return this.prisma.serviceUsedProduct.delete({
      where: { id: usedItemId },
    });
  }

  async getUsedSpareParts(requestId: string) {
    return this.prisma.serviceUsedProduct.findMany({
      where: { requestId, sparePartId: { not: null } },
      include: {
        sparePart: {
          select: {
            id: true,
            name: true,
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
        sparePart: {
          // ✅ Include sparePart with needed fields
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
      qualityMetrics, // ✅ NEW
      reassignmentAnalysis, // ✅ NEW
      operationalMetrics, // ✅ NEW
      sparePartUsage, // ✅ NEW
      assemblyUsage,
    ] = await Promise.all([
      this.getServiceRequestsReport(query),
      this.getTechnicianPerformanceReport(query),
      this.getRegionalBreakdownReport(query),
      this.getCustomerActivityReport(query),
      this.getProductUsageReport(query),
      this.getQualityMetrics(query), // ✅ NEW
      this.getReassignmentAnalysis(query), // ✅ NEW
      this.getOperationalEfficiency(query), // ✅ NEW
      this.getSparePartUsageReport(query), // ✅ NEW
      this.getAssemblyUsageReport(query),
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
      qualityMetrics, // ✅ NEW
      reassignmentAnalysis, // ✅ NEW
      operationalMetrics, // ✅ NEW
      sparePartUsage, // ✅ NEW
      assemblyUsage, // ✅ NEW
      generatedAt: new Date(),
    };
  }

  // Spare Part Usage Analytics
  async getSparePartUsageReport(query: ReportQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    // Group by sparePartId and sum quantities
    const sparePartUsage = await this.prisma.serviceUsedProduct.groupBy({
      by: ['sparePartId'],
      where: {
        sparePartId: { not: null },
        request: { createdAt: { gte: startDate, lte: endDate } },
      },
      _sum: { quantityUsed: true },
      _count: true,
    });

    // Fetch spare part details for each group
    const details = await Promise.all(
      sparePartUsage
        .filter((u) => u.sparePartId)
        .map(async (usage) => {
          const part = await this.prisma.sparePart.findUnique({
            where: { id: usage.sparePartId! },
            select: {
              id: true,
              name: true,
              sku: true,
              stock: true,
              price: true,
            },
          });
          return {
            sparePartId: part?.id,
            name: part?.name || 'Unknown',
            sku: part?.sku || 'N/A',
            currentStock: part?.stock || 0,
            totalQuantityUsed: usage._sum.quantityUsed || 0,
            timesUsed: usage._count,
            estimatedValue: (part?.price || 0) * (usage._sum.quantityUsed || 0),
          };
        }),
    );
    return {
      mostUsedSpareParts: details.sort(
        (a, b) => b.totalQuantityUsed - a.totalQuantityUsed,
      ),
      totalSparePartsUsed: details.length,
      totalSparePartsValue: details
        .reduce((sum, p) => sum + p.estimatedValue, 0)
        .toFixed(2),
    };
  }

  // Assembly Usage Analytics
  async getAssemblyUsageReport(query: ReportQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);
    const assemblies = await this.prisma.assemblyHistory.findMany({
      where: { assembledAt: { gte: startDate, lte: endDate } },
      select: {
        id: true,
        product: { select: { id: true, name: true, sku: true } },
        totalCost: true,
        usedParts: {
          select: {
            sparePart: { select: { id: true, name: true } },
            quantityUsed: true,
          },
        },
      },
    });

    return {
      totalAssemblies: assemblies.length,
      totalAssemblyCost: assemblies
        .reduce((sum, a) => sum + (a.totalCost || 0), 0)
        .toFixed(2),
      mostAssembledProducts: assemblies.reduce(
        (acc, a) => {
          const key = a.product?.name || 'Unknown';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      usedPartsCount: assemblies.flatMap((a) => a.usedParts).length,
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

        // Calculate average response time (Assigned -> In Progress)
        const reassignments = await this.prisma.reassignmentHistory.count({
          where: { newTechId: tech.id, createdAt: { gte: startDate, lte: endDate } }
        });

        // Used items value
        const usedItems = await this.prisma.serviceUsedProduct.findMany({
          where: {
            confirmedBy: tech.id,
            confirmedAt: { gte: startDate, lte: endDate },
          },
          include: {
            product: { select: { price: true } },
            sparePart: { select: { price: true } },
          },
        });

        const totalUsedValue = usedItems.reduce((sum, item) => {
          const price = item.product?.price || item.sparePart?.price || 0;
          return sum + (price * item.quantityUsed);
        }, 0);

        return {
          technicianId: tech.id,
          name: tech.name,
          email: tech.email,
          region: tech.region?.name || 'N/A',
          assigned,
          completed,
          inProgress,
          reassignments,
          totalUsedValue: totalUsedValue.toFixed(2),
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

    const baseWhere = {
      request: {
        createdAt: { gte: startDate, lte: endDate },
        ...(query.regionId && { regionId: query.regionId }),
      },
    };

    // Group by productId and sum quantities
    const productUsage = await this.prisma.serviceUsedProduct.groupBy({
      by: ['productId'],
      where: baseWhere,
      _sum: { quantityUsed: true },
      _count: true,
    });

    console.log('product usage:', productUsage);

    // ✅ FILTER OUT NULL PRODUCT IDs BEFORE QUERYING
    const validProductUsage = productUsage.filter(
      (usage) => usage.productId !== null,
    );

    const productDetails: any = await Promise.all(
      validProductUsage.map(async (usage) => {
        const product: any = await this.prisma.product.findUnique({
          where: { id: usage.productId! }, // ✅ Non-null assertion since we filtered
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

    // Sort by most used
    const mostUsedProducts = productDetails.sort(
      (a: any, b: any) => b.totalQuantityUsed - a.totalQuantityUsed,
    );

    // Low stock products
    const lowStockProducts = await this.prisma.product.findMany({
      where: { stock: { lt: 10 } },
      select: { id: true, name: true, sku: true, stock: true, price: true },
      take: 10,
    });

    // Total value consumed
    const totalValueConsumed = productDetails.reduce(
      (sum: number, p: any) => sum + p.estimatedValue,
      0,
    );

    return {
      mostUsedProducts,
      lowStockProducts,
      totalValueConsumed: totalValueConsumed.toFixed(2),
      totalProductsUsed: productDetails.length,
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

  // ✅ UPDATED: Get all technicians with their workload + search support
  async getTechniciansWithWorkload(regionId?: string, query?: string) {
    const where: any = {
      role: { name: 'Technician' },
      status: 'ACTIVE',
    };

    // Filter by region if provided
    if (regionId) {
      where.regionId = regionId;
    }

    // 🆕 Add search by name (case-insensitive)
    if (query && query.length >= 2) {
      where.name = {
        contains: query,
        mode: 'insensitive',
      };
    }

    const technicians = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        isExternal: true, // 🆕 Added for badge display
        regionId: true, // 🆕 Added for "Different Region" chip
        region: {
          select: {
            name: true,
            id: true, // 🆕 Added for comparison
          },
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
    console.log('create service dto :', dto);
    let technician: any = null;
    if (dto.assignedToId) {
      technician = await this.prisma.user.findFirst({
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
    }

    if (dto.categoryId === '') {
      dto.categoryId = null;
    }
    if (dto.installationId === '') {
      dto.installationId = null;
    }
    // Create service request with ASSIGNED status directly
    const serviceRequest = await this.prisma.serviceRequest.create({
      data: {
        type: dto.type,
        description: dto.description,
        customerId: dto.customerId,
        regionId: dto.regionId,
        requestedById: userId,
        categoryId: dto.categoryId,
        installationId: dto.installationId,
        assignedToId: dto.assignedToId || null,
        priority: dto.priority || 'NORMAL',
        status: dto.assignedToId ? 'ASSIGNED' : 'UNASSIGNED',
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

  // ✅ NEW: Quality Metrics Report
  async getQualityMetrics(query: ReportQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    const baseWhere = {
      createdAt: { gte: startDate, lte: endDate },
      ...(query.regionId && { regionId: query.regionId }),
    };

    // Total completed requests
    const totalCompleted = await this.prisma.serviceRequest.count({
      where: { ...baseWhere, status: 'COMPLETED' },
    });

    // First-time fix rate (completed without reassignment)
    const firstTimeFix = await this.prisma.serviceRequest.count({
      where: {
        ...baseWhere,
        status: 'COMPLETED',
        postWorkReassignCount: 0,
      },
    });

    // Total reassignments
    const totalReassignments = await this.prisma.reassignmentHistory.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    // Requests with reassignments
    const requestsWithReassignment = await this.prisma.serviceRequest.count({
      where: {
        ...baseWhere,
        postWorkReassignCount: { gt: 0 },
      },
    });

    // Average reassignments per request
    const allRequests = await this.prisma.serviceRequest.findMany({
      where: baseWhere,
      select: { postWorkReassignCount: true },
    });

    const avgReassignments =
      allRequests.length > 0
        ? allRequests.reduce((sum, r) => sum + r.postWorkReassignCount, 0) /
        allRequests.length
        : 0;

    // Work media upload compliance
    const completedWithMedia = await this.prisma.serviceRequest.count({
      where: {
        ...baseWhere,
        status: 'COMPLETED',
        workMedia: { some: {} },
      },
    });

    return {
      firstTimeFixRate:
        totalCompleted > 0
          ? ((firstTimeFix / totalCompleted) * 100).toFixed(1)
          : '0',
      reworkRate:
        totalCompleted > 0
          ? (((totalCompleted - firstTimeFix) / totalCompleted) * 100).toFixed(
            1,
          )
          : '0',
      totalReassignments,
      avgReassignmentsPerRequest: avgReassignments.toFixed(2),
      workMediaUploadCompliance:
        totalCompleted > 0
          ? ((completedWithMedia / totalCompleted) * 100).toFixed(1)
          : '0',
    };
  }

  // ✅ NEW: Reassignment Analysis Report
  async getReassignmentAnalysis(query: ReportQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    // Total reassignments in period
    const allReassignments = await this.prisma.reassignmentHistory.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        request: {
          select: { status: true },
        },
      },
    });

    // Separate pre-work and post-work reassignments
    const preWorkReassignments = allReassignments.filter(
      (r) =>
        !['WORK_COMPLETED', 'COMPLETED', 'RE_ASSIGNED'].includes(
          r.request.status,
        ),
    );

    const postWorkReassignments = allReassignments.filter((r) =>
      ['WORK_COMPLETED', 'COMPLETED', 'RE_ASSIGNED'].includes(r.request.status),
    );

    // Group by reason
    const reasonGroups = allReassignments.reduce(
      (acc, r) => {
        acc[r.reason] = (acc[r.reason] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const topReassignmentReasons = Object.entries(reasonGroups)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: ((count / allReassignments.length) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Most reassigned technicians
    const techReassignments = await this.prisma.reassignmentHistory.groupBy({
      by: ['previousTechId', 'newTechId'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: true,
    });

    return {
      totalReassignments: allReassignments.length,
      preWorkReassignments: preWorkReassignments.length,
      postWorkReassignments: postWorkReassignments.length,
      topReassignmentReasons,
    };
  }

  // ✅ NEW: Operational Efficiency Report
  async getOperationalEfficiency(query: ReportQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    // Backlog count (PENDING_APPROVAL, APPROVED, ASSIGNED not started)
    const backlogCount = await this.prisma.serviceRequest.count({
      where: {
        status: { in: ['PENDING_APPROVAL', 'APPROVED', 'ASSIGNED'] },
        createdAt: { lte: endDate },
      },
    });

    // Aging analysis
    const now = new Date();
    const agingRequests = await this.prisma.serviceRequest.findMany({
      where: {
        status: { notIn: ['COMPLETED', 'REJECTED'] },
        createdAt: { lte: endDate },
      },
      select: { createdAt: true },
    });

    const agingRanges = {
      '0-7 days': 0,
      '8-14 days': 0,
      '15-30 days': 0,
      '30+ days': 0,
    };

    agingRequests.forEach((req) => {
      const daysPending = Math.floor(
        (now.getTime() - req.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysPending <= 7) agingRanges['0-7 days']++;
      else if (daysPending <= 14) agingRanges['8-14 days']++;
      else if (daysPending <= 30) agingRanges['15-30 days']++;
      else agingRanges['30+ days']++;
    });

    return {
      backlogCount,
      agingRequests: Object.entries(agingRanges).map(([range, count]) => ({
        ageRange: range,
        count,
      })),
    };
  }
  /**
   * Clean technician name - extract first name from combined entries
   */
  private cleanTechnicianName(name: string): string | null {
    if (!name) return null;

    let cleaned = name.trim();

    // Split by delimiters and take first name
    const delimiters = ['/', '&', ',', '\n', '(', ' AND ', ' and '];
    for (const delimiter of delimiters) {
      if (cleaned.includes(delimiter)) {
        cleaned = cleaned.split(delimiter)[0].trim();
        break;
      }
    }

    return cleaned.toUpperCase();
  }

  /**
   * Clean phone number - extract 10 digits
   */
  private cleanPhone(phone: any): string | null {
    if (!phone) return null;

    // Convert to string and remove all non-digits
    const phoneStr = phone.toString().replace(/\D/g, '');

    // Take last 10 digits for Indian phone numbers
    if (phoneStr.length >= 10) {
      return phoneStr.slice(-10);
    }

    return phoneStr.length === 10 ? phoneStr : null;
  }

  /**
   * Parse installation date from Excel
   */
  private parseInstallationDate(dateValue: any): Date | null {
    if (!dateValue) return null;

    try {
      // Excel stores dates as numbers (days since 1900-01-01)
      if (typeof dateValue === 'number') {
        const excelEpoch = new Date(1900, 0, 1);
        const date = new Date(
          excelEpoch.getTime() + (dateValue - 2) * 24 * 60 * 60 * 1000,
        );
        return date;
      }

      // Try parsing string dates
      const parsed = new Date(dateValue);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }

  /**
   * Main import function - FIXED VERSION
   */
  // ============================================
  // UPDATED IMPORT SERVICE WITH CATEGORY DETECTION
  // service-requests.service.ts
  // ============================================

  /**
   * Detect product category based on product name keywords
   */
  private detectProductCategory(productName: string): string {
    if (!productName) return 'RO+UF'; // Default

    const productUpper = productName.toUpperCase().trim();

    // Category detection rules (order matters - check most specific first)

    // VESSEL - Contains size specifications
    if (
      productUpper.includes('VESSEL') ||
      productUpper.includes('VESAL') ||
      productUpper.includes('1354') ||
      productUpper.includes('1465') ||
      productUpper.includes('16*65') ||
      productUpper.includes('21*62') ||
      productUpper.includes('13*54') ||
      productUpper.includes('14*65') ||
      productUpper.includes('12*48')
    ) {
      return 'VESSEL';
    }

    // COMMERCIAL - Contains LPH (Liters Per Hour)
    if (
      productUpper.includes('COMMERCIAL') ||
      productUpper.includes('LPH') ||
      productUpper.includes('25LPH') ||
      productUpper.includes('50LPH') ||
      productUpper.includes('100LPH')
    ) {
      return 'COMMERCIAL';
    }

    // UNDERSINK
    if (
      productUpper.includes('UNDER SINK') ||
      productUpper.includes('UNDERSINK') ||
      productUpper.includes('SINGLE MEMBRANE') ||
      productUpper.includes('DOUBLE MEMBRANE')
    ) {
      return 'UNDERSINK';
    }

    // UV - Beta series
    if (productUpper.includes('BETA') || productUpper.includes('BETE')) {
      return 'UV';
    }

    // UV+UF - Zeta Gold
    if (productUpper.includes('ZETA GOLD')) {
      return 'UV+UF';
    }

    // RO - Zeta Plus
    if (productUpper.includes('ZETA PLUS') || productUpper.includes('ZETA+')) {
      return 'RO';
    }

    // RO+UV+UF - Alpha Gold
    if (productUpper.includes('ALPHA GOLD')) {
      return 'RO+UV+UF';
    }

    // RO+UV+ALKALINE+MINERALS - Planet Gold, Alfa Plus
    if (
      productUpper.includes('PLANET GOLD') ||
      productUpper.includes('ALFA PLUS')
    ) {
      return 'RO+UV+ALKALINE+MINERALS';
    }

    // RO+UF - Alpha, Planet (not Gold), Planet Plus
    if (
      productUpper.includes('ALPHA') ||
      productUpper.includes('PLANET PLUS') ||
      (productUpper.includes('PLANET') && !productUpper.includes('GOLD'))
    ) {
      return 'RO+UF';
    }

    // Default fallback
    return 'RO+UF';
  }

  /**
   * Create or get product categories based on predefined list
   */
  private async ensureProductCategories(): Promise<Map<string, string>> {
    const categoryMap = new Map<string, string>();

    const categories = [
      { name: 'UV', description: 'Ultraviolet water purifiers' },
      { name: 'UV+UF', description: 'UV with Ultrafiltration' },
      { name: 'RO', description: 'Reverse Osmosis purifiers' },
      { name: 'RO+UF', description: 'RO with Ultrafiltration' },
      { name: 'RO+UV+UF', description: 'RO with UV and UF' },
      {
        name: 'RO+UV+ALKALINE+MINERALS',
        description: 'Advanced RO with minerals',
      },
      { name: 'UNDERSINK', description: 'Under-sink water purifiers' },
      { name: 'COMMERCIAL', description: 'Commercial/Industrial systems' },
      { name: 'VESSEL', description: 'Water softener vessels' },
    ];

    for (const cat of categories) {
      const category = await this.prisma.productCategory.upsert({
        where: { name: cat.name },
        update: {},
        create: {
          name: cat.name,
          description: cat.description,
          isActive: true,
        },
      });

      categoryMap.set(cat.name, category.id);
    }

    console.log(`✅ Ensured ${categories.length} product categories exist`);
    return categoryMap;
  }

  /**
   * Main import function - UPDATED WITH CATEGORY DETECTION
   */
  async importInstallationData(
    file: Express.Multer.File,
    uploadedBy: string,
  ): Promise<{
    success: boolean;
    summary: {
      regions: number;
      technicians: number;
      products: number;
      customers: number;
      installations: number;
      serviceRequests: number;
    };
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      console.log('📊 Starting Excel import...');

      // 1. Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      });

      if (rawData.length < 2) {
        throw new BadRequestException('Excel file is empty or has no data');
      }

      const headerRow = rawData[1];
      const dataRows = rawData.slice(2);

      console.log(`Found headers: ${headerRow.slice(0, 5).join(', ')}...`);
      console.log(`Processing ${dataRows.length} data rows...`);

      // Map headers to indices
      const colIndex = {
        name: headerRow.indexOf('NAME'),
        place: headerRow.indexOf('PLACE'),
        landmark: headerRow.indexOf('LAND MARK'),
        city: headerRow.indexOf('CITY'),
        primaryPhone: headerRow.indexOf('PRIMARY PHONE NUMBER'),
        additionalPhone: headerRow.indexOf('ADDITIONAL PHONE NUMBER'),
        district: headerRow.indexOf('DISTRICT'),
        taluk: headerRow.indexOf('TALUK'),
        productName: headerRow.indexOf('PRODUCT NAME'),
        technician: headerRow.indexOf('TECHNICIAN'),
        installationDate: headerRow.indexOf('INSTALLATION DATE'),
      };

      if (
        colIndex.name === -1 ||
        colIndex.primaryPhone === -1 ||
        colIndex.district === -1
      ) {
        throw new BadRequestException(
          'Required columns missing: NAME, PRIMARY PHONE NUMBER, or DISTRICT',
        );
      }

      console.log('Column mapping successful ✓');

      // 2. ✅ NEW: Ensure all product categories exist
      const categoryIdMap = await this.ensureProductCategories();

      // 3. Get technician role
      const technicianRole = await this.prisma.role.findFirst({
        where: { name: 'Technician' },
      });

      if (!technicianRole) {
        throw new BadRequestException('Technician role not found in system');
      }

      // 4. Get admin user for service requests
      const adminUser = await this.prisma.user.findUnique({
        where: { id: uploadedBy },
      });

      if (!adminUser) {
        throw new BadRequestException('Admin user not found');
      }

      // Maps to track created entities
      const regionMap = new Map<string, string>();
      const technicianMap = new Map<string, string>();
      const productMap = new Map<string, string>();
      const processedPhones = new Set<string>();

      const skipTechnicians = [
        'DISTRIBUTER',
        'FREELANSER',
        'HIMALAYA WATER TECHNOLOGY',
        'KEMTECH',
        'AKHIL LATHEEF',
        'IRSHAD LATHEEF',
        'LATHEEF AKHIL',
        'LATHEEF IRSHAD',
        'AKHIL IRSHAD',
      ];

      let stats = {
        regions: 0,
        technicians: 0,
        products: 0,
        customers: 0,
        installations: 0,
        serviceRequests: 0,
      };

      // 5. Process each data row
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];

        try {
          const customerName = row[colIndex.name]?.toString().trim();
          const place = row[colIndex.place]?.toString().trim();
          const district = row[colIndex.district]?.toString().trim();
          const taluk = row[colIndex.taluk]?.toString().trim();
          const city = row[colIndex.city]?.toString().trim();
          const landmark = row[colIndex.landmark]?.toString().trim();
          const primaryPhone = this.cleanPhone(row[colIndex.primaryPhone]);
          const additionalPhone = this.cleanPhone(
            row[colIndex.additionalPhone],
          );
          const productName = row[colIndex.productName]?.toString().trim();
          const technicianName = row[colIndex.technician]?.toString().trim();
          const installationDate = this.parseInstallationDate(
            row[colIndex.installationDate],
          );

          // Skip if essential data missing
          if (!customerName || !primaryPhone || !district) {
            errors.push(
              `Row ${i + 3}: Missing essential data (name/phone/district)`,
            );
            continue;
          }

          // Skip duplicate customers
          if (processedPhones.has(primaryPhone)) {
            continue;
          }
          processedPhones.add(primaryPhone);

          // ==================================================
          // A. CREATE/GET REGION
          // ==================================================
          const regionKey = `Kerala|${district}|${taluk || 'NULL'}|${city || 'NULL'}`;
          let regionId = regionMap.get(regionKey);

          if (!regionId) {
            const regionName = taluk ? `${district} - ${taluk}` : district;

            const region = await this.prisma.region.upsert({
              where: { name: regionName },
              update: {},
              create: {
                name: regionName,
                state: 'Kerala',
                district: district,
                taluk: taluk || null,
                city: city || null,
                pincode: null,
              },
            });

            regionId = region.id;
            regionMap.set(regionKey, regionId);
            stats.regions++;

            if (stats.regions % 10 === 0) {
              console.log(`  📍 Created ${stats.regions} regions...`);
            }
          }

          // ==================================================
          // B. CREATE/GET TECHNICIAN
          // ==================================================
          let technicianId: any = null;

          if (technicianName) {
            const cleanedTechName = this.cleanTechnicianName(technicianName);

            if (cleanedTechName && !skipTechnicians.includes(cleanedTechName)) {
              technicianId = technicianMap.get(cleanedTechName);

              if (!technicianId) {
                const techEmail = `${cleanedTechName.toLowerCase().replace(/\s+/g, '.')}@waterfilter.com`;

                const existingTech = await this.prisma.user.findUnique({
                  where: { email: techEmail },
                });

                if (existingTech) {
                  technicianId = existingTech.id;
                } else {
                  const hashedPassword = await bcrypt.hash('technician123', 10);

                  const displayName = cleanedTechName
                    .split(' ')
                    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
                    .join(' ');

                  const newTech = await this.prisma.user.create({
                    data: {
                      name: displayName,
                      email: techEmail,
                      password: hashedPassword,
                      roleId: technicianRole.id,
                      status: 'BLOCKED',
                      isExternal: false,
                    },
                  });

                  technicianId = newTech.id;
                  stats.technicians++;

                  if (stats.technicians % 5 === 0) {
                    console.log(
                      `  🔧 Created ${stats.technicians} technicians...`,
                    );
                  }
                }

                technicianMap.set(cleanedTechName, technicianId);
              }
            }
          }

          // ==================================================
          // C. ✅ NEW: CREATE/GET PRODUCT WITH CATEGORY DETECTION
          // ==================================================
          let productCategoryId: any = null;

          if (productName) {
            let productId = productMap.get(productName);

            if (!productId) {
              const existingProduct = await this.prisma.product.findUnique({
                where: { name: productName },
              });

              if (existingProduct) {
                productId = existingProduct.id;
                productCategoryId = existingProduct.categoryId;
              } else {
                // ✅ Detect category based on product name
                const detectedCategory =
                  this.detectProductCategory(productName);
                const categoryId = categoryIdMap.get(detectedCategory);

                const newProduct = await this.prisma.product.create({
                  data: {
                    name: productName,
                    description: 'Imported from Excel',
                    categoryId: categoryId,
                    price: 0,
                    stock: 0,
                    hasWarranty: false,
                  },
                });

                productId = newProduct.id;
                productCategoryId = categoryId;
                stats.products++;

                if (stats.products % 20 === 0) {
                  console.log(`  📦 Created ${stats.products} products...`);
                }
              }

              productMap.set(productName, productId);
            }
          }

          // ==================================================
          // D. CREATE CUSTOMER
          // ==================================================
          const phoneNumbers =
            additionalPhone && additionalPhone !== primaryPhone
              ? [additionalPhone]
              : [];

          const customer = await this.prisma.customer.upsert({
            where: { primaryPhone: primaryPhone },
            update: {},
            create: {
              name: customerName,
              address: place || 'N/A',
              primaryPhone: primaryPhone,
              phoneNumbers: phoneNumbers,
              email: null,
              regionId: regionId,
            },
          });
          stats.customers++;

          // ==================================================
          // E. CREATE INSTALLATION
          // ==================================================
          const installation = await this.prisma.installation.create({
            data: {
              customerId: customer.id,
              regionId: regionId,
              name: `Installation at ${place || customerName}`.substring(
                0,
                100,
              ),
              address: place || 'N/A',
              landmark: landmark || null,
              contactPerson: customerName,
              contactPhone: primaryPhone,
              installationType: 'Standard',
              isActive: true,
              isPrimary: true,
            },
          });
          stats.installations++;

          // ==================================================
          // F. CREATE SERVICE REQUEST
          // ==================================================
          await this.prisma.serviceRequest.create({
            data: {
              type: 'INSTALLATION',
              status: 'COMPLETED',
              priority: 'NORMAL',
              description: `Installation of ${productName || 'Water Filter'}`,
              requestedById: adminUser.id,
              assignedToId: technicianId,
              regionId: regionId,
              customerId: customer.id,
              installationId: installation.id,
              categoryId: productCategoryId,
              createdAt: installationDate || new Date(),
            },
          });
          stats.serviceRequests++;

          // Progress logging
          if ((i + 1) % 100 === 0) {
            console.log(`  ✓ Processed ${i + 1}/${dataRows.length} rows...`);
          }
        } catch (rowError) {
          const errorMsg = `Row ${i + 3}: ${rowError.message}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      console.log('\n✅ Import completed successfully!');
      console.log('📊 Final Statistics:');
      console.log(`   - Regions: ${stats.regions}`);
      console.log(`   - Technicians: ${stats.technicians}`);
      console.log(`   - Products: ${stats.products}`);
      console.log(`   - Customers: ${stats.customers}`);
      console.log(`   - Installations: ${stats.installations}`);
      console.log(`   - Service Requests: ${stats.serviceRequests}`);
      console.log(`   - Errors: ${errors.length}`);

      return {
        success: true,
        summary: stats,
        errors: errors,
      };
    } catch (error) {
      console.error('❌ Import failed:', error);
      throw new BadRequestException(`Import failed: ${error.message}`);
    }
  }
  async importProductsData(
    file: Express.Multer.File,
    uploadedBy: string,
  ): Promise<{
    success: boolean;
    summary: {
      categoriesCreated: number;
      productsCreated: number;
      productsUpdated: number;
    };
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      console.log('📦 Starting Product import...');

      // 1. Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Get data as JSON
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new BadRequestException('Excel file is empty');
      }

      console.log(`Processing ${jsonData.length} products...`);

      // 2. Ensure all categories exist
      const categoryMap = new Map<string, string>();
      const categories = [
        { name: 'UV', description: 'Ultraviolet water purifiers' },
        { name: 'UV+UF', description: 'UV with Ultrafiltration' },
        { name: 'RO', description: 'Reverse Osmosis purifiers' },
        { name: 'RO+UF', description: 'RO with Ultrafiltration' },
        { name: 'RO+UV+UF', description: 'RO with UV and UF' },
        {
          name: 'RO+UV+ALKALINE+MINERALS',
          description: 'Advanced RO with minerals',
        },
        { name: 'UNDERSINK', description: 'Under-sink water purifiers' },
        { name: 'COMMERCIAL', description: 'Commercial/Industrial systems' },
        { name: 'VESSEL', description: 'Water softener vessels' },
      ];

      let categoriesCreated = 0;
      for (const cat of categories) {
        const category = await this.prisma.productCategory.upsert({
          where: { name: cat.name },
          update: {},
          create: {
            name: cat.name,
            description: cat.description,
            isActive: true,
          },
        });

        categoryMap.set(cat.name, category.id);

        // Check if it was created (not just retrieved)
        const wasNew = await this.prisma.productCategory.findFirst({
          where: {
            name: cat.name,
            createdAt: {
              gte: new Date(Date.now() - 1000), // Created in last second
            },
          },
        });
        if (wasNew) categoriesCreated++;
      }

      console.log(`✓ Ensured ${categories.length} categories exist`);

      let stats = {
        categoriesCreated: categoriesCreated,
        productsCreated: 0,
        productsUpdated: 0,
      };

      // 3. Process each product
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];

        try {
          // Extract data
          const category = row['CATEGORY']?.toString().trim();
          const modelName = row['MODEL']?.toString().trim();
          const price = row['PRICE INR'] ? parseFloat(row['PRICE INR']) : 0;
          const warranty = row['WARRANTY'] ? parseInt(row['WARRANTY']) : 12;
          const stock = row['STOCK QTY'] ? parseInt(row['STOCK QTY']) : 0;

          // Validation
          if (!category || !modelName) {
            errors.push(`Row ${i + 2}: Missing CATEGORY or MODEL`);
            continue;
          }

          // Get category ID
          const categoryId = categoryMap.get(category);
          if (!categoryId) {
            errors.push(`Row ${i + 2}: Invalid category "${category}"`);
            continue;
          }

          // Check if product exists
          const existingProduct = await this.prisma.product.findUnique({
            where: { name: modelName },
          });

          if (existingProduct) {
            // Update existing product
            await this.prisma.product.update({
              where: { id: existingProduct.id },
              data: {
                categoryId: categoryId,
                price: price || existingProduct.price,
                stock: stock,
                hasWarranty: warranty > 0,
                description: `Warranty: ${warranty} months`,
              },
            });
            stats.productsUpdated++;
          } else {
            // Create new product
            await this.prisma.product.create({
              data: {
                name: modelName,
                description: `Warranty: ${warranty} months`,
                categoryId: categoryId,
                price: price || 0,
                stock: stock,
                hasWarranty: warranty > 0,
              },
            });
            stats.productsCreated++;
          }

          // Progress logging
          if ((i + 1) % 5 === 0) {
            console.log(
              `  ✓ Processed ${i + 1}/${jsonData.length} products...`,
            );
          }
        } catch (rowError) {
          const errorMsg = `Row ${i + 2}: ${rowError.message}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      console.log('\n✅ Product import completed!');
      console.log('📊 Statistics:');
      console.log(`   - Categories created: ${stats.categoriesCreated}`);
      console.log(`   - Products created: ${stats.productsCreated}`);
      console.log(`   - Products updated: ${stats.productsUpdated}`);
      console.log(`   - Errors: ${errors.length}`);

      return {
        success: true,
        summary: stats,
        errors: errors,
      };
    } catch (error) {
      console.error('❌ Product import failed:', error);
      throw new BadRequestException(`Import failed: ${error.message}`);
    }
  }

  async importSparePartsData(
    file: Express.Multer.File,
    uploadedBy: string,
  ): Promise<{
    success: boolean;
    summary: {
      sparePartsCreated: number;
      sparePartsUpdated: number;
    };
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      console.log('🔧 Starting Spare Parts import...');

      // 1. Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Get data as JSON
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new BadRequestException('Excel file is empty');
      }

      console.log(`Processing ${jsonData.length} spare parts...`);

      let stats = {
        sparePartsCreated: 0,
        sparePartsUpdated: 0,
      };

      // 2. Process each spare part
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];

        try {
          // Extract data
          const spareName = row['SPARE NAME']?.toString().trim();
          const price = row['PRICE INR'] ? parseFloat(row['PRICE INR']) : 0;
          const warrantyMonths = row['WARRANTY']
            ? parseInt(row['WARRANTY'])
            : 0;
          const stock = row['STOCK QTY'] ? parseInt(row['STOCK QTY']) : 0;

          // Validation
          if (!spareName) {
            errors.push(`Row ${i + 2}: Missing SPARE NAME`);
            continue;
          }

          // Calculate warranty
          const hasWarranty = warrantyMonths > 0;
          const warrantyYears =
            warrantyMonths >= 12 ? Math.floor(warrantyMonths / 12) : null;

          // Build description with warranty info
          let description = '';
          if (hasWarranty) {
            if (warrantyYears && warrantyYears > 0) {
              description = `Warranty: ${warrantyYears} year${warrantyYears > 1 ? 's' : ''} (${warrantyMonths} months)`;
            } else {
              description = `Warranty: ${warrantyMonths} months`;
            }
          } else {
            description = 'No warranty';
          }

          // Check if spare part exists
          const existingSparePart = await this.prisma.sparePart.findUnique({
            where: { name: spareName },
          });

          if (existingSparePart) {
            // Update existing spare part
            await this.prisma.sparePart.update({
              where: { id: existingSparePart.id },
              data: {
                price: price || existingSparePart.price,
                stock: stock,
                hasWarranty: hasWarranty,
                warrantyMonths: warrantyMonths > 0 ? warrantyMonths : null,
                warrantyYears: warrantyYears,
                description: description,
              },
            });
            stats.sparePartsUpdated++;
          } else {
            // Create new spare part
            await this.prisma.sparePart.create({
              data: {
                name: spareName,
                description: description,
                price: price || 0,
                stock: stock,
                hasWarranty: hasWarranty,
                warrantyMonths: warrantyMonths > 0 ? warrantyMonths : null,
                warrantyYears: warrantyYears,
              },
            });
            stats.sparePartsCreated++;
          }

          // Progress logging
          if ((i + 1) % 10 === 0) {
            console.log(
              `  ✓ Processed ${i + 1}/${jsonData.length} spare parts...`,
            );
          }
        } catch (rowError) {
          const errorMsg = `Row ${i + 2}: ${rowError.message}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      console.log('\n✅ Spare parts import completed!');
      console.log('📊 Statistics:');
      console.log(`   - Spare parts created: ${stats.sparePartsCreated}`);
      console.log(`   - Spare parts updated: ${stats.sparePartsUpdated}`);
      console.log(`   - Errors: ${errors.length}`);

      return {
        success: true,
        summary: stats,
        errors: errors,
      };
    } catch (error) {
      console.error('❌ Spare parts import failed:', error);
      throw new BadRequestException(`Import failed: ${error.message}`);
    }
  }

  private cleanTechnicianPhone(phone: any): string | null {
    if (!phone) return null;

    // Convert to string and remove all non-digits
    const phoneStr = phone.toString().replace(/\D/g, '');

    // Take last 10 digits for Indian phone numbers
    if (phoneStr.length >= 10) {
      return phoneStr.slice(-10);
    }

    return phoneStr.length === 10 ? phoneStr : null;
  }

  /**
   * Clean technician name
   */
  private cleanFreelanceTechnicianName(name: string): string | null {
    if (!name) return null;

    // Basic cleanup
    let cleaned = name.trim();

    // Remove special characters but keep spaces
    cleaned = cleaned.replace(/[^a-zA-Z\s]/g, '');

    // Capitalize first letter of each word
    cleaned = cleaned
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return cleaned;
  }

  /**
   * Import freelance technicians from Excel file
   * Expected columns: full_name, phone_number, city, Experience years, Status, remarks, Area Covered
   */
  async importTechniciansData(
    file: Express.Multer.File,
    uploadedBy: string,
  ): Promise<{
    success: boolean;
    summary: {
      techniciansCreated: number;
      techniciansUpdated: number;
      techniciansSkipped: number;
    };
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      console.log('👷 Starting Freelance Technicians import...');

      // 1. Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Get raw data with headers
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      });

      if (rawData.length < 2) {
        throw new BadRequestException('Excel file is empty or has no data');
      }

      // Row 0 has headers
      const headerRow = rawData[0];
      const dataRows = rawData.slice(1); // Data starts from row 1

      console.log(`Found headers: ${headerRow.slice(0, 5).join(', ')}...`);
      console.log(`Processing ${dataRows.length} technicians...`);

      // Map headers to indices
      const colIndex = {
        fullName: headerRow.indexOf('full_name'),
        phoneNumber: headerRow.indexOf('phone_number'),
        city: headerRow.indexOf('city'),
        experienceYears: headerRow.indexOf('Experience years'),
        status: headerRow.indexOf('Status'),
        remarks: headerRow.indexOf('remarks'),
        areaCovered: headerRow.indexOf('Area Covered'),
        installationCharge: headerRow.indexOf('Installation Charge'),
        serviceCharge: headerRow.indexOf('Service Charge'),
      };

      // Validate required columns
      if (colIndex.fullName === -1 || colIndex.phoneNumber === -1) {
        throw new BadRequestException(
          'Required columns missing: full_name or phone_number',
        );
      }

      console.log('Column mapping successful ✓');

      // 2. Get Technician role
      const technicianRole = await this.prisma.role.findFirst({
        where: { name: 'Technician' },
      });

      if (!technicianRole) {
        throw new BadRequestException('Technician role not found in system');
      }

      let stats = {
        techniciansCreated: 0,
        techniciansUpdated: 0,
        techniciansSkipped: 0,
      };

      // 3. Process each technician
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];

        try {
          // Extract data
          const fullName = row[colIndex.fullName]?.toString().trim();
          const phoneNumber = this.cleanTechnicianPhone(
            row[colIndex.phoneNumber],
          );
          const city = row[colIndex.city]?.toString().trim();
          const experienceYears = row[colIndex.experienceYears];
          const status = row[colIndex.status]?.toString().trim();
          const remarks = row[colIndex.remarks]?.toString().trim();
          const areaCovered = row[colIndex.areaCovered]?.toString().trim();

          // Validation
          if (!fullName || !phoneNumber) {
            errors.push(`Row ${i + 2}: Missing full_name or phone_number`);
            stats.techniciansSkipped++;
            continue;
          }

          const cleanedName = this.cleanFreelanceTechnicianName(fullName);
          if (!cleanedName) {
            errors.push(`Row ${i + 2}: Invalid technician name`);
            stats.techniciansSkipped++;
            continue;
          }

          // Create email from phone number
          const email = `tech${phoneNumber}@freelance.waterfilter.com`;

          // Find or match region based on city
          let regionId: string | null = null;
          if (city) {
            // Try to find region by city name or district
            const region = await this.prisma.region.findFirst({
              where: {
                OR: [
                  { city: { contains: city, mode: 'insensitive' } },
                  { district: { contains: city, mode: 'insensitive' } },
                  { name: { contains: city, mode: 'insensitive' } },
                ],
              },
            });

            if (region) {
              regionId = region.id;
            }
          }

          // Determine user status based on Status column
          let userStatus: 'ACTIVE' | 'BLOCKED' = 'BLOCKED'; // Default to blocked
          if (
            status &&
            (status.toLowerCase().includes('send contract') ||
              status.toLowerCase().includes('details shared'))
          ) {
            userStatus = 'ACTIVE';
          }

          // Build description
          const descriptionParts: string[] = [];
          if (experienceYears) {
            descriptionParts.push(`Experience: ${experienceYears} years`);
          }
          if (areaCovered) {
            descriptionParts.push(`Area: ${areaCovered}`);
          }
          if (remarks) {
            descriptionParts.push(`Notes: ${remarks}`);
          }
          const description = descriptionParts.join(' | ');

          // Check if technician exists by email or phone
          const existingTechnician = await this.prisma.user.findFirst({
            where: {
              OR: [{ email: email }, { phone: phoneNumber }],
            },
          });

          if (existingTechnician) {
            // Update existing technician
            await this.prisma.user.update({
              where: { id: existingTechnician.id },
              data: {
                name: cleanedName,
                phone: phoneNumber,
                regionId: regionId || existingTechnician.regionId,
                status: userStatus,
                isExternal: true,
              },
            });
            stats.techniciansUpdated++;
          } else {
            // Create new technician
            const hashedPassword = await bcrypt.hash('freelance123', 10);

            await this.prisma.user.create({
              data: {
                name: cleanedName,
                email: email,
                password: hashedPassword,
                phone: phoneNumber,
                roleId: technicianRole.id,
                regionId: regionId,
                status: userStatus,
                isExternal: true, // ✅ Mark as external/freelance
                createdById: uploadedBy,
              },
            });
            stats.techniciansCreated++;
          }

          // Progress logging
          if ((i + 1) % 10 === 0) {
            console.log(
              `  ✓ Processed ${i + 1}/${dataRows.length} technicians...`,
            );
          }
        } catch (rowError) {
          const errorMsg = `Row ${i + 2}: ${rowError.message}`;
          errors.push(errorMsg);
          stats.techniciansSkipped++;
          console.error(errorMsg);
        }
      }

      console.log('\n✅ Freelance technicians import completed!');
      console.log('📊 Statistics:');
      console.log(`   - Technicians created: ${stats.techniciansCreated}`);
      console.log(`   - Technicians updated: ${stats.techniciansUpdated}`);
      console.log(`   - Technicians skipped: ${stats.techniciansSkipped}`);
      console.log(`   - Errors: ${errors.length}`);

      return {
        success: true,
        summary: stats,
        errors: errors,
      };
    } catch (error) {
      console.error('❌ Technician import failed:', error);
      throw new BadRequestException(`Import failed: ${error.message}`);
    }
  }

  // ============================================
  // STEP 4: SERVICE REQUESTS IMPORT BACKEND
  // ============================================

  // ADD TO service-requests.service.ts

  /**
   * Clean phone number for matching
   */
  private cleanServicePhone(phone: any): string | null {
    if (!phone) return null;

    // Convert to string and remove all non-digits
    const phoneStr = phone.toString().replace(/\D/g, '');

    // Take last 10 digits for Indian phone numbers
    if (phoneStr.length >= 10) {
      return phoneStr.slice(-10);
    }

    return phoneStr.length === 10 ? phoneStr : null;
  }

  /**
   * Clean technician name - trim and normalize
   */
  // private cleanTechnicianName(name: string): string {
  //   if (!name) return '';
  //   return name.trim().toUpperCase();
  // }

  /**
   * Parse and normalize spare part names
   */
  private parseSparePartNames(spareText: string): string[] {
    if (!spareText) return [];

    // Split by comma or slash
    const parts = spareText.split(/[,\/]/);

    // Clean and normalize each part
    return parts
      .map((p) => p.trim().toUpperCase())
      .filter((p) => p.length > 0)
      .map((p) => {
        // Normalize common variations
        p = p.replace(/\s+/g, ' '); // Single spaces
        p = p.replace(/SPUN\s*3/i, 'SPUN 3');
        p = p.replace(/SPUN\s*1/i, 'SPUN 1');
        return p;
      });
  }

  /**
   * Import service requests from Excel file
   */
  async importServiceRequestsData(
    file: Express.Multer.File,
    uploadedBy: string,
  ): Promise<{
    success: boolean;
    summary: {
      serviceRequestsCreated: number;
      serviceRequestsSkipped: number;
      customersCreated: number;
      usedProductsLinked: number;
      workLogsCreated: number;
    };
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      console.log('🔧 Starting Service Requests import...');

      // 1. Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new BadRequestException('Excel file is empty');
      }

      console.log(`Processing ${jsonData.length} service requests...`);

      let stats = {
        serviceRequestsCreated: 0,
        serviceRequestsSkipped: 0,
        customersCreated: 0,
        usedProductsLinked: 0,
        workLogsCreated: 0,
      };

      // 2. Get system user for requestedBy
      const systemUser = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: uploadedBy }, { role: { name: 'Super Admin' } }],
        },
      });

      if (!systemUser) {
        throw new BadRequestException('System user not found');
      }

      // 3. Cache all technicians for matching
      const allTechnicians = await this.prisma.user.findMany({
        where: {
          role: { name: 'Technician' },
        },
      });

      const technicianMap = new Map<string, string>();
      allTechnicians.forEach((tech) => {
        const cleanName = this.cleanTechnicianName(tech.name);
        if (cleanName) {
          technicianMap.set(cleanName, tech.id);
        }
      });

      console.log(`✓ Loaded ${technicianMap.size} technicians for matching`);

      // 4. Cache all regions
      const allRegions = await this.prisma.region.findMany();
      console.log(`✓ Loaded ${allRegions.length} regions`);

      // 5. Cache all spare parts for matching
      const allSpareParts = await this.prisma.sparePart.findMany();
      const sparePartMap = new Map<string, string>();
      allSpareParts.forEach((spare) => {
        const cleanName = spare.name.trim().toUpperCase();
        sparePartMap.set(cleanName, spare.id);
      });

      console.log(`✓ Loaded ${sparePartMap.size} spare parts for matching`);

      // 6. Process each service request
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];

        try {
          // Extract data
          const phoneNumber = this.cleanServicePhone(row['PHONE NUMBER']);
          const customerName = row['NAME & ADRESS']?.toString().trim();
          const place = row['PLACE']?.toString().trim();
          const technicianName = this.cleanTechnicianName(row['TECHNICIAN']);
          const serviceDate = row['SERVICE BOOKING DATE'];
          const callAttendDate = row['CALL ATTAND DATE'];
          const usedSpares = row['USED SPAIR']?.toString().trim();
          const warrantyStatus = row['WARRANTY IN/OUT']?.toString().trim();
          const amount = row['AMOUNT'];
          const remarks = row['REMARKS']?.toString().trim();
          const feedback = row['CUSTOMER FEEDBACK']?.toString().trim();

          // ✅ VALIDATION: Skip if no phone number
          if (!phoneNumber) {
            errors.push(`Row ${i + 2}: Missing phone number - SKIPPED`);
            stats.serviceRequestsSkipped++;
            continue;
          }

          // 7. Find or create customer
          let customer = await this.prisma.customer.findFirst({
            where: { primaryPhone: phoneNumber },
            include: {
              region: true,
              installations: true,
            },
          });

          let customerId: string;
          let regionId: string;
          let installationId: string | null = null;
          let categoryId: string | null = null;

          if (customer) {
            // ✅ Existing customer - use their data
            customerId = customer.id;
            regionId = customer.regionId;

            // Find most recent installation
            if (customer.installations && customer.installations.length > 0) {
              const latestInstallation = customer.installations.sort(
                (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
              )[0];
              installationId = latestInstallation.id;

              // Get categoryId from previous service requests for this installation
              const existingServiceRequest =
                await this.prisma.serviceRequest.findFirst({
                  where: { installationId: latestInstallation.id },
                  orderBy: { createdAt: 'desc' },
                });

              if (existingServiceRequest && existingServiceRequest.categoryId) {
                categoryId = existingServiceRequest.categoryId;
              }
            }
          } else {
            // ✅ New customer - create with region matching
            stats.customersCreated++;

            // Try to find region from place
            let matchedRegion = allRegions.find(
              (r) =>
                r.city?.toLowerCase().includes(place?.toLowerCase()) ||
                r.district?.toLowerCase().includes(place?.toLowerCase()) ||
                r.name?.toLowerCase().includes(place?.toLowerCase()),
            );

            if (!matchedRegion) {
              // Use first region as default if no match
              matchedRegion = allRegions[0];
              errors.push(
                `Row ${i + 2}: Could not match place "${place}" to region, using default`,
              );
            }

            regionId = matchedRegion.id;

            // Create new customer
            const newCustomer = await this.prisma.customer.create({
              data: {
                name: customerName || 'Unknown Customer',
                primaryPhone: phoneNumber,
                address: place || '',
                regionId: regionId,
              },
            });

            customerId = newCustomer.id;
          }

          // 8. Find technician
          let assignedToId: string | null = null;
          if (technicianName) {
            assignedToId = technicianMap.get(technicianName) || null;
            if (!assignedToId) {
              errors.push(
                `Row ${i + 2}: Technician "${technicianName}" not found`,
              );
            }
          }

          // 9. Build description
          const descriptionParts: string[] = [];
          if (remarks) descriptionParts.push(`Remarks: ${remarks}`);
          if (feedback) descriptionParts.push(`Feedback: ${feedback}`);
          if (warrantyStatus)
            descriptionParts.push(`Warranty: ${warrantyStatus}`);
          if (amount) descriptionParts.push(`Amount: ₹${amount}`);

          const description =
            descriptionParts.length > 0
              ? descriptionParts.join(' | ')
              : 'Historical service import';

          // 10. Create service request
          const serviceRequest = await this.prisma.serviceRequest.create({
            data: {
              type: 'SERVICE',
              description: description,
              status: 'COMPLETED',
              priority: 'NORMAL',
              salesApproved: true,
              requestedById: systemUser.id,
              assignedToId: assignedToId,
              regionId: regionId,
              customerId: customerId,
              installationId: installationId,
              categoryId: categoryId,
              createdAt: serviceDate ? new Date(serviceDate) : new Date(),
            },
          });

          stats.serviceRequestsCreated++;

          // ✅ FIXED: WorkLog schema has startTime/endTime (not action/timestamp)
          // 11. Create work log if call attend date exists
          if (callAttendDate && assignedToId) {
            const serviceDateTime = new Date(serviceDate || new Date());
            const attendDateTime = new Date(callAttendDate);

            // Calculate duration in minutes
            const durationMinutes = Math.round(
              (attendDateTime.getTime() - serviceDateTime.getTime()) /
              (1000 * 60),
            );

            // Create single work log entry with start and end time
            await this.prisma.workLog.create({
              data: {
                requestId: serviceRequest.id,
                technicianId: assignedToId,
                startTime: serviceDateTime,
                endTime: attendDateTime,
                duration: durationMinutes > 0 ? durationMinutes : null,
                notes: 'Historical service import',
              },
            });

            stats.workLogsCreated += 1;
          }

          // ✅ FIXED: ServiceUsedProduct has no 'type' field
          // 12. Link used spare parts
          if (usedSpares) {
            const spareNames = this.parseSparePartNames(usedSpares);

            for (const spareName of spareNames) {
              // Try exact match first
              let sparePartId = sparePartMap.get(spareName);

              // Try fuzzy match if exact fails
              if (!sparePartId) {
                const fuzzyMatch = allSpareParts.find(
                  (sp) =>
                    sp.name.toUpperCase().includes(spareName) ||
                    spareName.includes(sp.name.toUpperCase()),
                );
                if (fuzzyMatch) {
                  sparePartId = fuzzyMatch.id;
                }
              }

              if (sparePartId) {
                await this.prisma.serviceUsedProduct.create({
                  data: {
                    requestId: serviceRequest.id,
                    sparePartId: sparePartId, // Set spare part
                    productId: null, // Not a product
                    quantityUsed: 1,
                    confirmedBy: systemUser.id,
                    confirmedAt: new Date(),
                  },
                });
                stats.usedProductsLinked++;
              } else {
                errors.push(
                  `Row ${i + 2}: Spare part "${spareName}" not found in system`,
                );
              }
            }
          }

          // Progress logging
          if ((i + 1) % 50 === 0) {
            console.log(
              `  ✓ Processed ${i + 1}/${jsonData.length} service requests...`,
            );
          }
        } catch (rowError) {
          const errorMsg = `Row ${i + 2}: ${rowError.message}`;
          errors.push(errorMsg);
          stats.serviceRequestsSkipped++;
          console.error(errorMsg);
        }
      }

      console.log('\n✅ Service requests import completed!');
      console.log('📊 Statistics:');
      console.log(
        `   - Service requests created: ${stats.serviceRequestsCreated}`,
      );
      console.log(
        `   - Service requests skipped: ${stats.serviceRequestsSkipped}`,
      );
      console.log(`   - New customers created: ${stats.customersCreated}`);
      console.log(`   - Used products linked: ${stats.usedProductsLinked}`);
      console.log(`   - Work logs created: ${stats.workLogsCreated}`);
      console.log(`   - Errors: ${errors.length}`);

      return {
        success: true,
        summary: stats,
        errors: errors,
      };
    } catch (error) {
      console.error('❌ Service requests import failed:', error);
      throw new BadRequestException(`Import failed: ${error.message}`);
    }
  }
}
