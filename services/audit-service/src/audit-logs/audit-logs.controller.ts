import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '@/common/decorators';
import { RolesGuard } from '@/common/guards';
import { AuditLogsService } from './audit-logs.service';
import { ListAuditLogsQueryDto, ExportAuditLogsQueryDto } from './dto';

@Controller('audit')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'DAF', 'AUDITEUR')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  /**
   * GET /api/v1/audit/logs — paginated list with filters
   */
  @Get('logs')
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: ListAuditLogsQueryDto) {
    return this.auditLogsService.findAll(query);
  }

  /**
   * GET /api/v1/audit/logs/export — CSV/JSON export
   */
  @Get('logs/export')
  async exportLogs(
    @Query() query: ExportAuditLogsQueryDto,
    @Res() res: Response,
  ) {
    const result = await this.auditLogsService.exportLogs(query);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.data);
  }

  /**
   * GET /api/v1/audit/entity/:type/:id — complete entity history
   */
  @Get('entity/:type/:id')
  @HttpCode(HttpStatus.OK)
  async entityHistory(
    @Param('type') entityType: string,
    @Param('id') entityId: string,
  ) {
    return this.auditLogsService.findByEntity(entityType, entityId);
  }
}
