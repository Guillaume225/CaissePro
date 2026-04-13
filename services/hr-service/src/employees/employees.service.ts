import { Injectable, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Employee } from './employee.entity';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly repo: Repository<Employee>,
    private readonly dataSource: DataSource,
  ) {}

  async getDisbursementLimit(): Promise<number> {
    const rows = await this.dataSource.query(
      'SELECT TOP 1 max_disbursement_amount FROM companies',
    );
    return Number(rows?.[0]?.max_disbursement_amount ?? 0);
  }

  async loginByMatricule(matricule: string, email: string): Promise<Employee> {
    const emp = await this.repo.findOne({
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
    return this.repo.find({
      where: { tenantId },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async findById(tenantId: string, id: string): Promise<Employee> {
    const emp = await this.repo.findOne({ where: { id, tenantId } });
    if (!emp) throw new NotFoundException('Salarié introuvable');
    return emp;
  }

  async create(tenantId: string, dto: CreateEmployeeDto): Promise<Employee> {
    const exists = await this.repo.findOne({
      where: { tenantId, matricule: dto.matricule },
    });
    if (exists) {
      throw new ConflictException(`Le matricule ${dto.matricule} existe déjà`);
    }

    const emp = this.repo.create({
      tenantId,
      matricule: dto.matricule,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      service: dto.service,
      position: dto.position,
      phone: dto.phone || null,
      isActive: true,
    });
    return this.repo.save(emp);
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    const emp = await this.findById(tenantId, id);
    Object.assign(emp, dto);
    return this.repo.save(emp);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const emp = await this.findById(tenantId, id);
    await this.repo.remove(emp);
  }
}
