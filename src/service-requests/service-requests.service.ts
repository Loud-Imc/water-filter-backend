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
      orderBy: { createdAt: 'desc' },
    });
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

    if (
      ![
        'Super Admin',
        'Service Admin',
        'Service Manager',
        'Service Team Lead',
      ].includes(reassigner.role.name)
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

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

    const existingProducts = await this.prisma.serviceUsedProduct.findMany({
      where: { requestId },
    });
    if (existingProducts.length > 0)
      throw new BadRequestException(
        'Used products already added; editing disallowed.',
      );

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
    console.log('create service dto :', dto);
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
}
