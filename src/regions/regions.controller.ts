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
import { RegionsService } from './regions.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { IndiaPlacesHelper } from './india-places.helper';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('regions')
export class RegionsController {
  constructor(private regionsService: RegionsService) {}

  // ✅ Get all saved regions (from database)
  @Get()
  findAll() {
    return this.regionsService.findAll();
  }

  // ✅ Search saved regions
  @Get('search')
  searchRegions(
    @Query('query') query: string,
    @Query('limit') limit: string = '20',
  ) {
    return this.regionsService.searchRegions(query, parseInt(limit));
  }

  // ✅ NEW: Get Indian states (for dropdown)
  @Get('india-places/states')
  getStates() {
    return IndiaPlacesHelper.getStates();
  }

  // ✅ NEW: Get districts of a state (for dropdown)
  @Get('india-places/districts/:state')
  getDistricts(@Param('state') state: string) {
    return IndiaPlacesHelper.getDistricts(state);
  }

  // // ✅ NEW: Get cities of a district (for dropdown)
  // @Get('india-places/cities/:state/:district')
  // getCities(
  //   @Param('state') state: string,
  //   @Param('district') district: string,
  // ) {
  //   return IndiaPlacesHelper.getCities(state, district);
  // }

  // // ✅ NEW: Search by pincode
  // @Get('india-places/pincode/:pincode')
  // getByPincode(@Param('pincode') pincode: string) {
  //   return IndiaPlacesHelper.getLocationByPincode(pincode);
  // }

  // ✅ Get single saved region
  @Get(':id')
  @RequirePermissions('regions.view')
  findOne(@Param('id') id: string) {
    return this.regionsService.findOne(id);
  }

  // ✅ Create new region
  @Post()
  @RequirePermissions('regions.create')
  create(@Body() body: CreateRegionDto) {
    return this.regionsService.create(body);
  }

  // ✅ Update region
  @Put(':id')
  @RequirePermissions('regions.create')
  update(@Param('id') id: string, @Body() body: UpdateRegionDto) {
    return this.regionsService.update(id, body);
  }

  // ✅ Delete region
  @Delete(':id')
  @RequirePermissions('regions.create')
  remove(@Param('id') id: string) {
    return this.regionsService.remove(id);
  }
}
