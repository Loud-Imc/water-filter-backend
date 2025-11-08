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

  // 2. Create Regions (with new fields: state, district, city, pincode)
  console.log('📍 Creating regions...');
  await prisma.region.createMany({
    data: [
      {
        name: 'Kerala - Ernakulam - Kochi - 682001',
        state: 'Kerala',
        district: 'Ernakulam',
        city: 'Kochi',
        pincode: '682001',
      },
      {
        name: 'Kerala - Ernakulam - Aluva - 683101',
        state: 'Kerala',
        district: 'Ernakulam',
        city: 'Aluva',
        pincode: '683101',
      },
      {
        name: 'Kerala - Kottayam - Pala - 686575',
        state: 'Kerala',
        district: 'Kottayam',
        city: 'Pala',
        pincode: '686575',
      },
      {
        name: 'Kerala - Kottayam - Kottayam Town - 686001',
        state: 'Kerala',
        district: 'Kottayam',
        city: 'Kottayam Town',
        pincode: '686001',
      },
      {
        name: 'Kerala - Thrissur - Thrissur City - 680001',
        state: 'Kerala',
        district: 'Thrissur',
        city: 'Thrissur City',
        pincode: '680001',
      },
      {
        name: 'Kerala - Kozhikode - Kozhikode City - 673001',
        state: 'Kerala',
        district: 'Kozhikode',
        city: 'Kozhikode City',
        pincode: '673001',
      },
      {
        name: 'Kerala - Kannur - Kannur City - 670001',
        state: 'Kerala',
        district: 'Kannur',
        city: 'Kannur City',
        pincode: '670001',
      },
      {
        name: 'Kerala - Palakkad - Palakkad City - 678001',
        state: 'Kerala',
        district: 'Palakkad',
        city: 'Palakkad City',
        pincode: '678001',
      },
      {
        name: 'Kerala - Thiruvananthapuram - Trivandrum City - 695001',
        state: 'Kerala',
        district: 'Thiruvananthapuram',
        city: 'Trivandrum City',
        pincode: '695001',
      },
      {
        name: 'Kerala - Kollam - Kollam City - 691001',
        state: 'Kerala',
        district: 'Kollam',
        city: 'Kollam City',
        pincode: '691001',
      },
      {
        name: 'Kerala - Malappuram - Malappuram City - 676505',
        state: 'Kerala',
        district: 'Malappuram',
        city: 'Malappuram City',
        pincode: '676505',
      },
      {
        name: 'Kerala - Wayanad - Kalpetta - 673121',
        state: 'Kerala',
        district: 'Wayanad',
        city: 'Kalpetta',
        pincode: '673121',
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Regions created');

  // Get the first region for seeding users
  const firstRegion = await prisma.region.findFirst();

  if (!firstRegion) {
    throw new Error('No regions found. Cannot seed users.');
  }

  // 3. Create Super Admin User
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
        regionId: firstRegion.id,
        status: 'ACTIVE',
      },
    });
    console.log('✅ Super admin created (admin@leewaa.com / Admin@123)');
  }

  // 4. Create a Service Admin User
  console.log('👤 Creating service admin...');
  const serviceAdminRole = await prisma.role.findFirst({
    where: { name: 'Service Admin' },
  });

  if (serviceAdminRole) {
    const hashedPassword = await bcrypt.hash('ServiceAdmin@123', 10);
    await prisma.user.create({
      data: {
        name: 'Service Admin',
        email: 'serviceadmin@leewaa.com',
        password: hashedPassword,
        roleId: serviceAdminRole.id,
        regionId: firstRegion.id,
        status: 'ACTIVE',
      },
    });
    console.log(
      '✅ Service admin created (serviceadmin@leewaa.com / ServiceAdmin@123)',
    );
  }

  // 5. Create a Sales Admin User
  console.log('👤 Creating sales admin...');
  const salesAdminRole = await prisma.role.findFirst({
    where: { name: 'Sales Admin' },
  });

  if (salesAdminRole) {
    const hashedPassword = await bcrypt.hash('SalesAdmin@123', 10);
    await prisma.user.create({
      data: {
        name: 'Sales Admin',
        email: 'salesadmin@leewaa.com',
        password: hashedPassword,
        roleId: salesAdminRole.id,
        regionId: firstRegion.id,
        status: 'ACTIVE',
      },
    });
    console.log(
      '✅ Sales admin created (salesadmin@leewaa.com / SalesAdmin@123)',
    );
  }

  // 6. Create a Service Manager User
  console.log('👔 Creating service manager...');
  const serviceManagerRole = await prisma.role.findFirst({
    where: { name: 'Service Manager' },
  });

  if (serviceManagerRole) {
    const hashedPassword = await bcrypt.hash('ServiceMgr@123', 10);
    await prisma.user.create({
      data: {
        name: 'Service Manager',
        email: 'srvmgr@leewaa.com',
        password: hashedPassword,
        roleId: serviceManagerRole.id,
        regionId: firstRegion.id,
        status: 'ACTIVE',
      },
    });
    console.log(
      '✅ Service manager created (srvmgr@leewaa.com / ServiceMgr@123)',
    );
  }

  // 7. Create Technician Users
  console.log('👷 Creating technicians...');
  const technicianRole = await prisma.role.findFirst({
    where: { name: 'Technician' },
  });

  if (technicianRole) {
    const technicians = [
      {
        name: 'Raj Kumar',
        email: 'raj.kumar@leewaa.com',
        password: 'TechRaj@123',
      },
      {
        name: 'Priya Singh',
        email: 'priya.singh@leewaa.com',
        password: 'TechPriya@123',
      },
      {
        name: 'Kamarudhin',
        email: 'kamarudhin@leewaa.com',
        password: 'TechKamaru@123',
      },
    ];

    for (const tech of technicians) {
      const hashedPassword = await bcrypt.hash(tech.password, 10);
      await prisma.user.create({
        data: {
          name: tech.name,
          email: tech.email,
          password: hashedPassword,
          roleId: technicianRole.id,
          regionId: firstRegion.id,
          status: 'ACTIVE',
        },
      });
    }
    console.log(`✅ ${technicians.length} Technicians created`);
  }

  // 8. Create Salesman Users
  console.log('💼 Creating salesmen...');
  const salesmanRole = await prisma.role.findFirst({
    where: { name: 'Salesman' },
  });

  if (salesmanRole) {
    const salesmen = [
      {
        name: 'Amit Verma',
        email: 'amit.verma@leewaa.com',
        password: 'SalesAmit@123',
      },
      {
        name: 'Sneha Patel',
        email: 'sneha.patel@leewaa.com',
        password: 'SalesSneha@123',
      },
    ];

    for (const salesman of salesmen) {
      const hashedPassword = await bcrypt.hash(salesman.password, 10);
      await prisma.user.create({
        data: {
          name: salesman.name,
          email: salesman.email,
          password: hashedPassword,
          roleId: salesmanRole.id,
          regionId: firstRegion.id,
          status: 'ACTIVE',
        },
      });
    }
    console.log(`✅ ${salesmen.length} Salesmen created`);
  }

  // 9. Create Sample Customers
  console.log('🏢 Creating sample customers...');
  const customers = [
    {
      name: 'ABC Corporation',
      address: '123 Main Street, Kochi',
      primaryPhone: '9876543210',
      phoneNumbers: ['9876543211', '0484123456'],
      email: 'contact@abccorp.com',
      regionId: firstRegion.id,
    },
    {
      name: 'XYZ Industries',
      address: '456 Business Park, Kozhikode',
      primaryPhone: '9988776655',
      phoneNumbers: ['9988776656'],
      email: 'contact@xyzind.com',
      regionId: firstRegion.id,
    },
    {
      name: 'John Doe',
      address: '789 Residential Area, Kottayam',
      primaryPhone: '9123456789',
      phoneNumbers: [],
      email: 'john.doe@email.com',
      regionId: firstRegion.id,
    },
    {
      name: 'Lena Wilson',
      address: '321 Heritage Lane, Thrissur',
      primaryPhone: '9111111111',
      phoneNumbers: ['9111111112'],
      email: 'lena.wilson@email.com',
      regionId: firstRegion.id,
    },
    {
      name: 'Tech Solutions Ltd',
      address: '654 Innovation Park, Ernakulam',
      primaryPhone: '9222222222',
      phoneNumbers: ['9222222223', '9222222224'],
      email: 'info@techsolutions.com',
      regionId: firstRegion.id,
    },
  ];

  for (const customer of customers) {
    await prisma.customer.create({ data: customer });
  }
  console.log('✅ Sample customers created');

  console.log('✨ Seed completed successfully!');
  console.log('\n📋 SEEDED DATA SUMMARY:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 9 Roles created');
  console.log(
    '✅ 12 Regions created (Kerala with state/district/city/pincode)',
  );
  console.log('✅ 3 Admins created (Super, Service, Sales)');
  console.log('✅ 1 Service Manager created');
  console.log('✅ 3 Technicians created');
  console.log('✅ 2 Salesmen created');
  console.log('✅ 5 Sample Customers created');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🔐 DEFAULT CREDENTIALS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Super Admin: admin@leewaa.com / Admin@123');
  console.log('Service Admin: serviceadmin@leewaa.com / ServiceAdmin@123');
  console.log('Sales Admin: salesadmin@leewaa.com / SalesAdmin@123');
  console.log('Service Mgr: srvmgr@leewaa.com / ServiceMgr@123');
  console.log('Technician 1: raj.kumar@leewaa.com / TechRaj@123');
  console.log('Technician 2: priya.singh@leewaa.com / TechPriya@123');
  console.log('Technician 3: kamarudhin@leewaa.com / TechKamaru@123');
  console.log('Salesman 1: amit.verma@leewaa.com / SalesAmit@123');
  console.log('Salesman 2: sneha.patel@leewaa.com / SalesSneha@123');
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
