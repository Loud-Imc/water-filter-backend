import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private prisma: PrismaService) {}

  async uploadWorkMedia(requestId: string, file: Express.Multer.File) {
    try {
      // Validate file exists
      if (!file) {
        this.logger.warn(`Upload attempt with no file for request: ${requestId}`);
        throw new BadRequestException('No file uploaded');
      }

      this.logger.log(`Processing file upload for request: ${requestId}`);
      this.logger.debug('File details:', {
        originalName: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
      });

      // Verify the request exists
      let request;
      try {
        request = await this.prisma.serviceRequest.findUnique({
          where: { id: requestId },
          select: {
            id: true,
            status: true,
            assignedToId: true,
          },
        });
      } catch (error) {
        this.logger.error(`Database error while fetching request ${requestId}:`, error);
        throw new InternalServerErrorException(
          'Failed to verify service request. Please try again.',
        );
      }

      if (!request) {
        this.logger.warn(`Service request not found: ${requestId}`);
        
        // Clean up uploaded file since request doesn't exist
        this.cleanupFile(file.path);
        
        throw new NotFoundException(
          `Service request with ID ${requestId} not found`,
        );
      }

      // Validate file was actually saved to disk
      if (!fs.existsSync(file.path)) {
        this.logger.error(`File not found on disk: ${file.path}`);
        throw new InternalServerErrorException(
          'File upload failed. File not saved to server.',
        );
      }

      // Create proper file URL
      const fileUrl = `/uploads/work-media/${file.filename}`;

      this.logger.log('Creating database record for uploaded file:', {
        requestId,
        fileUrl,
        filename: file.filename,
      });

      // Save to database
      let workMedia;
      try {
        workMedia = await this.prisma.workMedia.create({
          data: {
            requestId,
            fileUrl,
          },
        });
      } catch (error) {
        this.logger.error('Database error while creating work media record:', error);

        // Clean up uploaded file if database insert fails
        this.cleanupFile(file.path);

        if (error instanceof PrismaClientKnownRequestError) {
          if (error.code === 'P2003') {
            // Foreign key constraint failed
            throw new BadRequestException(
              'Invalid service request ID. Request may have been deleted.',
            );
          }
          if (error.code === 'P2002') {
            // Unique constraint failed
            throw new BadRequestException(
              'This file has already been uploaded.',
            );
          }
        }

        throw new InternalServerErrorException(
          'Failed to save file information. Please try again.',
        );
      }

      this.logger.log(`✅ File uploaded successfully: ${workMedia.id}`);

      return {
        id: workMedia.id,
        fileUrl: workMedia.fileUrl,
        requestId: workMedia.requestId,
        createdAt: workMedia.createdAt,
        message: 'File uploaded successfully',
      };
    } catch (error) {
      // Log all errors
      this.logger.error('Error in uploadWorkMedia:', {
        requestId,
        fileName: file?.filename,
        error: error.message,
        stack: error.stack,
      });

      // Re-throw known errors
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      // Handle any unexpected errors
      throw new InternalServerErrorException(
        'An unexpected error occurred during file upload. Please try again.',
      );
    }
  }

  /**
   * Helper method to clean up files from disk
   */
  private cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`Cleaned up file: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup file ${filePath}:`, error);
      // Don't throw error here - cleanup is best effort
    }
  }

  /**
   * Delete work media (optional - for admin/cleanup purposes)
   */
  // async deleteWorkMedia(mediaId: string): Promise<void> {
  //   try {
  //     this.logger.log(`Deleting work media: ${mediaId}`);

  //     // Get media info first
  //     const media = await this.prisma.workMedia.findUnique({
  //       where: { id: mediaId },
  //     });

  //     if (!media) {
  //       throw new NotFoundException(`Work media with ID ${mediaId} not found`);
  //     }

  //     // Extract filename from URL
  //     const filename = path.basename(media.fileUrl);
  //     const filePath = path.join('./uploads/work-media', filename);

  //     // Delete from database
  //     await this.prisma.workMedia.delete({
  //       where: { id: mediaId },
  //     });

  //     // Delete file from disk
  //     this.cleanupFile(filePath);

  //     this.logger.log(`✅ Work media deleted: ${mediaId}`);
  //   } catch (error) {
  //     this.logger.error(`Error deleting work media ${mediaId}:`, error);

  //     if (error instanceof NotFoundException) {
  //       throw error;
  //     }

  //     if (error instanceof PrismaClientKnownRequestError) {
  //       if (error.code === 'P2025') {
  //         throw new NotFoundException(`Work media with ID ${mediaId} not found`);
  //       }
  //     }

  //     throw new InternalServerErrorException(
  //       'Failed to delete work media. Please try again.',
  //     );
  //   }
  // }

  /**
   * Get all media for a service request
   */
  // async getWorkMediaByRequest(requestId: string) {
  //   try {
  //     this.logger.log(`Fetching work media for request: ${requestId}`);

  //     const media = await this.prisma.workMedia.findMany({
  //       where: { requestId },
  //       orderBy: { createdAt: 'desc' },
  //     });

  //     return media;
  //   } catch (error) {
  //     this.logger.error(`Error fetching work media for request ${requestId}:`, error);
  //     throw new InternalServerErrorException(
  //       'Failed to fetch work media. Please try again.',
  //     );
  //   }
  // }
}
