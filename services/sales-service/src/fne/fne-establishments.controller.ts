import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  FneEstablishmentsService,
  CreateFneEstablishmentDto,
  UpdateFneEstablishmentDto,
  ListFneEstablishmentsQuery,
} from './fne-establishments.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';

@Controller('fne-establishments')
export class FneEstablishmentsController {
  constructor(private readonly service: FneEstablishmentsService) {}

  @Get()
  @Permissions(FNE_PERMISSIONS.READ)
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ListFneEstablishmentsQuery,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.service.findAll(tenantId, query, companyId);
  }

  @Get(':id')
  @Permissions(FNE_PERMISSIONS.READ)
  findById(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(tenantId, id);
  }

  @Post()
  @Permissions(FNE_PERMISSIONS.CREATE)
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateFneEstablishmentDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.service.create(tenantId, dto, companyId);
  }

  @Put(':id')
  @Permissions(FNE_PERMISSIONS.CREATE)
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFneEstablishmentDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Permissions(FNE_PERMISSIONS.CREATE)
  delete(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(tenantId, id);
  }
}
