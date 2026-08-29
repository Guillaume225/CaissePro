import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';
import { Department } from '../entities/department.entity';
import { Service } from '../entities/service.entity';
import { User } from '../entities/user.entity';
import { CreateDepartmentDto, UpdateDepartmentDto, CreateServiceDto, UpdateServiceDto } from './dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  // ── Departments ──────────────────────────────────────────
  async findAllDepartments(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    return ds.getRepository(Department).find({ order: { name: 'ASC' } });
  }

  async createDepartment(dto: CreateDepartmentDto, tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Department);
    return repo.save(repo.create({ name: dto.name }));
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto, tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Department);
    const dept = await repo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');
    if (dto.name !== undefined) dept.name = dto.name;
    return repo.save(dept);
  }

  async removeDepartment(id: string, tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const inUse = await ds.getRepository(Service).count({ where: { departmentId: id } });
    if (inUse > 0) {
      throw new ConflictException('Ce département est encore rattaché à un ou plusieurs services');
    }
    const result = await ds.getRepository(Department).delete({ id });
    if (!result.affected) throw new NotFoundException('Department not found');
  }

  // ── Services ─────────────────────────────────────────────
  async findAllServices(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    return ds.getRepository(Service).find({ order: { name: 'ASC' } });
  }

  async createService(dto: CreateServiceDto, tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const dept = await ds.getRepository(Department).findOne({ where: { id: dto.departmentId } });
    if (!dept) throw new NotFoundException('Department not found');
    const repo = ds.getRepository(Service);
    const saved = await repo.save(repo.create({ name: dto.name, departmentId: dto.departmentId }));
    return { ...saved, department: dept };
  }

  async updateService(id: string, dto: UpdateServiceDto, tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Service);
    const svc = await repo.findOne({ where: { id } });
    if (!svc) throw new NotFoundException('Service not found');
    if (dto.name !== undefined) svc.name = dto.name;
    if (dto.departmentId !== undefined) {
      const dept = await ds.getRepository(Department).findOne({ where: { id: dto.departmentId } });
      if (!dept) throw new NotFoundException('Department not found');
      svc.departmentId = dto.departmentId;
    }
    return repo.save(svc);
  }

  async removeService(id: string, tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const inUse = await ds.getRepository(User).count({ where: { serviceId: id } });
    if (inUse > 0) {
      throw new ConflictException('Ce service est encore rattaché à un ou plusieurs utilisateurs');
    }
    const result = await ds.getRepository(Service).delete({ id });
    if (!result.affected) throw new NotFoundException('Service not found');
  }
}
