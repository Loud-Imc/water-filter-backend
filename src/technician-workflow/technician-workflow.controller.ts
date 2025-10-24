import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { TechnicianWorkflowService } from './technician-workflow.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StartWorkDto } from './dto/start-work.dto';
import { StopWorkDto } from './dto/stop-work.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('technician-workflow')
export class TechnicianWorkflowController {
  constructor(private workflowService: TechnicianWorkflowService) {}

  @Post('start')
  @Roles('Technician')
  startWork(@Req() req, @Body() dto: StartWorkDto) {
    return this.workflowService.startWork(req.user.userId, dto);
  }

  @Post('stop')
  @Roles('Technician')
  stopWork(@Req() req, @Body() dto: StopWorkDto) {
    return this.workflowService.stopWork(req.user.userId, dto);
  }
}
