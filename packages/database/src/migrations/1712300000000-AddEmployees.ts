import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployees1712300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE employees (
        id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        tenant_id       UNIQUEIDENTIFIER NOT NULL,
        matricule       VARCHAR(50)      NOT NULL,
        first_name      NVARCHAR(100)    NOT NULL,
        last_name       NVARCHAR(100)    NOT NULL,
        email           VARCHAR(255)     NOT NULL,
        service         NVARCHAR(100)    NOT NULL,
        position        NVARCHAR(100)    NOT NULL,
        phone           VARCHAR(50)      NULL,
        is_active       BIT              NOT NULL DEFAULT 1,
        created_at      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        updated_at      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),

        CONSTRAINT PK_employees PRIMARY KEY (id),
        CONSTRAINT FK_employees_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT UQ_employees_tenant_matricule UNIQUE (tenant_id, matricule)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IX_employees_tenant_id ON employees (tenant_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IX_employees_email ON employees (email);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS employees;`);
  }
}
