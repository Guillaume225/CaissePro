import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { FilesService } from './files.service';
import { FileEntity, FileModule, FileStatus } from '../entities/file.entity';
import { StorageService } from '../storage/storage.service';
import { ThumbnailService } from './thumbnail.service';
import { FileValidationService } from './file-validation.service';

function mockFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('%PDF-1.4 fake'),
    stream: null as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

const mockEntity: FileEntity = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  originalName: 'test.pdf',
  storageKey: 'general/2026/03/550e8400-e29b-41d4-a716-446655440000.pdf',
  thumbnailKey: null,
  mimeType: 'application/pdf',
  extension: '.pdf',
  size: 1024,
  module: FileModule.GENERAL,
  entityId: null,
  status: FileStatus.ACTIVE,
  uploadedBy: 'user-123',
  checksum: 'abc123',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('FilesService', () => {
  let service: FilesService;
  let repo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; softRemove: jest.Mock };
  let storageService: { upload: jest.Mock; delete: jest.Mock; getPresignedDownloadUrl: jest.Mock };
  let thumbnailService: { isImage: jest.Mock; generate: jest.Mock };
  let validationService: { validate: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((data) => ({ ...mockEntity, ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      softRemove: jest.fn(() => Promise.resolve()),
    };

    storageService = {
      upload: jest.fn(() => Promise.resolve()),
      delete: jest.fn(() => Promise.resolve()),
      getPresignedDownloadUrl: jest.fn(() =>
        Promise.resolve('https://minio.local/presigned-url'),
      ),
    };

    thumbnailService = {
      isImage: jest.fn(() => false),
      generate: jest.fn(() => Promise.resolve(Buffer.from('thumb'))),
    };

    validationService = {
      validate: jest.fn(() =>
        Promise.resolve({ detectedMime: 'application/pdf', extension: '.pdf' }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: getRepositoryToken(FileEntity), useValue: repo },
        { provide: StorageService, useValue: storageService },
        { provide: ThumbnailService, useValue: thumbnailService },
        { provide: FileValidationService, useValue: validationService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, unknown> = {
                'app.maxFileSize': 10_485_760,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get(FilesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upload', () => {
    it('should upload a PDF and return response', async () => {
      const file = mockFile();
      const result = await service.upload(file, 'user-123');

      expect(validationService.validate).toHaveBeenCalledWith(file, 10_485_760);
      expect(storageService.upload).toHaveBeenCalledTimes(1);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(result.originalName).toBe('test.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.thumbnailAvailable).toBe(false);
    });

    it('should generate thumbnail for image uploads', async () => {
      validationService.validate.mockResolvedValue({
        detectedMime: 'image/png',
        extension: '.png',
      });
      thumbnailService.isImage.mockReturnValue(true);

      const file = mockFile({
        originalname: 'photo.png',
        mimetype: 'image/png',
      });

      const result = await service.upload(file, 'user-123');

      expect(thumbnailService.generate).toHaveBeenCalledWith(file.buffer);
      expect(storageService.upload).toHaveBeenCalledTimes(2); // file + thumbnail
      expect(result.thumbnailAvailable).toBe(true);
    });

    it('should use provided module and entityId', async () => {
      const file = mockFile();
      const result = await service.upload(
        file,
        'user-123',
        FileModule.EXPENSES,
        'entity-456',
      );

      expect(result.module).toBe(FileModule.EXPENSES);
      expect(result.entityId).toBe('entity-456');
    });
  });

  describe('findOne', () => {
    it('should return file metadata by id', async () => {
      repo.findOne.mockResolvedValue(mockEntity);
      const result = await service.findOne(mockEntity.id);
      expect(result.id).toBe(mockEntity.id);
      expect(result.originalName).toBe('test.pdf');
    });

    it('should throw NotFoundException for missing file', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDownloadUrl', () => {
    it('should return presigned URL', async () => {
      repo.findOne.mockResolvedValue(mockEntity);
      const result = await service.getDownloadUrl(mockEntity.id);
      expect(result.url).toBe('https://minio.local/presigned-url');
      expect(result.filename).toBe('test.pdf');
      expect(storageService.getPresignedDownloadUrl).toHaveBeenCalledWith(
        mockEntity.storageKey,
        mockEntity.originalName,
      );
    });

    it('should throw NotFoundException for missing file', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.getDownloadUrl('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('softDelete', () => {
    it('should soft-delete a file', async () => {
      repo.findOne.mockResolvedValue({ ...mockEntity });
      await service.softDelete(mockEntity.id, 'user-123');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: FileStatus.DELETED }),
      );
      expect(repo.softRemove).toHaveBeenCalled();
    });

    it('should throw NotFoundException for missing file', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.softDelete('non-existent', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
