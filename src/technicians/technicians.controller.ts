import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { TechniciansService } from './technicians.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequirePermissions } from 'src/auth/permissions.decorator';

// ✅ Technician-only endpoints - keep role-based
// These are personal endpoints (user can only see their own data)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('technicians')
export class TechniciansController {
  constructor(private techniciansService: TechniciansService) {}

  // Get technician's own tasks
  @Get('my-tasks')
  @Roles('Technician')
  getMyTasks(@Req() req) {
    return this.techniciansService.getMyTasks(req.user.userId);
  }

  // Get technician's task history
  @Get('task-history')
  @Roles('Technician')
  getTaskHistory(@Req() req) {
    return this.techniciansService.getTaskHistory(req.user.userId);
  }

  // Get specific task details
  @Get('tasks/:id')
  @Roles('Technician')
  getTaskDetails(@Req() req, @Param('id') requestId: string) {
    return this.techniciansService.getTaskDetails(req.user.userId, requestId);
  }

  // Get technician's stats
  @Get('my-stats')
  @Roles('Technician')
  getMyStats(@Req() req) {
    return this.techniciansService.getMyStats(req.user.userId);
  }

  // Get current technician's stock
  @Get('my-stock')
  @Roles('Technician')
  getMyStock(@Req() req) {
    return this.techniciansService.getTechnicianStock(req.user.userId);
  }

  // Get technician's own stock history
  @Get('my-stock-history')
  @Roles('Technician')
  getMyStockHistory(@Req() req) {
    return this.techniciansService.getTechnicianStockHistory(req.user.userId);
  }

  // Get specific technician's stock history (admin only)
  @Get('stock-transactions')
  @RequirePermissions('stock.view')
  getAllStockTransactions() {
    return this.techniciansService.getAllStockTransactions();
  }

  // Get current stock levels for all technicians (admin only)
  @Get('all-stocks')
  @RequirePermissions('stock.view')
  getAllTechnicianStocks() {
    return this.techniciansService.getAllTechnicianStocks();
  }

  // Get specific technician's stock history (admin only)
  @Get(':technicianId/stock-history')
  @RequirePermissions('stock.view')
  getTechnicianStockHistory(@Param('technicianId') technicianId: string) {
    return this.techniciansService.getTechnicianStockHistory(technicianId);
  }

  // Get specific technician's stock (admin only)
  @Get(':technicianId')
  @RequirePermissions('technician-stock.view')
  getTechnicianStock(@Param('technicianId') technicianId: string) {
    return this.techniciansService.getTechnicianStock(technicianId);
  }
}
