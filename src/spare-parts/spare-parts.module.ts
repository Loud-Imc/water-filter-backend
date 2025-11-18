import { Module } from '@nestjs/common';
import { SparePartsController } from './spare-parts.controller';
import { SparePartsService } from './spare-parts.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SparePartsController],
  providers: [SparePartsService, PrismaService],
  exports: [SparePartsService],
})
export class SparePartsModule {}
