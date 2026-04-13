import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { FileEntity, FileModule, FileStatus } from '../entities/file.entity';
import { StorageService } from '../storage/storage.service';
import { ThumbnailService } from './thumbnail.service';
import { FileValidationService } from './file-validation.service';
import { FileResponseDto } from './dto';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly maxFileSize: number;

  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    private readonly storage: StorageService,
    private readonly thumbnail: ThumbnailService,
    private readonly validation: FileValidationService,
    private readonly config: ConfigService,
  ) {
    this.maxFileSize = this.config.get<number>('app.maxFileSize')!;
  }

  async upload(
    file: Express.Multer.File,
    userId: string,
    module: FileModule = FileModule.GENERAL,
    entityId?: string,
  ): Promise<FileResponseDto> {
    // Validate file (type, size, MIME spoofing)
    const { detectedMime, extension } = await this.validation.validate(file, this.maxFileSize);

    // Generate storage key: /module/YYYY/MM/uuid.ext
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const fileId = crypto.randomUUID();
    const storageKey = `${module}/${year}/${month}/${fileId}${extension}`;

    // Compute checksum
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Upload to MinIO
    await this.storage.upload(storageKey, file.buffer, detectedMime);

    // Generate thumbnail if image
    let thumbnailKey: string | null = null;
    if (this.thumbnail.isImage(detectedMime)) {
      const thumbBuffer = await this.thumbnail.generate(file.buffer);
      thumbnailKey = `${module}/${year}/${month}/thumb_${fileId}.jpg`;
      await this.storage.upload(thumbnailKey, thumbBuffer, 'image/jpeg');
    }

    // Save to database
    const entity = this.fileRepo.create({
      id: fileId,
      originalName: file.originalname,
      storageKey,
      thumbnailKey,
      mimeType: detectedMime,
      extension,
      size: file.size,
      module,
      entityId: entityId || null,
      status: FileStatus.ACTIVE,
      uploadedBy: userId,
      checksum,
    });

    const saved = await this.fileRepo.save(entity);
    return this.toResponse(saved);
  }

  async findOne(id: string): Promise<FileResponseDto> {
    const file = await this.fileRepo.findOne({ where: { id } });
    if (!file) {
      throw new NotFoundException(`File ${id} not found`);
    }
    return this.toResponse(file);
  }

  async getDownloadUrl(id: string): Promise<{ url: string; filename: string }> {
    const file = await this.fileRepo.findOne({ where: { id } });
    if (!file) {
      throw new NotFoundException(`File ${id} not found`);
    }
    const url = await this.storage.getPresignedDownloadUrl(file.storageKey, file.originalName);
    return { url, filename: file.originalName };
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id } });
    if (!file) {
      throw new NotFoundException(`File ${id} not found`);
    }
    file.status = FileStatus.DELETED;
    await this.fileRepo.save(file);
    await this.fileRepo.softRemove(file);
    this.logger.log(`File ${id} soft-deleted by user ${userId}`);
  }

  private toResponse(entity: FileEntity): FileResponseDto {
    const dto = new FileResponseDto();
    dto.id = entity.id;
    dto.originalName = entity.originalName;
    dto.mimeType = entity.mimeType;
    dto.extension = entity.extension;
    dto.size = Number(entity.size);
    dto.module = entity.module;
    dto.entityId = entity.entityId;
    dto.status = entity.status;
    dto.uploadedBy = entity.uploadedBy;
    dto.thumbnailAvailable = !!entity.thumbnailKey;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
