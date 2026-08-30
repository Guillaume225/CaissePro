import { Controller, Get, Query } from '@nestjs/common';
import { Permissions, CurrentUser } from '../common/decorators';
import { DA_PERMISSIONS } from '../common/permissions';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  /** Pour la sélection d'un fournisseur déjà utilisé, à l'étape "Proposition d'achat". */
  @Get()
  @Permissions(DA_PERMISSIONS.PROCESS)
  search(@CurrentUser('tenantId') tenantId: string, @Query('search') search?: string) {
    return this.service.search(tenantId, search);
  }
}
