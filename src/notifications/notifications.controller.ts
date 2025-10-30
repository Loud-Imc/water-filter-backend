import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  Patch,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

// ✅ Notifications don't need permission checks
// Users can only access their own notifications
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  // Create notification (internal use or admin)
  @Post()
  async create(
    @Req() req,
    @Body() body: { toUserId: string; message: string },
  ) {
    return this.notificationsService.createNotification(
      req.user.userId,
      body.toUserId,
      body.message,
    );
  }

  // Get user's own notifications
  @Get()
  async getAll(@Req() req) {
    return this.notificationsService.getNotificationsForUser(req.user.userId);
  }

  // Get user's unread count
  @Get('unread-count')
  async getUnreadCount(@Req() req) {
    const count = await this.notificationsService.getUnreadCount(
      req.user.userId,
    );
    return { count };
  }

  // Mark notification as read
  @Post(':id/read')
  async markRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  // Mark notification as delivered
  @Post(':id/delivered')
  async markDelivered(@Param('id') id: string) {
    return this.notificationsService.markAsDelivered(id);
  }

  // Mark multiple as read
  @Patch('mark-multiple-read')
  async markMultipleRead(
    @Req() req,
    @Body() body: { notificationIds: string[] },
  ) {
    return this.notificationsService.markMultipleAsRead(
      req.user.userId,
      body.notificationIds,
    );
  }
}
