import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsController } from '@/audit-logs/audit-logs.controller';
import { AuditLogsService } from '@/audit-logs/audit-logs.service';
import { ExportFormat } from '@/audit-logs/dto';

describe('AuditLogsController', () => {
  let controller: AuditLogsController;
  let service: jest.Mocked<Partial<AuditLogsService>>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        perPage: 20,
        totalPages: 0,
      }),
      findByEntity: jest.fn().mockResolvedValue([]),
      exportLogs: jest.fn().mockResolvedValue({
        contentType: 'text/csv',
        filename: 'audit-logs-test.csv',
        data: 'id,sourceService\n',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogsController],
      providers: [
        { provide: AuditLogsService, useValue: service },
      ],
    }).compile();

    controller = module.get(AuditLogsController);
  });

  describe('findAll', () => {
    it('should call service.findAll with query', async () => {
      const query = { page: 2, perPage: 10, action: 'CREATE' };
      await controller.findAll(query);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should return paginated result', async () => {
      const result = await controller.findAll({});
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
    });
  });

  describe('exportLogs', () => {
    it('should set correct headers and send data', async () => {
      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as import('express').Response;

      await controller.exportLogs({ format: ExportFormat.CSV }, res);

      expect(service.exportLogs).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename='),
      );
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('entityHistory', () => {
    it('should call service.findByEntity', async () => {
      await controller.entityHistory('expense', 'exp-1');
      expect(service.findByEntity).toHaveBeenCalledWith('expense', 'exp-1');
    });
  });
});
