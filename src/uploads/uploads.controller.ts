import {
  Controller,
  Post,
  Param,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer'; // ✅ Import diskStorage
import { extname } from 'path'; // ✅ Import path utilities
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post('work-media/:requestId')
  @Roles('Technician', 'Service Admin', 'Super Admin') // ✅ Allow admins too
  @UseInterceptors(
    FileInterceptor('file', {
      // ✅ Use diskStorage instead of dest
      storage: diskStorage({
        destination: './uploads/work-media', // ✅ Specific folder
        filename: (req, file, cb) => {
          // ✅ Generate unique filename with proper extension
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          const ext = extname(file.originalname); // ✅ Get original extension
          cb(null, `${randomName}${ext}`); // ✅ e.g., abc123.jpg
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
      fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only images (JPEG, PNG, GIF) are allowed!'), false);
        }
      },
    }),
  )
  uploadWorkMedia(
    @Param('requestId') requestId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploadsService.uploadWorkMedia(requestId, file);
  }
}
