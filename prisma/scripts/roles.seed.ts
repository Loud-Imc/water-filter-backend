import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Create Roles
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

  // 2. Create Regions
  console.log('📍 Creating regions...');
  await prisma.region.createMany({
    data: [
      { name: 'Ernakulam (EKM)' },
      { name: 'Malappuram (MLP)' },
      { name: 'Thrissur (TRSUR)' },
      { name: 'Kozhikode (CLT)' },
      { name: 'Kannur (KNR)' },
      { name: 'Palakkad (PKD)' },
      { name: 'Thiruvananthapuram (TVM)' },
      { name: 'Kollam (KLM)' },
      { name: 'Kottayam (KTM)' },
      { name: 'Wayanad (WYND)' },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Regions created');

  // Get the first region for seeding
  const firstRegion = await prisma.region.findFirst();
  if (!firstRegion) {
    throw new Error('No regions found');
  }

  // 3. Create Super Admin User
  console.log('👤 Creating super admin...');
  const superAdminRole = await prisma.role.findFirst({
    where: { name: 'Super Admin' },
  });

  if (superAdminRole) {
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    
    await prisma.user.upsert({
      where: { email: 'admin@waterfilter.com' },
      update: {},
      create: {
        name: 'Super Admin',
        email: 'admin@waterfilter.com',
        password: hashedPassword,
        roleId: superAdminRole.id,
        regionId: firstRegion.id,
        status: 'ACTIVE',
      },
    });
    console.log('✅ Super admin created (admin@waterfilter.com / Admin@123)');
  }

  // 4. Create Technician User
  console.log('👷 Creating technician...');
  const technicianRole = await prisma.role.findFirst({
    where: { name: 'Technician' },
  });

  if (technicianRole) {
    const hashedPassword = await bcrypt.hash('Kamaru@123', 10);
    
    await prisma.user.upsert({
      where: { email: 'kamaru111@gmail.com' },
      update: {},
      create: {
        name: 'Kamarudhin',
        email: 'kamaru916@gmail.com',
        password: hashedPassword,
        roleId: technicianRole.id,
        regionId: firstRegion.id,
        status: 'ACTIVE',
      },
    });
    console.log('✅ Technician created (kamaru916@gmail.com / Kamaru@123)');
  }

  // 5. Create Sample Customers
  console.log('🏢 Creating sample customers...');
  
  await prisma.customer.upsert({
    where: { primaryPhone: '9876543210' },
    update: {},
    create: {
      name: 'ABC Corporation',
      address: '123 Main Street, Ernakulam',
      primaryPhone: '9876543210',
      phoneNumbers: ['9876543211', '0484123456'],
      email: 'contact@abccorp.com',
      regionId: firstRegion.id,
    },
  });

  await prisma.customer.upsert({
    where: { primaryPhone: '9988776655' },
    update: {},
    create: {
      name: 'XYZ Industries',
      address: '456 Business Park, Kozhikode',
      primaryPhone: '9988776655',
      phoneNumbers: ['9988776656'],
      regionId: firstRegion.id,
    },
  });

  await prisma.customer.upsert({
    where: { primaryPhone: '9123456789' },
    update: {},
    create: {
      name: 'John Doe',
      address: '789 Residential Area, Thrissur',
      primaryPhone: '9123456789',
      phoneNumbers: [],
      email: 'john.doe@email.com',
      regionId: firstRegion.id,
    },
  });

  console.log('✅ Sample customers created');
  console.log('✨ Seed completed successfully!');
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
