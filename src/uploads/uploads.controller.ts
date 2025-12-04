import {
  Controller,
  Post,
  Param,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post('work-media/:requestId')
  @Roles('Technician', 'Service Admin', 'Super Admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/work-media',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          const ext = extname(file.originalname);
          cb(null, `${randomName}${ext}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 🆕 Increase to 10MB for mobile images
      },
      fileFilter: (req, file, cb) => {
        console.log('📱 Incoming file:', {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        });

        // 🆕 More permissive MIME types (mobile browsers vary)
        const allowed = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp', // 🆕 Modern mobile format
          'image/heic', // 🆕 iPhone format
          'image/heif', // 🆕 iPhone format
        ];

        // 🆕 Also check file extension as fallback
        const ext = extname(file.originalname).toLowerCase();
        const allowedExts = [
          '.jpg',
          '.jpeg',
          '.png',
          '.gif',
          '.webp',
          '.heic',
          '.heif',
        ];

        if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
          cb(null, true);
        } else {
          console.error('❌ Invalid file type:', file.mimetype, ext);
          cb(
            new BadRequestException(
              `Invalid file type: ${file.mimetype}. Only images are allowed.`,
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadWorkMedia(
    @Param('requestId') requestId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    console.log('📤 Upload request received:', {
      requestId,
      hasFile: !!file,
      file: file
        ? {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            filename: file.filename,
          }
        : null,
    });

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.uploadsService.uploadWorkMedia(requestId, file);
  }
}
