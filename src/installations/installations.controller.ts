import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { InstallationsService } from './installations.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateInstallationDto } from './dto/create-installation.dto';
import { UpdateInstallationDto } from './dto/update-installation.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('installations')
export class InstallationsController {
  constructor(private installationsService: InstallationsService) {}

  // Get all installations
  @Get()
  @RequirePermissions('installations.view')
  findAll(@Query('isActive') isActive?: string) {
    const activeFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.installationsService.findAll(activeFilter);
  }

  // Search installations
  @Get('search')
  @RequirePermissions('installations.view')
  searchInstallations(
    @Query('query') query: string,
    @Query('customerId') customerId?: string,
    @Query('regionId') regionId?: string,
    @Query('limit') limit: string = '20',
  ) {
    return this.installationsService.searchInstallations(
      query,
      customerId,
      regionId,
      parseInt(limit),
    );
  }

  // Get installations by customer
  @Get('customer/:customerId')
  @RequirePermissions('installations.view')
  getByCustomer(@Param('customerId') customerId: string) {
    return this.installationsService.getByCustomer(customerId);
  }

  // Get installations by region
  @Get('region/:regionId')
  @RequirePermissions('installations.view')
  getByRegion(@Param('regionId') regionId: string) {
    return this.installationsService.getByRegion(regionId);
  }

  // Get installation history (service requests for this installation)
  @Get(':id/history')
  @RequirePermissions('installations.view')
  getInstallationHistory(@Param('id') id: string) {
    return this.installationsService.getInstallationHistory(id);
  }

  // Get single installation
  @Get(':id')
  @RequirePermissions('installations.view')
  findOne(@Param('id') id: string) {
    return this.installationsService.findOne(id);
  }

  // Create installation
  @Post()
  @RequirePermissions('installations.create')
  create(@Body() body: CreateInstallationDto) {
    return this.installationsService.create(body);
  }

  // Update installation
  @Put(':id')
  @RequirePermissions('installations.edit')
  update(@Param('id') id: string, @Body() body: UpdateInstallationDto) {
    return this.installationsService.update(id, body);
  }

  // Delete installation
  @Delete(':id')
  @RequirePermissions('installations.delete')
  remove(@Param('id') id: string) {
    return this.installationsService.remove(id);
  }

  // Deactivate installation (soft delete)
  @Put(':id/deactivate')
  @RequirePermissions('installations.edit')
  deactivate(@Param('id') id: string) {
    return this.installationsService.deactivate(id);
  }

  // Set as primary installation
  @Put(':id/set-primary')
  @RequirePermissions('installations.edit')
  setPrimary(@Param('id') id: string) {
    return this.installationsService.setPrimary(id);
  }
}
