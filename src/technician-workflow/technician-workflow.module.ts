import { Module } from '@nestjs/common';
import { TechnicianWorkflowService } from './technician-workflow.service';
import { TechnicianWorkflowController } from './technician-workflow.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [TechnicianWorkflowController],
  providers: [TechnicianWorkflowService, PrismaService],
})
export class TechnicianWorkflowModule {}
