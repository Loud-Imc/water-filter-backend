import { Module } from '@nestjs/common';
import { SparePartGroupsController } from './spare-part-groups.controller';
import { SparePartGroupsService } from './spare-part-groups.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SparePartGroupsController],
  providers: [SparePartGroupsService, PrismaService],
  exports: [SparePartGroupsService],
})
export class SparePartGroupsModule {}
