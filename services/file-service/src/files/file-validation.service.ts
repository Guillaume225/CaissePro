import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { fromBuffer } from 'file-type';
import * as path from 'path';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

const EXTENSION_MIME_MAP: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
};

@Injectable()
export class FileValidationService {
  private readonly logger = new Logger(FileValidationService.name);

  async validate(
    file: Express.Multer.File,
    maxSize: number,
  ): Promise<{ detectedMime: string; extension: string }> {
    // 1. Size check
    if (file.size > maxSize) {
      throw new BadRequestException(`File size ${file.size} exceeds maximum ${maxSize} bytes`);
    }

    // 2. Extension check
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `Extension "${ext}" not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    // 3. Detect real MIME type from file content (antivirus-like check)
    const detected = await fromBuffer(file.buffer);
    const detectedMime = detected?.mime || file.mimetype;

    if (!ALLOWED_MIME_TYPES.includes(detectedMime)) {
      throw new BadRequestException(`Detected MIME type "${detectedMime}" is not allowed`);
    }

    // 4. Cross-check declared extension vs real MIME (spoofing detection)
    const expectedMimes = EXTENSION_MIME_MAP[ext];
    if (expectedMimes && !expectedMimes.includes(detectedMime)) {
      this.logger.warn(
        `MIME mismatch: extension=${ext}, declared=${file.mimetype}, detected=${detectedMime}`,
      );
      throw new BadRequestException(
        `File extension "${ext}" does not match detected content type "${detectedMime}"`,
      );
    }

    return { detectedMime, extension: ext };
  }
}
