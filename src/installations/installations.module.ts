import { Module } from '@nestjs/common';
import { InstallationsService } from './installations.service';
import { InstallationsController } from './installations.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InstallationsController],
  providers: [InstallationsService, PrismaService],
  exports: [InstallationsService], // Export for use in other modules
})
export class InstallationsModule {}
