import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCashDayTables1712000000000 implements MigrationInterface {
  name = 'AddCashDayTables1712000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Create cash_days table ──────────────────────────
    await queryRunner.query(`
      CREATE TABLE [cash_days] (
        [id]                  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        [tenant_id]           UNIQUEIDENTIFIER NOT NULL,
        [reference]           VARCHAR(20)      NOT NULL,
        [status]              VARCHAR(20)      NOT NULL DEFAULT 'OPEN',
        [opening_balance]     DECIMAL(15,2)    NOT NULL,
        [total_entries]       DECIMAL(15,2)    NOT NULL DEFAULT 0,
        [total_exits]         DECIMAL(15,2)    NOT NULL DEFAULT 0,
        [theoretical_balance] DECIMAL(15,2)    NOT NULL DEFAULT 0,
        [actual_balance]      DECIMAL(15,2)    NULL,
        [variance]            DECIMAL(15,2)    NOT NULL DEFAULT 0,
        [comment]             NVARCHAR(MAX)    NULL,
        [opened_by]           UNIQUEIDENTIFIER NOT NULL,
        [closed_by]           UNIQUEIDENTIFIER NULL,
        [opened_at]           DATETIMEOFFSET   NOT NULL,
        [closed_at]           DATETIMEOFFSET   NULL,
        [created_at]          DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        [updated_at]          DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [PK_cash_days] PRIMARY KEY ([id]),
        CONSTRAINT [UQ_cash_days_reference] UNIQUE ([reference]),
        CONSTRAINT [FK_cash_days_tenant] FOREIGN KEY ([tenant_id]) REFERENCES [tenants]([id]),
        CONSTRAINT [FK_cash_days_opened_by] FOREIGN KEY ([opened_by]) REFERENCES [users]([id]),
        CONSTRAINT [FK_cash_days_closed_by] FOREIGN KEY ([closed_by]) REFERENCES [users]([id])
      );
    `);

    await queryRunner.query(`CREATE INDEX [IDX_cash_days_tenant] ON [cash_days]([tenant_id]);`);
    await queryRunner.query(`CREATE INDEX [IDX_cash_days_status] ON [cash_days]([status]);`);
    await queryRunner.query(`CREATE INDEX [IDX_cash_days_opened_at] ON [cash_days]([opened_at]);`);

    // ── Create cash_movements table ─────────────────────
    await queryRunner.query(`
      CREATE TABLE [cash_movements] (
        [id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        [tenant_id]       UNIQUEIDENTIFIER NOT NULL,
        [cash_day_id]     UNIQUEIDENTIFIER NOT NULL,
        [type]            VARCHAR(10)      NOT NULL,
        [category]        VARCHAR(20)      NOT NULL,
        [amount]          DECIMAL(15,2)    NOT NULL,
        [reference]       VARCHAR(30)      NULL,
        [description]     NVARCHAR(500)    NOT NULL,
        [payment_method]  VARCHAR(20)      NULL,
        [created_by]      UNIQUEIDENTIFIER NOT NULL,
        [created_at]      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [PK_cash_movements] PRIMARY KEY ([id]),
        CONSTRAINT [FK_cash_movements_tenant] FOREIGN KEY ([tenant_id]) REFERENCES [tenants]([id]),
        CONSTRAINT [FK_cash_movements_cash_day] FOREIGN KEY ([cash_day_id]) REFERENCES [cash_days]([id]),
        CONSTRAINT [FK_cash_movements_created_by] FOREIGN KEY ([created_by]) REFERENCES [users]([id])
      );
    `);

    await queryRunner.query(
      `CREATE INDEX [IDX_cash_movements_tenant] ON [cash_movements]([tenant_id]);`,
    );
    await queryRunner.query(
      `CREATE INDEX [IDX_cash_movements_cash_day] ON [cash_movements]([cash_day_id]);`,
    );
    await queryRunner.query(`CREATE INDEX [IDX_cash_movements_type] ON [cash_movements]([type]);`);
    await queryRunner.query(
      `CREATE INDEX [IDX_cash_movements_category] ON [cash_movements]([category]);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE [cash_movements];`);
    await queryRunner.query(`DROP TABLE [cash_days];`);
  }
}
