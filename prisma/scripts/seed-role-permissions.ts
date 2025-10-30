import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedRolePermissions() {
  try {
    console.log('🌱 Starting role permissions seed...');

    // 1. Super Admin - Full access to everything
    const superAdminRole = await prisma.role.findFirst({
      where: { name: 'Super Admin' },
    });

    if (superAdminRole) {
      await prisma.role.update({
        where: { id: superAdminRole.id },
        data: {
          permissions: {
            permissions: [
              // Users
              'users.view',
              'users.create',
              'users.edit',
              'users.delete',
              // Customers
              'customers.view',
              'customers.create',
              'customers.edit',
              'customers.delete',
              // Services
              'services.view',
              'services.create',
              'services.edit',
              'services.delete',
              'services.approve',
              'services.assign',
              // Regions
              'regions.view',
              'regions.create',
              // Reports
              'reports.view',
              'reports.export',
              // Dashboard
              'dashboard.view',
            ],
          },
        },
      });
      console.log('✅ Super Admin permissions updated');
    }

    // 2. Service Admin
    const serviceAdminRole = await prisma.role.findFirst({
      where: { name: 'Service Admin' },
    });

    if (serviceAdminRole) {
      await prisma.role.update({
        where: { id: serviceAdminRole.id },
        data: {
          permissions: {
            permissions: [
              'users.view',
              'users.create',
              'users.edit',
              'services.view',
              'services.create',
              'services.edit',
              'services.approve',
              'services.assign',
              'customers.view',
              'customers.create',
              'reports.view',
              'dashboard.view',
            ],
          },
        },
      });
      console.log('✅ Service Admin permissions updated');
    }

    // 3. Sales Admin
    const salesAdminRole = await prisma.role.findFirst({
      where: { name: 'Sales Admin' },
    });

    if (salesAdminRole) {
      await prisma.role.update({
        where: { id: salesAdminRole.id },
        data: {
          permissions: {
            permissions: [
              'users.view',
              'users.create',
              'users.edit',
              'customers.view',
              'customers.create',
              'customers.edit',
              'services.view',
              'services.create',
              'reports.view',
              'dashboard.view',
            ],
          },
        },
      });
      console.log('✅ Sales Admin permissions updated');
    }

    // 4. Service Manager
    const serviceManagerRole = await prisma.role.findFirst({
      where: { name: 'Service Manager' },
    });

    if (serviceManagerRole) {
      await prisma.role.update({
        where: { id: serviceManagerRole.id },
        data: {
          permissions: {
            permissions: [
              'users.view',
              'services.view',
              'services.create',
              'services.edit',
              'services.assign',
              'customers.view',
              'reports.view',
              'dashboard.view',
            ],
          },
        },
      });
      console.log('✅ Service Manager permissions updated');
    }

    // 5. Sales Manager
    const salesManagerRole = await prisma.role.findFirst({
      where: { name: 'Sales Manager' },
    });

    if (salesManagerRole) {
      await prisma.role.update({
        where: { id: salesManagerRole.id },
        data: {
          permissions: {
            permissions: [
              'users.view',
              'customers.view',
              'customers.create',
              'customers.edit',
              'services.view',
              'services.create',
              'reports.view',
              'dashboard.view',
            ],
          },
        },
      });
      console.log('✅ Sales Manager permissions updated');
    }

    // 6. Service Team Lead
    const serviceTeamLeadRole = await prisma.role.findFirst({
      where: { name: 'Service Team Lead' },
    });

    if (serviceTeamLeadRole) {
      await prisma.role.update({
        where: { id: serviceTeamLeadRole.id },
        data: {
          permissions: {
            permissions: [
              'services.view',
              'services.edit',
              'services.assign',
              'customers.view',
              'dashboard.view',
            ],
          },
        },
      });
      console.log('✅ Service Team Lead permissions updated');
    }

    // 7. Sales Team Lead
    const salesTeamLeadRole = await prisma.role.findFirst({
      where: { name: 'Sales Team Lead' },
    });

    if (salesTeamLeadRole) {
      await prisma.role.update({
        where: { id: salesTeamLeadRole.id },
        data: {
          permissions: {
            permissions: [
              'customers.view',
              'customers.create',
              'services.view',
              'services.create',
              'dashboard.view',
            ],
          },
        },
      });
      console.log('✅ Sales Team Lead permissions updated');
    }

    // 8. Service Technician
    const technicianRole = await prisma.role.findFirst({
      where: { name: { in: ['Technician', 'Service Technician'] } },
    });

    if (technicianRole) {
      await prisma.role.update({
        where: { id: technicianRole.id },
        data: {
          permissions: {
            permissions: [
              'services.view',
              'services.edit', // Can update service status
              'customers.view',
              'dashboard.view',
            ],
          },
        },
      });
      console.log('✅ Technician permissions updated');
    }

    // 9. Salesman/Sales Executive
    const salesmanRole = await prisma.role.findFirst({
      where: { name: { in: ['Salesman', 'Sales Executive'] } },
    });

    if (salesmanRole) {
      await prisma.role.update({
        where: { id: salesmanRole.id },
        data: {
          permissions: {
            permissions: [
              'customers.view',
              'customers.create',
              'services.view',
              'services.create',
              'dashboard.view',
            ],
          },
        },
      });
      console.log('✅ Salesman permissions updated');
    }

    console.log('\n🎉 All role permissions seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding permissions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed
seedRolePermissions();
