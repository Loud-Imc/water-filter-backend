import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UploadsService {
  constructor(private prisma: PrismaService) {}

  async uploadWorkMedia(requestId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Verify the request exists
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    // ✅ Create proper file URL using filename (now has extension!)
    const fileUrl = `/uploads/work-media/${file.filename}`;

    console.log('📁 Uploaded file:', {
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      url: fileUrl,
    });

    return this.prisma.workMedia.create({
      data: {
        requestId,
        fileUrl,
      },
    });
  }
}
