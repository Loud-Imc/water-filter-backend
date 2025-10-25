import { PrismaClient, RequestType } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

async function importExcelData() {
  console.log('🚀 Starting Excel data import...');

  try {
    // Read Excel file
    const workbook = XLSX.readFile(
      path.join(__dirname, '../new fiiting and service report.xlsx')
    );
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 Found ${data.length} records in Excel`);

    // Get default region (you can modify this)
    const defaultRegion = await prisma.region.findFirst();
    if (!defaultRegion) {
      throw new Error('No region found. Create at least one region first.');
    }

    // Get or create a system user for historical imports
    let systemUser = await prisma.user.findFirst({
      where: { email: 'system@waterfilter.com' },
    });

    if (!systemUser) {
      const systemRole = await prisma.role.findFirst({
        where: { name: 'Super Admin' },
      });
      
      systemUser = await prisma.user.create({
        data: {
          name: 'System Import',
          email: 'system@waterfilter.com',
          password: 'temp', // Won't be used
          roleId: systemRole!.id,
          status: 'ACTIVE',
        },
      });
    }

    let imported = 0;
    let skipped = 0;

    for (const row of data) {
      try {
        // Map Excel columns to your data structure
        // Adjust column names based on your Excel file
        const customerName = row['Customer Name'] || row['Name'];
        const phone = row['Phone'] || row['Mobile'];
        const address = row['Address'] || row['Location'];
        const serviceType = mapServiceType(row['Type'] || row['Service Type']);
        const description = row['Description'] || row['Details'] || 'Historical record';
        const dateStr = row['Date'];
        const technicianName = row['Technician'] || row['Tech'];

        if (!customerName || !phone) {
          console.log(`⚠️  Skipping row - missing customer name or phone`);
          skipped++;
          continue;
        }

        // Find or create customer
        let customer = await prisma.customer.findFirst({
          where: { primaryPhone: phone },
        });

        if (!customer) {
          customer = await prisma.customer.create({
            data: {
              name: customerName,
              primaryPhone: phone,
              address: address || 'Address not provided',
              regionId: defaultRegion.id,
            },
          });
          console.log(`✅ Created customer: ${customerName}`);
        }

        // Find technician if name provided
        let technicianId: string | undefined = undefined;
        if (technicianName) {
          const technician = await prisma.user.findFirst({
            where: {
              name: { contains: technicianName, mode: 'insensitive' },
              role: { name: 'Technician' },
            },
          });
          technicianId = technician?.id;
        }

        // Create service request
        await prisma.serviceRequest.create({
          data: {
            type: serviceType,
            description: description,
            status: 'COMPLETED', // Historical records are completed
            customerId: customer.id,
            regionId: defaultRegion.id,
            requestedById: systemUser.id,
            approvedById: systemUser.id,
            assignedToId: technicianId,
            createdAt: parseDate(dateStr),
          },
        });

        imported++;
        console.log(`✅ Imported: ${customerName} - ${serviceType}`);
      } catch (error) {
        console.error(`❌ Error importing row:`, error);
        skipped++;
      }
    }

    console.log(`\n🎉 Import complete!`);
    console.log(`✅ Imported: ${imported} records`);
    console.log(`⚠️  Skipped: ${skipped} records`);
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function mapServiceType(type: string): RequestType {
  const lowerType = type?.toLowerCase() || '';
  
  if (lowerType.includes('install')) return 'INSTALLATION';
  if (lowerType.includes('service') || lowerType.includes('maintenance')) return 'SERVICE';
  if (lowerType.includes('complaint') || lowerType.includes('repair')) return 'COMPLAINT';
  if (lowerType.includes('enquiry') || lowerType.includes('enquire')) return 'ENQUIRY';
  
  return 'SERVICE'; // Default
}

function parseDate(dateStr: any): Date {
  if (!dateStr) return new Date();
  
  // Handle Excel serial date numbers
  if (typeof dateStr === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + dateStr * 86400000);
  }
  
  // Handle string dates
  return new Date(dateStr);
}

// Run the import
importExcelData();
