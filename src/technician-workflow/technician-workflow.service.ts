import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartWorkDto } from './dto/start-work.dto';
import { StopWorkDto } from './dto/stop-work.dto';

@Injectable()
export class TechnicianWorkflowService {
  constructor(private prisma: PrismaService) {}

  async startWork(userId: string, dto: StartWorkDto) {
    // Validate request and check technician assignment
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: dto.requestId },
    });

    console.log('request : ', request)
    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (request.assignedToId !== userId) {
      throw new ForbiddenException('Not assigned to you');
    }

    // ✅ ADD: Check if status is ASSIGNED
    if (request.status !== 'ASSIGNED') {
      throw new BadRequestException(
        'Work can only be started on assigned requests',
      );
    }

    // ✅ ADD: Check if work already started
    const existingWorkLog = await this.prisma.workLog.findFirst({
      where: {
        requestId: dto.requestId,
        technicianId: userId,
        endTime: null,
      },
    });

    if (existingWorkLog) {
      throw new BadRequestException('Work already started');
    }

    // Start timer log
    const workLog = await this.prisma.workLog.create({
      data: {
        requestId: dto.requestId,
        technicianId: userId,
        startTime: new Date(),
      },
    });
 
    console.log('dto :', dto.requestId)
    // ✅ ADD: Update ServiceRequest status to IN_PROGRESS
    await this.prisma.serviceRequest.update({
      where: { id: dto.requestId },
      data: { status: 'IN_PROGRESS' },
    });

    return workLog;
  }

  async stopWork(userId: string, dto: StopWorkDto) {
    // Find latest active work log for this request and technician
    const workLog = await this.prisma.workLog.findFirst({
      where: {
        requestId: dto.requestId,
        technicianId: userId,
        endTime: null,
      },
      orderBy: { startTime: 'desc' },
    });

    if (!workLog) {
      throw new NotFoundException('Active work log not found');
    }

    const endTime = new Date();
    if (!workLog.startTime) {
      throw new Error('Work log start time missing');
    }

    const duration = Math.floor(
      (endTime.getTime() - workLog.startTime.getTime()) / 1000,
    );

    // Update work log with end time and duration
    const updatedWorkLog = await this.prisma.workLog.update({
      where: { id: workLog.id },
      data: {
        endTime,
        duration,
        notes: dto.notes, // ✅ ADD: Save notes
      },
    });

    // ✅ ADD: Update ServiceRequest status to WORK_COMPLETED
    await this.prisma.serviceRequest.update({
      where: { id: dto.requestId },
      data: { status: 'WORK_COMPLETED' },
    });

    return updatedWorkLog;
  }
}
