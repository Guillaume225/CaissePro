-- ============================================================
-- CaisseFlow Pro — Migration FNE : toutes les tables FNE
-- ============================================================
SET NOCOUNT ON;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  TABLE : fne_invoices                                     ║
-- ╚═══════════════════════════════════════════════════════════╝
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'fne_invoices')
BEGIN
  CREATE TABLE fne_invoices (
    id                      UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    reference               NVARCHAR(30)     NULL,
    fne_ncc                 NVARCHAR(100)    NULL,
    fne_reference           NVARCHAR(100)    NULL,
    fne_token               NVARCHAR(500)    NULL,
    fne_response            NVARCHAR(MAX)    NULL,
    fne_invoice_id          NVARCHAR(100)    NULL,
    status                  NVARCHAR(20)     NOT NULL DEFAULT 'DRAFT',
    template                NVARCHAR(10)     NOT NULL,
    invoice_type            NVARCHAR(20)     NOT NULL DEFAULT 'sale',
    payment_method          NVARCHAR(20)     NOT NULL,
    client_company_name     NVARCHAR(255)    NOT NULL,
    client_phone            NVARCHAR(50)     NOT NULL,
    client_email            NVARCHAR(255)    NOT NULL,
    client_ncc              NVARCHAR(100)    NULL,
    client_seller_name      NVARCHAR(255)    NULL,
    point_of_sale           NVARCHAR(255)    NOT NULL,
    establishment           NVARCHAR(255)    NOT NULL,
    commercial_message      NVARCHAR(500)    NULL,
    footer                  NVARCHAR(500)    NULL,
    is_rne                  BIT              NOT NULL DEFAULT 0,
    rne                     NVARCHAR(100)    NULL,
    foreign_currency        NVARCHAR(5)      NULL,
    foreign_currency_rate   DECIMAL(15,4)    NOT NULL DEFAULT 0,
    subtotal_ht             DECIMAL(15,2)    NOT NULL DEFAULT 0,
    total_vat               DECIMAL(15,2)    NOT NULL DEFAULT 0,
    total_ttc               DECIMAL(15,2)    NOT NULL DEFAULT 0,
    discount_pct            DECIMAL(5,2)     NOT NULL DEFAULT 0,
    discount_amount         DECIMAL(15,2)    NOT NULL DEFAULT 0,
    balance_sticker         INT              NOT NULL DEFAULT 0,
    fne_warning             BIT              NOT NULL DEFAULT 0,
    custom_taxes            NVARCHAR(MAX)    NULL,
    credit_note_of          UNIQUEIDENTIFIER NULL,
    credit_note_reference   NVARCHAR(100)    NULL,
    created_by              UNIQUEIDENTIFIER NOT NULL,
    created_at              DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at              DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_fne_invoices PRIMARY KEY (id),
    CONSTRAINT UQ_fne_invoices_reference UNIQUE (reference)
  );

  CREATE NONCLUSTERED INDEX IX_fne_invoices_fne_reference ON fne_invoices (fne_reference);
  CREATE NONCLUSTERED INDEX IX_fne_invoices_status ON fne_invoices (status);
  CREATE NONCLUSTERED INDEX IX_fne_invoices_client_phone ON fne_invoices (client_phone);

  PRINT '>> Table fne_invoices créée.';
END
ELSE
BEGIN
  -- Add invoice_type column if missing
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fne_invoices') AND name = 'invoice_type')
  BEGIN
    ALTER TABLE fne_invoices ADD invoice_type NVARCHAR(20) NOT NULL DEFAULT 'sale';
    PRINT '>> Colonne invoice_type ajoutée à fne_invoices.';
  END
  PRINT '>> Table fne_invoices existe déjà.';
