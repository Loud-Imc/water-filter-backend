import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Create Roles (Organizational Hierarchy)
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
        id: 'asdfghjk541fgh',
        name: 'Service Admin',
        parentRole: 'Super Admin',
        permissions: '{}',
      },
      {
        id: 'wertyuio56456dfgh',
        name: 'Sales Admin',
        parentRole: 'Super Admin',
        permissions: '{}',
      },
      {
        id: 'zxcvbnm7890dfgh',
        name: 'Service Manager',
        parentRole: 'Service Admin',
        permissions: '{}',
      },
      {
        id: 'qazwsx123edc',
        name: 'Sales Manager',
        parentRole: 'Sales Admin',
        permissions: '{}',
      },
      {
        id: 'plmokn456ijn',
        name: 'Service Team Lead',
        parentRole: 'Service Manager',
        permissions: '{}',
      },
      {
        id: 'mnbvcx789lkj',
        name: 'Sales Team Lead',
        parentRole: 'Sales Manager',
        permissions: '{}',
      },
      {
        id: 'qwertyuiop123',
        name: 'Technician',
        parentRole: 'Service Team Lead',
        permissions: '{}',
      },
      {
        id: 'asdfghjkl456',
        name: 'Salesman',
        parentRole: 'Sales Team Lead',
        permissions: '{}',
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Roles created');

  // 2. Create Super Admin User
  console.log('👤 Creating super admin...');
  const superAdminRole = await prisma.role.findFirst({
    where: { name: 'Super Admin' },
  });

  if (!superAdminRole) {
    throw new Error('Super Admin role not found');
  }

  const hashedPassword = await bcrypt.hash('Admin@123', 10);
  
  // Check if super admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@leewaa.com' },
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: 'admin@leewaa.com',
        password: hashedPassword,
        roleId: superAdminRole.id,
        regionId: null, // No region required for super admin
        status: 'ACTIVE',
      },
    });
    console.log('✅ Super admin created');
  } else {
    console.log('ℹ️  Super admin already exists, skipping...');
  }

  console.log('✨ Seed completed successfully!');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 SEEDED DATA SUMMARY:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 9 Roles created');
  console.log('✅ 1 Super Admin created');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🔐 SUPER ADMIN CREDENTIALS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Email:    admin@leewaa.com');
  console.log('Password: Admin@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📝 Next Steps:');
  console.log('1. Login with super admin credentials');
  console.log('2. Create regions through the admin panel');
  console.log('3. Add users (admins, managers, technicians, salesmen)');
  console.log('4. Add customers');
  console.log('5. ⚠️  IMPORTANT: Change the super admin password!\n');
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
