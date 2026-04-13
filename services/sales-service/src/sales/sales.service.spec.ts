import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SalesService, SalesUser } from './sales.service';
import { Sale } from '../entities/sale.entity';
import { SaleItem } from '../entities/sale-item.entity';
import { Product } from '../entities/product.entity';
import { Client } from '../entities/client.entity';
import { Receivable } from '../entities/receivable.entity';
import { SaleStatus, AgingBucket } from '../entities/enums';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../events/events.service';

const USER: SalesUser = {
  id: 'u1',
  email: 'seller@test.com',
  roleName: 'COMMERCIAL',
  permissions: [],
  departmentId: 'd1',
};

describe('SalesService', () => {
  let service: SalesService;

  const mockSale: Partial<Sale> = {
    id: 's1',
    reference: 'VTE-2025-00001',
    date: '2025-01-15' as any,
    clientId: 'c1',
    status: SaleStatus.DRAFT,
    subtotalHt: 10000 as any,
    discountAmount: 0 as any,
    totalVat: 1800 as any,
    totalTtc: 11800 as any,
    amountPaid: 0 as any,
    globalDiscountPct: 0 as any,
    notes: null,
    createdById: 'u1',
    dueDate: '2025-02-15',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockClient: Partial<Client> = {
    id: 'c1',
    name: 'Test Client',
    isActive: true,
  };

  const mockProduct: Partial<Product> = {
    id: 'prod1',
    code: 'P001',
    name: 'Article',
    unitPrice: 10000 as any,
    vatRate: 18 as any,
    isActive: true,
  };

  const mockSaleRepo = {
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    }),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockItemRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockProductRepo = { findOne: jest.fn() };
  const mockClientRepo = { findOne: jest.fn() };
  const mockReceivableRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
  const mockEvents = { publish: jest.fn().mockResolvedValue(undefined) };
  const mockConfig = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'sales.discountCeilings')
        return { COMMERCIAL: 10, MANAGER: 20, DAF: 100, ADMIN: 100 };
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Sale), useValue: mockSaleRepo },
        { provide: getRepositoryToken(SaleItem), useValue: mockItemRepo },
        { provide: getRepositoryToken(Product), useValue: mockProductRepo },
        { provide: getRepositoryToken(Client), useValue: mockClientRepo },
        { provide: getRepositoryToken(Receivable), useValue: mockReceivableRepo },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventsService, useValue: mockEvents },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a sale with auto-calculated totals', async () => {
      mockClientRepo.findOne.mockResolvedValue(mockClient);
      mockProductRepo.findOne.mockResolvedValue(mockProduct);
      mockSaleRepo.create.mockReturnValue({ id: 's2' });
      mockSaleRepo.save.mockResolvedValue({ id: 's2' });
      mockItemRepo.create.mockReturnValue({});
      mockItemRepo.save.mockResolvedValue([]);
      // findById call
      mockSaleRepo.findOne.mockResolvedValue({
        ...mockSale,
        id: 's2',
        client: mockClient,
        items: [{ ...mockProduct, quantity: 2, lineTotalHt: 20000, lineVat: 3600, lineTotalTtc: 23600, product: mockProduct }],
        payments: [],
        receivable: null,
      });

      const result = await service.create(
        {
          date: '2025-01-15',
          clientId: 'c1',
          items: [{ productId: 'prod1', quantity: 2 }],
        },
        USER,
      );

      expect(mockSaleRepo.save).toHaveBeenCalled();
      expect(mockItemRepo.save).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityType: 'sale' }),
      );
      expect(mockEvents.publish).toHaveBeenCalledWith(
        'sale.created',
        expect.objectContaining({ saleId: 's2' }),
      );
    });

    it('should reject inactive client', async () => {
      mockClientRepo.findOne.mockResolvedValue({ ...mockClient, isActive: false });
      await expect(
        service.create(
          { date: '2025-01-15', clientId: 'c1', items: [{ productId: 'prod1', quantity: 1 }] },
          USER,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject discount exceeding role ceiling', async () => {
      mockClientRepo.findOne.mockResolvedValue(mockClient);
      await expect(
        service.create(
          {
            date: '2025-01-15',
            clientId: 'c1',
            items: [{ productId: 'prod1', quantity: 1 }],
            globalDiscountPct: 15, // COMMERCIAL ceiling is 10
          },
          USER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow a MANAGER 20% discount', async () => {
      mockClientRepo.findOne.mockResolvedValue(mockClient);
      mockProductRepo.findOne.mockResolvedValue(mockProduct);
      mockSaleRepo.create.mockReturnValue({ id: 's3' });
      mockSaleRepo.save.mockResolvedValue({ id: 's3' });
      mockItemRepo.create.mockReturnValue({});
      mockItemRepo.save.mockResolvedValue([]);
      mockSaleRepo.findOne.mockResolvedValue({
        ...mockSale,
        id: 's3',
        client: mockClient,
        items: [],
        payments: [],
        receivable: null,
      });

      await expect(
        service.create(
          {
            date: '2025-01-15',
            clientId: 'c1',
            items: [{ productId: 'prod1', quantity: 1 }],
            globalDiscountPct: 20,
          },
          { ...USER, roleName: 'MANAGER' },
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('update', () => {
    it('should only update DRAFT sales', async () => {
      mockSaleRepo.findOne.mockResolvedValue({ ...mockSale, status: SaleStatus.CONFIRMED });
      await expect(
        service.update('s1', { notes: 'test' }, USER),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirm', () => {
    it('should transition DRAFT → CONFIRMED and create receivable', async () => {
      mockSaleRepo.findOne
        .mockResolvedValueOnce({ ...mockSale, status: SaleStatus.DRAFT }) // confirm
        .mockResolvedValueOnce({
          ...mockSale,
          status: SaleStatus.CONFIRMED,
          client: mockClient,
          items: [],
          payments: [],
          receivable: { id: 'r1', totalAmount: 11800, paidAmount: 0, outstandingAmount: 11800, dueDate: '2025-02-15', agingBucket: 'CURRENT', isSettled: false },
        }); // findById
      mockSaleRepo.save.mockResolvedValue({ ...mockSale, status: SaleStatus.CONFIRMED });
      mockReceivableRepo.create.mockReturnValue({ id: 'r1' });
      mockReceivableRepo.save.mockResolvedValue({ id: 'r1' });

      const result = await service.confirm('s1', USER);
      expect(result.status).toBe(SaleStatus.CONFIRMED);
      expect(mockReceivableRepo.save).toHaveBeenCalled();
      expect(mockEvents.publish).toHaveBeenCalledWith(
        'sale.confirmed',
        expect.objectContaining({ saleId: 's1' }),
      );
    });

    it('should reject non-DRAFT', async () => {
      mockSaleRepo.findOne.mockResolvedValue({ ...mockSale, status: SaleStatus.PAID });
      await expect(service.confirm('s1', USER)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should soft delete DRAFT sales', async () => {
      mockSaleRepo.findOne.mockResolvedValue({ ...mockSale, status: SaleStatus.DRAFT });
      mockItemRepo.delete.mockResolvedValue({ affected: 1 });
      mockSaleRepo.softDelete.mockResolvedValue({ affected: 1 });
      await service.remove('s1', 'u1');
      expect(mockSaleRepo.softDelete).toHaveBeenCalledWith('s1');
    });

    it('should reject non-DRAFT', async () => {
      mockSaleRepo.findOne.mockResolvedValue({ ...mockSale, status: SaleStatus.CONFIRMED });
      await expect(service.remove('s1', 'u1')).rejects.toThrow(BadRequestException);
    });
  });
});
