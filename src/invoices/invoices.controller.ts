import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @RequirePermissions('stock.update')
  create(@Body() body: CreateInvoiceDto, @Req() req) {
    return this.invoicesService.create(body, req.user.userId);
  }

  @Get()
  @RequirePermissions('stock.view')
  findAll(@Query() query: InvoiceQueryDto) {
    return this.invoicesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('stock.view')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post('from-service-request/:id')
  @RequirePermissions('stock.update')
  generateFromServiceRequest(@Param('id') id: string, @Req() req) {
    return this.invoicesService.generateFromServiceRequest(id, req.user.userId);
  }
}
