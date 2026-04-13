import { Test, TestingModule } from '@nestjs/testing';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileModule, FileStatus } from '../entities/file.entity';

const mockResponse = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  originalName: 'test.pdf',
  mimeType: 'application/pdf',
  extension: '.pdf',
  size: 1024,
  module: FileModule.GENERAL,
  entityId: null,
  status: FileStatus.ACTIVE,
  uploadedBy: 'user-123',
  thumbnailAvailable: false,
  createdAt: new Date(),
};

describe('FilesController', () => {
  let controller: FilesController;
  let filesService: {
    upload: jest.Mock;
    findOne: jest.Mock;
    getDownloadUrl: jest.Mock;
    softDelete: jest.Mock;
  };

  beforeEach(async () => {
    filesService = {
      upload: jest.fn(() => Promise.resolve(mockResponse)),
      findOne: jest.fn(() => Promise.resolve(mockResponse)),
      getDownloadUrl: jest.fn(() =>
        Promise.resolve({ url: 'https://minio.local/presigned', filename: 'test.pdf' }),
      ),
      softDelete: jest.fn(() => Promise.resolve()),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [{ provide: FilesService, useValue: filesService }],
    }).compile();

    controller = module.get(FilesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upload', () => {
    it('should call filesService.upload and return result', async () => {
      const file = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('data'),
      } as Express.Multer.File;

      const body = { module: FileModule.EXPENSES, entityId: 'ent-1' };
      const result = await controller.upload(file, body, 'user-123');

      expect(filesService.upload).toHaveBeenCalledWith(
        file,
        'user-123',
        FileModule.EXPENSES,
        'ent-1',
      );
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(mockResponse.id);
    });
  });

  describe('findOne', () => {
    it('should return file metadata', async () => {
      const result = await controller.findOne(mockResponse.id);
      expect(filesService.findOne).toHaveBeenCalledWith(mockResponse.id);
      expect(result.data.originalName).toBe('test.pdf');
    });
  });

  describe('getDownloadUrl', () => {
    it('should return presigned URL', async () => {
      const result = await controller.download(mockResponse.id);
      expect(filesService.getDownloadUrl).toHaveBeenCalledWith(mockResponse.id);
      expect(result.data.url).toBe('https://minio.local/presigned');
    });
  });

  describe('softDelete', () => {
    it('should call softDelete', async () => {
      await controller.remove(mockResponse.id, 'user-123');
      expect(filesService.softDelete).toHaveBeenCalledWith(mockResponse.id, 'user-123');
    });
  });
});
