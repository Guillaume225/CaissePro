import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FileValidationService } from './file-validation.service';

function mockFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('%PDF-1.4 fake pdf content'),
    stream: null as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

// Minimal PDF magic bytes
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-

// PNG magic bytes
const PNG_MAGIC = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  // minimal IHDR
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde,
]);

// JPEG magic bytes
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

describe('FileValidationService', () => {
  let service: FileValidationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileValidationService],
    }).compile();

    service = module.get(FileValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validate', () => {
    it('should reject files exceeding max size', async () => {
      const file = mockFile({ size: 11_000_000 });
      await expect(service.validate(file, 10_485_760)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject disallowed extensions', async () => {
      const file = mockFile({ originalname: 'malware.exe', size: 100 });
      await expect(service.validate(file, 10_485_760)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept valid PDF files', async () => {
      const file = mockFile({
        originalname: 'invoice.pdf',
        mimetype: 'application/pdf',
        buffer: PDF_MAGIC,
        size: 1024,
      });
      const result = await service.validate(file, 10_485_760);
      expect(result.extension).toBe('.pdf');
    });

    it('should accept valid PNG files', async () => {
      const file = mockFile({
        originalname: 'photo.png',
        mimetype: 'image/png',
        buffer: PNG_MAGIC,
        size: 1024,
      });
      const result = await service.validate(file, 10_485_760);
      expect(result.extension).toBe('.png');
      expect(result.detectedMime).toBe('image/png');
    });

    it('should accept valid JPEG files', async () => {
      const file = mockFile({
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: JPEG_MAGIC,
        size: 1024,
      });
      const result = await service.validate(file, 10_485_760);
      expect(result.extension).toBe('.jpg');
    });

    it('should reject MIME spoofing (exe hidden as .pdf)', async () => {
      // PE header (MZ) disguised as pdf
      const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
      const file = mockFile({
        originalname: 'malware.pdf',
        mimetype: 'application/pdf',
        buffer: exeBuffer,
        size: 100,
      });
      await expect(service.validate(file, 10_485_760)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when extension does not match detected MIME', async () => {
      // PNG content disguised as .pdf
      const file = mockFile({
        originalname: 'fake.pdf',
        mimetype: 'application/pdf',
        buffer: PNG_MAGIC,
        size: 100,
      });
      await expect(service.validate(file, 10_485_760)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
