import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReceivablesService } from './receivables.service';
import { Permissions } from '../common/decorators';
import { RECEIVABLE_PERMISSIONS } from '../common/permissions';
import { ListReceivablesQueryDto } from './dto';

@Controller('receivables')
export class ReceivablesController {
  constructor(private readonly receivablesService: ReceivablesService) {}

  @Get('aging-report')
  @Permissions(RECEIVABLE_PERMISSIONS.READ)
  getAgingReport() {
    return this.receivablesService.getAgingReport();
  }

  @Get()
  @Permissions(RECEIVABLE_PERMISSIONS.READ)
  findAll(@Query() query: ListReceivablesQueryDto) {
    return this.receivablesService.findAll(query);
  }

  @Get(':id')
  @Permissions(RECEIVABLE_PERMISSIONS.READ)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.receivablesService.findById(id);
  }
}
