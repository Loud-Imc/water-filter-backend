import { Module } from '@nestjs/common';
import { ServiceRequestsService } from './service-requests.service';
import { ServiceRequestsController } from './service-requests.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Module({
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService, PrismaService, NotificationsService],
})
export class ServiceRequestsModule {}