END
GO

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  TABLE : fne_invoice_items                                ║
-- ╚═══════════════════════════════════════════════════════════╝
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'fne_invoice_items')
BEGIN
  CREATE TABLE fne_invoice_items (
    id                UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    invoice_id        UNIQUEIDENTIFIER NOT NULL,
    fne_item_id       NVARCHAR(100)    NULL,
    reference         NVARCHAR(100)    NULL,
    description       NVARCHAR(500)    NOT NULL,
    quantity          DECIMAL(15,4)    NOT NULL,
    amount            DECIMAL(15,2)    NOT NULL,
    discount          DECIMAL(5,2)     NOT NULL DEFAULT 0,
    measurement_unit  NVARCHAR(50)     NULL,
    taxes             NVARCHAR(MAX)    NOT NULL,
    custom_taxes      NVARCHAR(MAX)    NULL,
    line_total_ht     DECIMAL(15,2)    NOT NULL DEFAULT 0,
    line_vat          DECIMAL(15,2)    NOT NULL DEFAULT 0,
    line_total_ttc    DECIMAL(15,2)    NOT NULL DEFAULT 0,
    quantity_returned DECIMAL(15,4)    NOT NULL DEFAULT 0,
    CONSTRAINT PK_fne_invoice_items PRIMARY KEY (id),
    CONSTRAINT FK_fne_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES fne_invoices(id) ON DELETE CASCADE
  );

  CREATE NONCLUSTERED INDEX IX_fne_invoice_items_invoice_id ON fne_invoice_items (invoice_id);

  PRINT '>> Table fne_invoice_items créée.';
END
ELSE
  PRINT '>> Table fne_invoice_items existe déjà.';
GO

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  TABLE : fne_api_logs                                     ║
-- ╚═══════════════════════════════════════════════════════════╝
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'fne_api_logs')
BEGIN
  CREATE TABLE fne_api_logs (
    id               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    invoice_id       UNIQUEIDENTIFIER NULL,
    method           NVARCHAR(20)     NOT NULL,
    url              NVARCHAR(500)    NOT NULL,
    request_body     NVARCHAR(MAX)    NULL,
    response_status  INT              NULL,
    response_body    NVARCHAR(MAX)    NULL,
    error_message    NVARCHAR(1000)   NULL,
    attempt_number   INT              NOT NULL DEFAULT 1,
    created_by       UNIQUEIDENTIFIER NULL,
    created_at       DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_fne_api_logs PRIMARY KEY (id)
  );

  CREATE NONCLUSTERED INDEX IX_fne_api_logs_invoice_id ON fne_api_logs (invoice_id);
  CREATE NONCLUSTERED INDEX IX_fne_api_logs_created_at ON fne_api_logs (created_at);

  PRINT '>> Table fne_api_logs créée.';
END
ELSE
  PRINT '>> Table fne_api_logs existe déjà.';
GO

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  TABLE : fne_clients                                      ║
-- ╚═══════════════════════════════════════════════════════════╝
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'fne_clients')
BEGIN
  CREATE TABLE fne_clients (
    id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    company_name    NVARCHAR(255)    NOT NULL,
    phone           NVARCHAR(50)     NOT NULL,
    email           NVARCHAR(255)    NOT NULL,
    ncc             NVARCHAR(100)    NULL,
    seller_name     NVARCHAR(255)    NULL,
    is_active       BIT              NOT NULL DEFAULT 1,
    created_at      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_fne_clients PRIMARY KEY (id)
  );

  CREATE NONCLUSTERED INDEX IX_fne_clients_phone ON fne_clients (phone);
  CREATE NONCLUSTERED INDEX IX_fne_clients_email ON fne_clients (email);
  CREATE NONCLUSTERED INDEX IX_fne_clients_ncc   ON fne_clients (ncc);

  PRINT '>> Table fne_clients créée.';
END
ELSE
  PRINT '>> Table fne_clients existe déjà.';
GO

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  TABLE : fne_products                                     ║
-- ╚═══════════════════════════════════════════════════════════╝
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'fne_products')
BEGIN
  CREATE TABLE fne_products (
    id               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    description      NVARCHAR(255)    NOT NULL,
    reference        NVARCHAR(100)    NULL,
    unit_price       DECIMAL(18,2)    NOT NULL,
    measurement_unit NVARCHAR(50)     NULL,
    default_taxes    NVARCHAR(MAX)    NOT NULL DEFAULT '["TVA"]',
    is_active        BIT              NOT NULL DEFAULT 1,
    created_at       DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at       DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_fne_products PRIMARY KEY (id)
  );

  CREATE NONCLUSTERED INDEX IX_fne_products_reference ON fne_products (reference);

  PRINT '>> Table fne_products créée.';
END
ELSE
  PRINT '>> Table fne_products existe déjà.';
GO

PRINT '>> Migration FNE terminée.';
