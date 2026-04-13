import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { Client } from '../entities/client.entity';
import { AuditService } from '../audit/audit.service';

describe('ClientsService', () => {
  let service: ClientsService;

  const mockClient: Partial<Client> = {
    id: 'c1',
    name: 'Test Client',
    email: 'test@example.com',
    phone: '+225 01 02 03',
    address: '123 Rue',
    creditLimit: 500000 as any,
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
      getManyAndCount: jest.fn().mockResolvedValue([[mockClient], 1]),
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
        ClientsService,
        { provide: getRepositoryToken(Client), useValue: mockRepo },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated clients', async () => {
      const result = await service.findAll({});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return a client', async () => {
      mockRepo.findOne.mockResolvedValue(mockClient);
      const result = await service.findById('c1');
      expect(result.id).toBe('c1');
    });

    it('should throw NotFoundException', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and audit log a client', async () => {
      const dto = { name: 'New Client' };
      mockRepo.create.mockReturnValue({ id: 'c2', ...dto });
      mockRepo.save.mockResolvedValue({ id: 'c2', ...dto });
      const result = await service.create(dto as any, 'user1');
      expect(result.id).toBe('c2');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityType: 'client' }),
      );
    });
  });

  describe('update', () => {
    it('should update a client', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockClient });
      mockRepo.save.mockResolvedValue({ ...mockClient, name: 'Updated' });
      const result = await service.update('c1', { name: 'Updated' }, 'user1');
      expect(result.name).toBe('Updated');
      expect(mockAudit.log).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete a client', async () => {
      mockRepo.findOne.mockResolvedValue(mockClient);
      mockRepo.softDelete.mockResolvedValue({ affected: 1 });
      await service.remove('c1', 'user1');
      expect(mockRepo.softDelete).toHaveBeenCalledWith('c1');
    });
  });

  describe('getStatement', () => {
    it('should return client statement with summary', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockClient,
        sales: [
          {
            id: 's1',
            reference: 'VTE-2025-00001',
            date: '2025-01-01',
            totalTtc: 100000,
            amountPaid: 50000,
            status: 'CONFIRMED',
            payments: [
              {
                id: 'p1',
                reference: 'REC-2025-00001',
                amount: 50000,
                paymentMethod: 'CASH',
                paymentDate: '2025-01-02',
              },
            ],
          },
        ],
      });
      const result = await service.getStatement('c1');
      expect(result.summary.totalSales).toBe(100000);
      expect(result.summary.totalPaid).toBe(50000);
      expect(result.summary.outstanding).toBe(50000);
    });

    it('should throw if client not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.getStatement('bad')).rejects.toThrow(NotFoundException);
    });
  });
});
