import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFneInvoiceTables1712400000000 implements MigrationInterface {
  name = 'AddFneInvoiceTables1712400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Create fne_invoices table ──────────────────────────
    await queryRunner.query(`
      CREATE TABLE [fne_invoices] (
        [id]                      UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        [reference]               VARCHAR(20)      NOT NULL,
        [fne_ncc]                 VARCHAR(50)      NULL,
        [fne_reference]           VARCHAR(100)     NULL,
        [fne_token]               VARCHAR(500)     NULL,
        [fne_response]            NVARCHAR(MAX)    NULL,
        [fne_invoice_id]          VARCHAR(100)     NULL,
        [status]                  VARCHAR(20)      NOT NULL DEFAULT 'DRAFT',
        [template]                VARCHAR(10)      NOT NULL DEFAULT 'B2C',
        [payment_method]          VARCHAR(20)      NOT NULL DEFAULT 'cash',
        [client_company_name]     NVARCHAR(255)    NOT NULL,
        [client_phone]            VARCHAR(50)      NOT NULL,
        [client_email]            VARCHAR(150)     NOT NULL,
        [client_ncc]              VARCHAR(50)      NULL,
        [client_seller_name]      NVARCHAR(255)    NULL,
        [point_of_sale]           NVARCHAR(255)    NOT NULL,
        [establishment]           NVARCHAR(255)    NOT NULL,
        [commercial_message]      NVARCHAR(500)    NULL,
        [footer]                  NVARCHAR(500)    NULL,
        [is_rne]                  BIT              NOT NULL DEFAULT 0,
        [rne]                     VARCHAR(50)      NULL,
        [foreign_currency]        VARCHAR(10)      NULL,
        [foreign_currency_rate]   DECIMAL(15,6)    NOT NULL DEFAULT 0,
        [subtotal_ht]             DECIMAL(15,2)    NOT NULL DEFAULT 0,
        [total_vat]               DECIMAL(15,2)    NOT NULL DEFAULT 0,
        [total_ttc]               DECIMAL(15,2)    NOT NULL DEFAULT 0,
        [discount_pct]            DECIMAL(5,2)     NOT NULL DEFAULT 0,
        [discount_amount]         DECIMAL(15,2)    NOT NULL DEFAULT 0,
        [balance_sticker]         INT              NOT NULL DEFAULT 0,
        [fne_warning]             BIT              NOT NULL DEFAULT 0,
        [custom_taxes]            NVARCHAR(MAX)    NULL,
        [credit_note_of]          UNIQUEIDENTIFIER NULL,
        [credit_note_reference]   VARCHAR(100)     NULL,
        [created_by_id]           UNIQUEIDENTIFIER NOT NULL,
        [created_at]              DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        [updated_at]              DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [PK_fne_invoices] PRIMARY KEY ([id]),
        CONSTRAINT [UQ_fne_invoices_reference] UNIQUE ([reference]),
        CONSTRAINT [FK_fne_invoices_credit_of] FOREIGN KEY ([credit_note_of]) REFERENCES [fne_invoices]([id])
      );
    `);

    await queryRunner.query(`CREATE INDEX [IDX_fne_invoices_status] ON [fne_invoices]([status]);`);
    await queryRunner.query(
      `CREATE INDEX [IDX_fne_invoices_reference] ON [fne_invoices]([reference]);`,
    );
    await queryRunner.query(
      `CREATE INDEX [IDX_fne_invoices_fne_reference] ON [fne_invoices]([fne_reference]);`,
    );
    await queryRunner.query(
      `CREATE INDEX [IDX_fne_invoices_created_at] ON [fne_invoices]([created_at]);`,
    );
    await queryRunner.query(
      `CREATE INDEX [IDX_fne_invoices_client_phone] ON [fne_invoices]([client_phone]);`,
    );

    // ── Create fne_invoice_items table ─────────────────────
    await queryRunner.query(`
      CREATE TABLE [fne_invoice_items] (
        [id]                  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        [invoice_id]          UNIQUEIDENTIFIER NOT NULL,
        [fne_item_id]         VARCHAR(100)     NULL,
        [reference]           VARCHAR(100)     NULL,
        [description]         NVARCHAR(500)    NOT NULL,
        [quantity]            DECIMAL(15,4)    NOT NULL,
        [amount]              DECIMAL(15,4)    NOT NULL,
        [discount]            DECIMAL(5,2)     NOT NULL DEFAULT 0,
        [measurement_unit]    VARCHAR(50)      NULL,
        [taxes]               NVARCHAR(MAX)    NULL,
        [custom_taxes]        NVARCHAR(MAX)    NULL,
        [line_total_ht]       DECIMAL(15,2)    NOT NULL DEFAULT 0,
        [line_vat]            DECIMAL(15,2)    NOT NULL DEFAULT 0,
        [line_total_ttc]      DECIMAL(15,2)    NOT NULL DEFAULT 0,
        [quantity_returned]   DECIMAL(15,4)    NOT NULL DEFAULT 0,
        CONSTRAINT [PK_fne_invoice_items] PRIMARY KEY ([id]),
        CONSTRAINT [FK_fne_invoice_items_invoice] FOREIGN KEY ([invoice_id]) REFERENCES [fne_invoices]([id]) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX [IDX_fne_invoice_items_invoice_id] ON [fne_invoice_items]([invoice_id]);`,
    );

    // ── Create fne_api_logs table ──────────────────────────
    await queryRunner.query(`
      CREATE TABLE [fne_api_logs] (
        [id]                  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        [invoice_id]          UNIQUEIDENTIFIER NULL,
        [method]              VARCHAR(10)      NOT NULL,
        [url]                 VARCHAR(500)     NOT NULL,
        [request_body]        NVARCHAR(MAX)    NULL,
        [response_status]     INT              NULL,
        [response_body]       NVARCHAR(MAX)    NULL,
        [error_message]       NVARCHAR(MAX)    NULL,
        [attempt_number]      INT              NOT NULL DEFAULT 1,
        [created_by]          UNIQUEIDENTIFIER NULL,
        [created_at]          DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [PK_fne_api_logs] PRIMARY KEY ([id])
      );
    `);

    await queryRunner.query(
      `CREATE INDEX [IDX_fne_api_logs_invoice_id] ON [fne_api_logs]([invoice_id]);`,
    );
    await queryRunner.query(
      `CREATE INDEX [IDX_fne_api_logs_created_at] ON [fne_api_logs]([created_at]);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS [fne_api_logs];`);
    await queryRunner.query(`DROP TABLE IF EXISTS [fne_invoice_items];`);
    await queryRunner.query(`DROP TABLE IF EXISTS [fne_invoices];`);
  }
}
