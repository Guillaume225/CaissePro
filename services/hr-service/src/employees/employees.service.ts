import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { Employee } from './employee.entity';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto';
import { TenantDataSourceService, tenantSchema } from '../tenant/tenant-datasource.service';

@Injectable()
export class EmployeesService {
  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  async getDisbursementLimit(tenantId: string): Promise<number> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const s = tenantSchema(tenantId);
    const rows = await ds.query(`SELECT TOP 1 max_disbursement_amount FROM [${s}].[companies]`);
    return Number(rows?.[0]?.max_disbursement_amount ?? 0);
  }

  async loginByMatricule(tenantId: string, matricule: string, email: string): Promise<Employee> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Employee);
    const emp = await repo.findOne({
      where: {
        matricule: matricule.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        isActive: true,
      },
    });
    if (!emp) {
      throw new UnauthorizedException('Matricule ou email incorrect, ou compte désactivé');
    }
    return emp;
  }

  async findAll(tenantId: string): Promise<Employee[]> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Employee);
    return repo.find({ order: { lastName: 'ASC', firstName: 'ASC' } });
  }

  async findById(tenantId: string, id: string): Promise<Employee> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Employee);
    const emp = await repo.findOne({ where: { id } });
    if (!emp) throw new NotFoundException('Salarié introuvable');
    return emp;
  }

  async create(tenantId: string, dto: CreateEmployeeDto): Promise<Employee> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Employee);

    const exists = await repo.findOne({ where: { matricule: dto.matricule } });
    if (exists) {
      throw new ConflictException(`Le matricule ${dto.matricule} existe déjà`);
    }

    const emp = repo.create({
      matricule: dto.matricule,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      service: dto.service,
      position: dto.position,
      phone: dto.phone || null,
      isActive: true,
    });
    return repo.save(emp);
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Employee);
    const emp = await this.findById(tenantId, id);
    Object.assign(emp, dto);
    return repo.save(emp);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Employee);
    const emp = await this.findById(tenantId, id);
    await repo.remove(emp);
  }
}
