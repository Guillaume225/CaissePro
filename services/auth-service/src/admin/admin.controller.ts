import { Controller, Get, Put, Body, Query } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getPermissionsMeta } from '../common/permissions';
import { AuditLog } from '../audit/audit-log.entity';

@Controller('settings')
export class SettingsController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async getSettings() {
    const [company] = await this.dataSource.query(`
      SELECT TOP 1 id, name, address, phone, email, tax_id AS taxId,
        logo AS logoUrl, currency, max_disbursement_amount AS maxDisbursementAmount
      FROM companies
    `);
    return {
      success: true,
      data: {
        ...(company || { currency: 'XAF' }),
        validation: {
          maxDisbursementAmount: Number(company?.maxDisbursementAmount ?? 0),
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Put()
  async updateSettings(
    @Body() dto: Record<string, unknown> & { validation?: { maxDisbursementAmount?: number } },
  ) {
    const [company] = await this.dataSource.query('SELECT TOP 1 id FROM companies');
    if (company) {
      const sets: string[] = [];
      const params: unknown[] = [company.id];
      let idx = 1;
      const map: Record<string, string> = {
        name: 'name',
        address: 'address',
        phone: 'phone',
        email: 'email',
        taxId: 'tax_id',
        currency: 'currency',
      };
      for (const [key, col] of Object.entries(map)) {
        if (dto[key] !== undefined) {
          sets.push(`${col} = @${idx}`);
          params.push(dto[key]);
          idx++;
        }
      }
      // Handle nested validation settings
      if (dto.validation?.maxDisbursementAmount !== undefined) {
        sets.push(`max_disbursement_amount = @${idx}`);
        params.push(dto.validation.maxDisbursementAmount);
        idx++;
      }
      if (sets.length) {
        await this.dataSource.query(
          `UPDATE companies SET ${sets.join(', ')} WHERE id = @0`,
          params,
        );
      }
    }
    return this.getSettings();
  }
}

@Controller('permissions')
export class PermissionsController {
  @Get()
  getPermissions() {
    return {
      success: true,
      data: getPermissionsMeta(),
      timestamp: new Date().toISOString(),
    };
  }
}

@Controller('audit/logs')
export class AuditLogsController {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  @Get()
  async getLogs(
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('userId') userId?: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 50,
  ) {
    const qb = this.auditRepo.createQueryBuilder('log').orderBy('log.timestamp', 'DESC');

    if (action) {
      qb.andWhere('log.action = :action', { action });
    }
    if (entityType) {
      qb.andWhere('log.entity_type = :entityType', { entityType });
    }
    if (userId) {
      qb.andWhere('log.user_id = :userId', { userId });
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * perPage)
      .take(perPage)
      .getMany();

    return {
      success: true,
      data,
      meta: {
        page: Number(page),
        perPage: Number(perPage),
        total,
        totalPages: Math.ceil(total / perPage),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
