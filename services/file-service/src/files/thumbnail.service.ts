import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';

const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_HEIGHT = 200;

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);

  isImage(mimeType: string): boolean {
    return ['image/jpeg', 'image/png', 'image/jpg'].includes(mimeType);
  }

  async generate(buffer: Buffer): Promise<Buffer> {
    this.logger.debug('Generating thumbnail...');
    return sharp(buffer)
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  }
}
