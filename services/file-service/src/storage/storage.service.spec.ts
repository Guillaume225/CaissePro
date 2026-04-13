import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './storage.service';

// Mock the AWS SDK
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: jest.fn().mockImplementation((params) => ({
      ...params,
      _type: 'PutObjectCommand',
    })),
    DeleteObjectCommand: jest.fn().mockImplementation((params) => ({
      ...params,
      _type: 'DeleteObjectCommand',
    })),
    GetObjectCommand: jest.fn().mockImplementation((params) => ({
      ...params,
      _type: 'GetObjectCommand',
    })),
    HeadBucketCommand: jest.fn().mockImplementation((params) => ({
      ...params,
      _type: 'HeadBucketCommand',
    })),
    CreateBucketCommand: jest.fn().mockImplementation((params) => ({
      ...params,
      _type: 'CreateBucketCommand',
    })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(() => Promise.resolve('https://minio.local/presigned-url')),
}));

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, unknown> = {
                'minio.endpoint': 'http://localhost:9000',
                'minio.accessKey': 'minioadmin',
                'minio.secretKey': 'minioadmin',
                'minio.bucket': 'test-bucket',
                'minio.region': 'us-east-1',
                'minio.presignedUrlExpiry': 3600,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should create bucket if it does not exist', async () => {
      mockSend.mockRejectedValueOnce({ name: 'NotFound' });
      mockSend.mockResolvedValueOnce({});

      await service.onModuleInit();

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should skip creation if bucket exists', async () => {
      mockSend.mockResolvedValueOnce({});

      await service.onModuleInit();

      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('upload', () => {
    it('should send PutObjectCommand', async () => {
      const buffer = Buffer.from('test data');
      await service.upload('test-key', buffer, 'application/pdf');

      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ _type: 'PutObjectCommand' }));
    });
  });

  describe('delete', () => {
    it('should send DeleteObjectCommand', async () => {
      await service.delete('test-key');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ _type: 'DeleteObjectCommand' }),
      );
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('should return presigned URL', async () => {
      const url = await service.getPresignedDownloadUrl('test-key', 'doc.pdf');

      expect(getSignedUrl).toHaveBeenCalled();
      expect(url).toBe('https://minio.local/presigned-url');
    });
  });
});
