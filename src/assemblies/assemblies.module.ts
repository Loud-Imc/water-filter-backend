import { Module } from '@nestjs/common';
import { AssembliesController } from './assemblies.controller';
import { AssembliesService } from './assemblies.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AssembliesController],
  providers: [AssembliesService, PrismaService],
  exports: [AssembliesService],
})
export class AssembliesModule {}
