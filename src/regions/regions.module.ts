import { Module } from '@nestjs/common';
import { RegionsController } from './regions.controller';
import { RegionsService } from './regions.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [RegionsController],
  providers: [RegionsService, PrismaService],
})
export class RegionModule {}
