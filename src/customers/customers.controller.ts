import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get()
  @Roles('Super Admin', 'Service Admin')
  findAll() {
    return this.customersService.findAll();
  }

  @Get(':id')
  @Roles('Super Admin', 'Service Admin', 'Technician')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  @Roles('Super Admin', 'Service Admin')
  create(@Body() body: CreateCustomerDto) {
    return this.customersService.create(body);
  }

  @Put('/update-location/:id')
  @Roles('Super Admin', 'Service Admin', 'Technician')
  updateLocation(@Param('id') id: string, @Body() body: UpdateLocationDto) {
    console.log('dto: location: ', body)
    return this.customersService.update(id, body);
  }

  @Put(':id')
  @Roles('Super Admin', 'Service Admin')
  update(@Param('id') id: string, @Body() body: UpdateCustomerDto) {
    return this.customersService.update(id, body);
  }

  @Delete(':id')
  @Roles('Super Admin')
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }
}
