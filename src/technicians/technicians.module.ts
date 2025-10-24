import { Module } from '@nestjs/common';
import { TechniciansService } from './technicians.service';
import { TechniciansController } from './technicians.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [TechniciansController],
  providers: [TechniciansService, PrismaService],
})
export class TechniciansModule {}
