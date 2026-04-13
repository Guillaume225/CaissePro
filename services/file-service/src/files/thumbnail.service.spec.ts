import { Test, TestingModule } from '@nestjs/testing';
import { ThumbnailService } from './thumbnail.service';

describe('ThumbnailService', () => {
  let service: ThumbnailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThumbnailService],
    }).compile();

    service = module.get(ThumbnailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isImage', () => {
    it('should return true for image/jpeg', () => {
      expect(service.isImage('image/jpeg')).toBe(true);
    });

    it('should return true for image/png', () => {
      expect(service.isImage('image/png')).toBe(true);
    });

    it('should return false for application/pdf', () => {
      expect(service.isImage('application/pdf')).toBe(false);
    });

    it('should return false for text/plain', () => {
      expect(service.isImage('text/plain')).toBe(false);
    });
  });
});
