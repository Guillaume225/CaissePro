import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Payment } from '../entities/payment.entity';
import { Sale } from '../entities/sale.entity';
import { Receivable } from '../entities/receivable.entity';
import { SaleStatus, PaymentMethod } from '../entities/enums';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../events/events.service';

describe('PaymentsService', () => {
  let service: PaymentsService;

  const mockSale: Partial<Sale> = {
    id: 's1',
    reference: 'VTE-2025-00001',
    clientId: 'c1',
    totalTtc: 11800,
    amountPaid: 0,
    status: SaleStatus.CONFIRMED,
  };

  const mockPayment: Partial<Payment> = {
    id: 'pay1',
    reference: 'REC-2025-00001',
    saleId: 's1',
    clientId: 'c1',
    amount: 5000,
    paymentMethod: PaymentMethod.CASH,
    paymentDate: '2025-01-20',
    createdAt: new Date(),
  };

  const mockPaymentRepo = {
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
  };

  const mockSaleRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockReceivableRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
  const mockEvents = { publish: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(Sale), useValue: mockSaleRepo },
        { provide: getRepositoryToken(Receivable), useValue: mockReceivableRepo },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventsService, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should record a partial payment and update sale status', async () => {
      mockSaleRepo.findOne.mockResolvedValue({ ...mockSale });
      mockPaymentRepo.create.mockReturnValue({ id: 'pay1' });
      mockPaymentRepo.save.mockResolvedValue({ id: 'pay1' });
      mockSaleRepo.save.mockResolvedValue({});
      mockReceivableRepo.findOne.mockResolvedValue({
        id: 'r1',
        totalAmount: 11800,
        paidAmount: 0,
        outstandingAmount: 11800,
      });
      mockReceivableRepo.save.mockResolvedValue({});
      mockPaymentRepo.findOne.mockResolvedValue({
        ...mockPayment,
        sale: mockSale,
        client: { name: 'Test Client' },
      });

      await service.create(
        {
          saleId: 's1',
          amount: 5000,
          paymentMethod: PaymentMethod.CASH,
          paymentDate: '2025-01-20',
        },
        'user1',
      );

      expect(mockSaleRepo.save).toHaveBeenCalled();
      // Sale should be PARTIALLY_PAID (5000 < 11800)
      const savedSale = mockSaleRepo.save.mock.calls[0][0];
      expect(savedSale.status).toBe(SaleStatus.PARTIALLY_PAID);
      expect(mockEvents.publish).toHaveBeenCalledWith(
        'payment.received',
        expect.objectContaining({ saleId: 's1' }),
      );
    });

    it('should mark sale as PAID when fully paid', async () => {
      mockSaleRepo.findOne.mockResolvedValue({ ...mockSale, amountPaid: 0 });
      mockPaymentRepo.create.mockReturnValue({ id: 'pay2' });
      mockPaymentRepo.save.mockResolvedValue({ id: 'pay2' });
      mockSaleRepo.save.mockResolvedValue({});
      mockReceivableRepo.findOne.mockResolvedValue({
        id: 'r1',
        totalAmount: 11800,
        paidAmount: 0,
        outstandingAmount: 11800,
      });
      mockReceivableRepo.save.mockResolvedValue({});
      mockPaymentRepo.findOne.mockResolvedValue({
        ...mockPayment,
        amount: 11800,
        sale: mockSale,
        client: { name: 'Test Client' },
      });

      await service.create(
        {
          saleId: 's1',
          amount: 11800,
          paymentMethod: PaymentMethod.TRANSFER,
          paymentDate: '2025-01-20',
        },
        'user1',
      );

      const savedSale = mockSaleRepo.save.mock.calls[0][0];
      expect(savedSale.status).toBe(SaleStatus.PAID);
    });

    it('should reject payment on DRAFT sale', async () => {
      mockSaleRepo.findOne.mockResolvedValue({ ...mockSale, status: SaleStatus.DRAFT });
      await expect(
        service.create(
          {
            saleId: 's1',
            amount: 5000,
            paymentMethod: PaymentMethod.CASH,
            paymentDate: '2025-01-20',
          },
          'user1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject overpayment', async () => {
      mockSaleRepo.findOne.mockResolvedValue({ ...mockSale, amountPaid: 10000 });
      await expect(
        service.create(
          {
            saleId: 's1',
            amount: 5000,
            paymentMethod: PaymentMethod.CASH,
            paymentDate: '2025-01-20',
          },
          'user1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
