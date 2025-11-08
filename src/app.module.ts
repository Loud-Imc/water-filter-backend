import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { ServiceRequestsModule } from './service-requests/service-requests.module';
import { CustomersModule } from './customers/customers.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UploadsModule } from './uploads/uploads.module';
import { PrismaModule } from './prisma/prisma.module';
import { RegionModule } from './regions/regions.module';
import { TechnicianWorkflowModule } from './technician-workflow/technician-workflow.module';
import { TechniciansModule } from './technicians/technicians.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    // ✅ Add ServeStaticModule at the top
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    AuthModule,
    UsersModule,
    RolesModule,
    ServiceRequestsModule,
    CustomersModule,
    NotificationsModule,
    UploadsModule,
    PrismaModule,
    RegionModule,
    TechnicianWorkflowModule,
    TechniciansModule,
    ProductsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
