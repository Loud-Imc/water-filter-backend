import { Module } from '@nestjs/common';
import { ProductCategoriesController } from './product-categories.controller';
import { ProductCategoriesService } from './product-categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ProductCategoriesController],
  providers: [ProductCategoriesService, PrismaService],
  exports: [ProductCategoriesService],
})
export class ProductCategoriesModule {}
