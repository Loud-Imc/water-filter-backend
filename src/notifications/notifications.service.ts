import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async createNotification(
    fromUserId: string,
    toUserId: string,
    message: string,
  ) {
    return this.prisma.notification.create({
      data: {
        fromUserId,
        toUserId,
        message,
        status: 'sent',
      },
    });
  }

  async getNotificationsForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { toUserId: userId },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: 'read' },
    });
  }

  async markAsDelivered(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: 'delivered' },
    });
  }

  async markMultipleAsRead(userId: string, notificationIds: string[]) {
    return this.prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        toUserId: userId,
      },
      data: { status: 'read' },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: {
        toUserId: userId,
        status: { not: 'read' },
      },
    });
  }

  // Auto-notify on service request creation
  async notifyRequestCreated(requestId: string, creatorId: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { requestedBy: { include: { role: true } } },
    });

    if (!request) return; // Exit if request not found

    const creatorRole = request.requestedBy.role.name;
    let targetRoles: string[] = [];

    if (
      ['Salesman', 'Sales Team Lead', 'Sales Manager'].includes(creatorRole)
    ) {
      targetRoles = ['Sales Admin'];
    } else {
      targetRoles = ['Service Admin', 'Super Admin'];
    }

    const admins = await this.prisma.user.findMany({
      where: { role: { name: { in: targetRoles } }, status: 'ACTIVE' },
    });

    const notifications = admins.map((admin) =>
      this.createNotification(
        creatorId,
        admin.id,
        `New service request created: ${request.description.substring(0, 50)}...`,
      ),
    );

    return Promise.all(notifications);
  }

  // Auto-notify on approval
  async notifyRequestApproved(requestId: string, approverId: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { requestedBy: true },
    });

    if (!request) return; // Exit if request not found

    return this.createNotification(
      approverId,
      request.requestedById,
      `Your service request has been approved: ${request.description.substring(0, 50)}...`,
    );
  }

  // Auto-notify on assignment
  async notifyRequestAssigned(requestId: string, technicianId: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { requestedBy: true, customer: true },
    });

    if (!request) return; // Exit if request not found

    return this.createNotification(
      request.requestedById,
      technicianId,
      `You have been assigned to: ${request.customer.name} - ${request.description.substring(0, 40)}...`,
    );
  }

  // Auto-notify on work completion
  async notifyWorkCompleted(requestId: string, technicianId: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { requestedBy: true },
    });

    if (!request) return; // Exit if request not found

    const admins = await this.prisma.user.findMany({
      where: {
        role: {
          name: { in: ['Service Admin', 'Service Manager', 'Super Admin'] },
        },
        status: 'ACTIVE',
      },
    });

    const notifications = admins.map((admin) =>
      this.createNotification(
        technicianId,
        admin.id,
        `Work completed for request: ${request.description.substring(0, 50)}...`,
      ),
    );

    return Promise.all(notifications);
  }
}
