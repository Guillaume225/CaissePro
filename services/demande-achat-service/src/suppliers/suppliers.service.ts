import { Injectable } from '@nestjs/common';
import { Like } from 'typeorm';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';
import { Supplier } from '../entities/supplier.entity';

@Injectable()
export class SuppliersService {
  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  private wrap(data: unknown) {
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /** Recherche par code ou nom, pour la sélection d'un fournisseur déjà utilisé. */
  async search(tenantId: string, search?: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Supplier);

    const suppliers = search
      ? await repo.find({
          where: [{ code: Like(`%${search}%`) }, { name: Like(`%${search}%`) }],
          order: { name: 'ASC' },
          take: 20,
        })
      : await repo.find({ order: { name: 'ASC' }, take: 50 });

    return this.wrap(suppliers);
  }

  /**
   * Crée le fournisseur s'il n'existe pas encore (par code), ou met à jour
   * ses coordonnées avec les dernières valeurs saisies s'il existe déjà.
   * Appelé quand un bon de commande est généré (voir
   * PurchaseRequestsService.process) — jamais depuis une route publique.
   */
  async upsert(
    tenantId: string,
    input: { name: string; code: string; taxNumber: string; rccm: string },
  ): Promise<Supplier> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Supplier);

    const existing = await repo.findOne({ where: { code: input.code } });
    if (existing) {
      existing.name = input.name;
      existing.taxNumber = input.taxNumber;
      existing.rccm = input.rccm;
      return repo.save(existing);
    }

    return repo.save(repo.create(input));
  }
}
