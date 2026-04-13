import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultiTenancy1711700000000 implements MigrationInterface {
  name = 'AddMultiTenancy1711700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /* ─── 1. Create tenants table ─── */
    await queryRunner.query(`
      CREATE TABLE [tenants] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [name] NVARCHAR(200) NOT NULL,
        [slug] NVARCHAR(100) NOT NULL,
        [logo] NVARCHAR(255) NULL,
        [domain] NVARCHAR(255) NULL,
        [plan] NVARCHAR(50) NOT NULL DEFAULT 'FREE' CHECK ([plan] IN ('FREE','STARTER','PROFESSIONAL','ENTERPRISE')),
        [is_active] BIT NOT NULL DEFAULT 1,
        [settings] NVARCHAR(MAX) NULL,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
      );
      CREATE UNIQUE INDEX [IDX_tenants_slug] ON [tenants]([slug]);
    `);

    /* ─── 2. Insert a default tenant for existing data ─── */
    await queryRunner.query(`
      INSERT INTO [tenants] ([id], [name], [slug], [plan])
      VALUES ('00000000-0000-0000-0000-000000000001', 'Organisation par défaut', 'default', 'PROFESSIONAL');
    `);

    /* ─── 3. Add tenant_id to all main tables ─── */
    const tables = [
      'roles',
      'departments',
      'users',
      'expense_categories',
      'expenses',
      'budgets',
      'advances',
      'clients',
      'products',
      'sales',
      'cash_closings',
      'notifications',
    ];

    for (const table of tables) {
      await queryRunner.query(`
        ALTER TABLE [${table}]
          ADD [tenant_id] UNIQUEIDENTIFIER NULL;
      `);
      await queryRunner.query(`
        UPDATE [${table}] SET [tenant_id] = '00000000-0000-0000-0000-000000000001';
      `);
      await queryRunner.query(`
        ALTER TABLE [${table}]
          ALTER COLUMN [tenant_id] UNIQUEIDENTIFIER NOT NULL;
      `);
      await queryRunner.query(`
        ALTER TABLE [${table}]
          ADD CONSTRAINT [FK_${table}_tenant] FOREIGN KEY ([tenant_id]) REFERENCES [tenants]([id]);
      `);
      await queryRunner.query(`
        CREATE INDEX [IDX_${table}_tenant_id] ON [${table}]([tenant_id]);
      `);
    }

    /* ─── 4. audit_logs: tenant_id nullable (system events) ─── */
    await queryRunner.query(`
      ALTER TABLE [audit_logs]
        ADD [tenant_id] UNIQUEIDENTIFIER NULL;
    `);
    await queryRunner.query(`
      UPDATE [audit_logs] SET [tenant_id] = '00000000-0000-0000-0000-000000000001';
    `);
    await queryRunner.query(`
      ALTER TABLE [audit_logs]
        ADD CONSTRAINT [FK_audit_logs_tenant] FOREIGN KEY ([tenant_id]) REFERENCES [tenants]([id]);
    `);
    await queryRunner.query(`
      CREATE INDEX [IDX_audit_logs_tenant_id] ON [audit_logs]([tenant_id]);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'audit_logs',
      'notifications',
      'cash_closings',
      'sales',
      'products',
      'clients',
      'advances',
      'budgets',
      'expenses',
      'expense_categories',
      'users',
      'departments',
      'roles',
    ];

    for (const table of tables) {
      await queryRunner.query(`DROP INDEX [IDX_${table}_tenant_id] ON [${table}];`);
      await queryRunner.query(`ALTER TABLE [${table}] DROP CONSTRAINT [FK_${table}_tenant];`);
      await queryRunner.query(`ALTER TABLE [${table}] DROP COLUMN [tenant_id];`);
    }

    await queryRunner.query(`DROP TABLE [tenants];`);
  }
}
