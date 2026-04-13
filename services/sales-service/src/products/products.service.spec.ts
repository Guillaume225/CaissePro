import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from '../entities/product.entity';
import { AuditService } from '../audit/audit.service';
import { CreateProductDto } from './dto';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockProduct: Partial<Product> = {
    id: 'p1',
    code: 'PROD-001',
    name: 'Test Product',
    description: 'A test product',
    category: 'General',
    unitPrice: 10000,
    vatRate: 18,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepo = {
    createQueryBuilder: jest.fn().mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockProduct], 1]),
    }),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: mockRepo },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated products with numeric fields', async () => {
      const result = await service.findAll({});
      expect(result.data).toHaveLength(1);
      expect(result.data[0].unitPrice).toBe(10000);
      expect(result.data[0].vatRate).toBe(18);
    });
  });

  describe('findById', () => {
    it('should return a product', async () => {
      mockRepo.findOne.mockResolvedValue(mockProduct);
      const result = await service.findById('p1');
      expect(result.code).toBe('PROD-001');
    });

    it('should throw NotFoundException', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a product', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce(null) // duplicatecheck
        .mockResolvedValueOnce({ ...mockProduct, id: 'p2' }); // findById
      mockRepo.create.mockReturnValue({ id: 'p2', ...mockProduct });
      mockRepo.save.mockResolvedValue({ id: 'p2', ...mockProduct });
      await service.create(
        { code: 'PROD-002', name: 'New', unitPrice: 5000 } as unknown as CreateProductDto,
        'user1',
      );
      expect(mockAudit.log).toHaveBeenCalled();
    });

    it('should reject duplicate code', async () => {
      mockRepo.findOne.mockResolvedValue(mockProduct);
      await expect(
        service.create({ code: 'PROD-001', name: 'Dup', unitPrice: 1000 } as unknown as CreateProductDto, 'user1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('toggleActive', () => {
    it('should toggle product isActive', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce({ ...mockProduct, isActive: true })
        .mockResolvedValueOnce({ ...mockProduct, isActive: false });
      mockRepo.save.mockResolvedValue({ ...mockProduct, isActive: false });
      await service.toggleActive('p1', 'user1');
      expect(mockAudit.log).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete a product', async () => {
      mockRepo.findOne.mockResolvedValue(mockProduct);
      mockRepo.softDelete.mockResolvedValue({ affected: 1 });
      await service.remove('p1', 'user1');
      expect(mockRepo.softDelete).toHaveBeenCalledWith('p1');
    });
  });
});
