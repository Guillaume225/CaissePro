import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportConfigs1712200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE report_configs (
        id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        tenant_id       UNIQUEIDENTIFIER NOT NULL,
        report_id       VARCHAR(50)      NOT NULL,
        report_name     NVARCHAR(200)    NOT NULL,
        config_json     NVARCHAR(MAX)    NOT NULL,
        updated_by      UNIQUEIDENTIFIER NULL,
        created_at      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        updated_at      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),

        CONSTRAINT PK_report_configs PRIMARY KEY (id),
        CONSTRAINT FK_report_configs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT FK_report_configs_user   FOREIGN KEY (updated_by) REFERENCES users(id),
        CONSTRAINT UQ_report_configs_tenant_report UNIQUE (tenant_id, report_id)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IX_report_configs_tenant_id ON report_configs (tenant_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS report_configs;`);
  }
}
