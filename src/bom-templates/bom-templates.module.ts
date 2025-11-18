import { Module } from '@nestjs/common';
import { BOMTemplatesController } from './bom-templates.controller';
import { BOMTemplatesService } from './bom-templates.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BOMTemplatesController],
  providers: [BOMTemplatesService, PrismaService],
  exports: [BOMTemplatesService],
})
export class BOMTemplatesModule {}
