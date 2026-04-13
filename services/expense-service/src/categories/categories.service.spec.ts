import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CategoriesService } from './categories.service';
import { ExpenseCategory } from '../entities/expense-category.entity';
import { AuditService } from '../audit/audit.service';

const mockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockAuditService = () => ({
  log: jest.fn(),
});

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repo: ReturnType<typeof mockRepository>;
  let audit: ReturnType<typeof mockAuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getRepositoryToken(ExpenseCategory), useFactory: mockRepository },
        { provide: AuditService, useFactory: mockAuditService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    repo = module.get(getRepositoryToken(ExpenseCategory));
    audit = module.get(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return tree of categories', async () => {
      const cats = [
        { id: '1', name: 'Parent', code: 'PAR', parentId: null, isActive: true, children: [] },
        { id: '2', name: 'Child', code: 'CHI', parentId: '1', isActive: true, children: [] },
      ];
      repo.find.mockResolvedValue(cats);

      const result = await service.findAll();
      expect(repo.find).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findById', () => {
    it('should return a category', async () => {
      const cat = { id: '1', name: 'Test', code: 'TST', isActive: true, parentId: null };
      repo.findOne.mockResolvedValue(cat);
      repo.find.mockResolvedValue([cat]);

      const result = await service.findById('1');
      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });

    it('should throw if not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById('999')).rejects.toThrow('Category not found');
    });
  });

  describe('create', () => {
    it('should create a category', async () => {
      const savedCat = { id: '1', name: 'New', code: 'NEW', isActive: true, parentId: null };
      repo.findOne
        .mockResolvedValueOnce(null) // code check
        .mockResolvedValueOnce(savedCat); // findById after create
      repo.create.mockReturnValue(savedCat);
      repo.save.mockResolvedValue(savedCat);
      repo.find.mockResolvedValue([savedCat]); // for toTree in findById

      await service.create({ name: 'New', code: 'NEW' }, 'user-1');
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalled();
    });

    it('should throw if code already exists', async () => {
      repo.findOne.mockResolvedValue({ id: '1', code: 'DUP' });
      await expect(service.create({ name: 'Dup', code: 'DUP' }, 'user-1')).rejects.toThrow();
    });
  });
});
