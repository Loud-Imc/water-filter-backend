import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { RegionsService } from './regions.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('regions')
export class RegionsController {
  constructor(private regionsService: RegionsService) {}

  @Get()
  @Roles('Super Admin', 'Service Admin')
  findAll() {
    return this.regionsService.findAll();
  }

  @Get(':id')
  @Roles('Super Admin', 'Service Admin')
  findOne(@Param('id') id: string) {
    return this.regionsService.findOne(id);
  }

  @Post()
  @Roles('Super Admin', 'Service Admin')
  create(@Body() body: CreateRegionDto) {
    return this.regionsService.create(body);
  }

  @Put(':id')
  @Roles('Super Admin', 'Service Admin')
  update(@Param('id') id: string, @Body() body: UpdateRegionDto) {
    return this.regionsService.update(id, body);
  }

  @Delete(':id')
  @Roles('Super Admin')
  remove(@Param('id') id: string) {
    return this.regionsService.remove(id);
  }
}
