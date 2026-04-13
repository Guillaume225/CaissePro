import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SelectQueryBuilder } from 'typeorm';
import * as crypto from 'crypto';
import { AuditLogsService } from '@/audit-logs/audit-logs.service';
import { AuditLog } from '@/entities/audit-log.entity';
import { ExportFormat } from '@/audit-logs/dto';

describe('AuditLogsService', () => {
  let service: AuditLogsService;
  let qb: jest.Mocked<Partial<SelectQueryBuilder<AuditLog>>>;
  let repo: Record<string, jest.Mock>;

  const HMAC_SECRET = 'test-hmac-secret';

  function makeEntry(overrides: Partial<AuditLog> = {}): AuditLog {
    const entry = new AuditLog();
    entry.id = 'log-1';
    entry.sourceService = 'expense-service';
    entry.eventType = 'expense.created';
    entry.userId = 'user-1';
    entry.action = 'CREATE';
    entry.entityType = 'expense';
    entry.entityId = 'exp-1';
    entry.payload = { amount: 1000 };
    entry.ipAddress = null;
    entry.timestamp = new Date('2024-01-15T10:00:00Z');
    Object.assign(entry, overrides);

    // Compute valid signature
    const canonical = JSON.stringify({
      sourceService: entry.sourceService,
      eventType: entry.eventType,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      payload: entry.payload,
    });
    entry.signature = crypto.createHmac('sha256', HMAC_SECRET).update(canonical).digest('hex');
    return entry;
  }

  beforeEach(async () => {
    qb = {
      andWhere: jest.fn().mockReturnThis() as jest.Mocked<
        Partial<SelectQueryBuilder<AuditLog>>
      >['andWhere'],
      orderBy: jest.fn().mockReturnThis() as jest.Mocked<
        Partial<SelectQueryBuilder<AuditLog>>
      >['orderBy'],
      skip: jest.fn().mockReturnThis() as jest.Mocked<
        Partial<SelectQueryBuilder<AuditLog>>
      >['skip'],
      take: jest.fn().mockReturnThis() as jest.Mocked<
        Partial<SelectQueryBuilder<AuditLog>>
      >['take'],
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]) as jest.Mocked<
        Partial<SelectQueryBuilder<AuditLog>>
      >['getManyAndCount'],
      getMany: jest.fn().mockResolvedValue([]) as jest.Mocked<
        Partial<SelectQueryBuilder<AuditLog>>
      >['getMany'],
    };

    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: repo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: unknown) => {
              const map: Record<string, unknown> = {
                'audit.hmacSecret': HMAC_SECRET,
                'audit.retentionYears': 10,
              };
              return map[key] ?? defaultVal;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(AuditLogsService);
  });

  /* ------------------------------------------------------------------ */
  /*  findAll                                                           */
  /* ------------------------------------------------------------------ */

  describe('findAll', () => {
    it('should return paginated results with defaults', async () => {
      const entries = [makeEntry()];
      (qb.getManyAndCount as jest.Mock).mockResolvedValueOnce([entries, 1]);

      const result = await service.findAll({});

      expect(result.data).toEqual(entries);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
    });

    it('should apply page and perPage', async () => {
      (qb.getManyAndCount as jest.Mock).mockResolvedValueOnce([[], 50]);

      const result = await service.findAll({ page: 3, perPage: 10 });

      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result.totalPages).toBe(5);
    });

    it('should apply userId filter', async () => {
      (qb.getManyAndCount as jest.Mock).mockResolvedValueOnce([[], 0]);

      await service.findAll({ userId: 'user-1' });

      expect(qb.andWhere).toHaveBeenCalledWith('log.userId = :userId', { userId: 'user-1' });
    });

    it('should apply action filter', async () => {
      (qb.getManyAndCount as jest.Mock).mockResolvedValueOnce([[], 0]);

      await service.findAll({ action: 'CREATE' });

      expect(qb.andWhere).toHaveBeenCalledWith('log.action = :action', { action: 'CREATE' });
    });

    it('should apply entityType and entityId filters', async () => {
      (qb.getManyAndCount as jest.Mock).mockResolvedValueOnce([[], 0]);

      await service.findAll({ entityType: 'expense', entityId: 'exp-1' });

      expect(qb.andWhere).toHaveBeenCalledWith('log.entityType = :entityType', {
        entityType: 'expense',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('log.entityId = :entityId', { entityId: 'exp-1' });
    });

    it('should apply sourceService filter', async () => {
      (qb.getManyAndCount as jest.Mock).mockResolvedValueOnce([[], 0]);

      await service.findAll({ sourceService: 'expense-service' });

      expect(qb.andWhere).toHaveBeenCalledWith('log.sourceService = :sourceService', {
        sourceService: 'expense-service',
      });
    });

    it('should apply date range filters', async () => {
      (qb.getManyAndCount as jest.Mock).mockResolvedValueOnce([[], 0]);

      await service.findAll({ dateFrom: '2024-01-01', dateTo: '2024-12-31' });

      expect(qb.andWhere).toHaveBeenCalledWith('log.timestamp >= :dateFrom', {
        dateFrom: '2024-01-01',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('log.timestamp <= :dateTo', {
        dateTo: '2024-12-31',
      });
    });

    it('should apply search filter', async () => {
      (qb.getManyAndCount as jest.Mock).mockResolvedValueOnce([[], 0]);

      await service.findAll({ search: 'expense' });

      expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), {
        search: '%expense%',
      });
    });

    it('should sanitize sortBy to allowed fields', async () => {
      (qb.getManyAndCount as jest.Mock).mockResolvedValueOnce([[], 0]);

      await service.findAll({ sortBy: 'DROP TABLE', sortOrder: 'ASC' });

      expect(qb.orderBy).toHaveBeenCalledWith('log.timestamp', 'ASC');
    });

    it('should accept valid sortBy', async () => {
      (qb.getManyAndCount as jest.Mock).mockResolvedValueOnce([[], 0]);

      await service.findAll({ sortBy: 'action', sortOrder: 'ASC' });

      expect(qb.orderBy).toHaveBeenCalledWith('log.action', 'ASC');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  findByEntity                                                      */
  /* ------------------------------------------------------------------ */

  describe('findByEntity', () => {
    it('should query by entityType and entityId ordered by timestamp ASC', async () => {
      const entries = [makeEntry(), makeEntry({ id: 'log-2', action: 'APPROVE' })];
      repo.find.mockResolvedValueOnce(entries);

      const result = await service.findByEntity('expense', 'exp-1');

      expect(repo.find).toHaveBeenCalledWith({
        where: { entityType: 'expense', entityId: 'exp-1' },
        order: { timestamp: 'ASC' },
      });
      expect(result).toEqual(entries);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  exportLogs                                                        */
  /* ------------------------------------------------------------------ */

  describe('exportLogs', () => {
    it('should export CSV by default', async () => {
      const entries = [makeEntry()];
      (qb.getMany as jest.Mock).mockResolvedValueOnce(entries);

      const result = await service.exportLogs({});

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toMatch(/^audit-logs-.*\.csv$/);
      expect(result.data).toContain('sourceService');
      expect(result.data).toContain('expense-service');
    });

    it('should export JSON when requested', async () => {
      const entries = [makeEntry()];
      (qb.getMany as jest.Mock).mockResolvedValueOnce(entries);

      const result = await service.exportLogs({ format: ExportFormat.JSON });

      expect(result.contentType).toBe('application/json');
      expect(result.filename).toMatch(/^audit-logs-.*\.json$/);
      const parsed = JSON.parse(result.data);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].sourceService).toBe('expense-service');
    });

    it('should apply filters to export query', async () => {
      (qb.getMany as jest.Mock).mockResolvedValueOnce([]);

      await service.exportLogs({ userId: 'user-1', action: 'CREATE' });

      expect(qb.andWhere).toHaveBeenCalledWith('log.userId = :userId', { userId: 'user-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('log.action = :action', { action: 'CREATE' });
    });

    it('should limit export to 50000 rows', async () => {
      (qb.getMany as jest.Mock).mockResolvedValueOnce([]);

      await service.exportLogs({});

      expect(qb.take).toHaveBeenCalledWith(50_000);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  verifySignature                                                   */
  /* ------------------------------------------------------------------ */

  describe('verifySignature', () => {
    it('should return true for a valid signature', () => {
      const entry = makeEntry();
      expect(service.verifySignature(entry)).toBe(true);
    });

    it('should return false for a tampered entry', () => {
      const entry = makeEntry();
      entry.action = 'TAMPERED';
      expect(service.verifySignature(entry)).toBe(false);
    });

    it('should return false for a modified payload', () => {
      const entry = makeEntry();
      entry.payload = { amount: 999999 };
      expect(service.verifySignature(entry)).toBe(false);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  purgeExpiredLogs                                                  */
  /* ------------------------------------------------------------------ */

  describe('purgeExpiredLogs', () => {
    it('should delete logs older than retention years', async () => {
      repo.delete.mockResolvedValueOnce({ affected: 5 });

      await service.purgeExpiredLogs();

      expect(repo.delete).toHaveBeenCalledTimes(1);
      const deleteArg = repo.delete.mock.calls[0][0];
      expect(deleteArg.timestamp).toBeDefined();
    });

    it('should not log when no entries purged', async () => {
      repo.delete.mockResolvedValueOnce({ affected: 0 });

      await service.purgeExpiredLogs();

      expect(repo.delete).toHaveBeenCalledTimes(1);
    });
  });
});
