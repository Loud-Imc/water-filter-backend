import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Create Roles (Simplified - only 4 roles)
  console.log('📝 Creating roles...');
  await prisma.role.createMany({
    data: [
      {
        id: 'qwertyui3dfgh',
        name: 'Super Admin',
        parentRole: null,
        permissions: '{}',
        immutable: true,
      },
      {
        id: 'wertyuio56456dfgh',
        name: 'Service Admin',
        parentRole: 'Super Admin',
        permissions: '{}',
      },
      {
        id: 'servicemgr12345',
        name: 'Service Manager',
        parentRole: 'Service Admin',
        permissions: '{}',
      },
      // 🆕 NEW: Service Team Lead
      {
        id: 'servicelead6789',
        name: 'Service Team Lead',
        parentRole: 'Service Manager',
        permissions: '{}',
      },
      {
        id: 'asdfghjk541fgh',
        name: 'Tele Caller',
        parentRole: 'Service Admin',
        permissions: '{}',
      },
      {
        id: 'qwertyuiop123',
        name: 'Technician',
        parentRole: 'Service Admin',
        permissions: '{}',
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Roles created');

  // 2. Create Super Admin User (only admin user)
  console.log('👤 Creating super admin...');
  const superAdminRole = await prisma.role.findFirst({
    where: { name: 'Super Admin' },
  });

  if (superAdminRole) {
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: 'admin@leewaa.com',
        password: hashedPassword, // Admin@123
        roleId: superAdminRole.id,
        regionId: null, // ✅ No region
        status: 'ACTIVE',
      },
    });
    console.log('✅ Super admin created (admin@leewaa.com / Admin@123)');
  }

  console.log('✨ Seed completed successfully!');
  console.log('\n📋 SEEDED DATA SUMMARY:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(
    '✅ 4 Roles created (Super Admin, Tele Caller, Service Admin, Technician)',
  );
  console.log('✅ 0 Regions (regions removed)');
  console.log('✅ 1 Super Admin created');
  console.log('✅ 0 Technicians');
  console.log('✅ 0 Salesmen');
  console.log('✅ 0 Customers');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🔐 DEFAULT CREDENTIALS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Super Admin: admin@leewaa.com / Admin@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
