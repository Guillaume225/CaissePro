from enum import Enum


class ReportType(str, Enum):
    DAILY_CASH_JOURNAL = "daily_cash_journal"
    BUDGET_STATUS = "budget_status"
    AGED_RECEIVABLES = "aged_receivables"
    CASH_REGISTER_CLOSING = "cash_register_closing"
    MONTHLY_CONSOLIDATED = "monthly_consolidated"
    CLIENT_STATEMENT = "client_statement"


class ReportFormat(str, Enum):
    PDF = "pdf"
    EXCEL = "xlsx"
    CSV = "csv"


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ScheduleFrequency(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


REPORT_TEMPLATES = {
    ReportType.DAILY_CASH_JOURNAL: {
        "name": "Journal de caisse journalier",
        "description": "Résumé des dépenses et ventes de la journée avec solde de caisse",
        "required_params": ["date"],
        "optional_params": ["cash_register_id"],
        "formats": [ReportFormat.PDF, ReportFormat.EXCEL, ReportFormat.CSV],
    },
    ReportType.BUDGET_STATUS: {
        "name": "État budgétaire",
        "description": "Suivi budgétaire par catégorie et/ou département avec taux de consommation",
        "required_params": ["period_start", "period_end"],
        "optional_params": ["department_id", "category_id"],
        "formats": [ReportFormat.PDF, ReportFormat.EXCEL, ReportFormat.CSV],
    },
    ReportType.AGED_RECEIVABLES: {
        "name": "Balance âgée des créances clients",
        "description": "Créances clients classées par tranche d'ancienneté (0-30, 31-60, 61-90, 90+ jours)",
        "required_params": ["as_of_date"],
        "optional_params": ["client_id"],
        "formats": [ReportFormat.PDF, ReportFormat.EXCEL, ReportFormat.CSV],
    },
    ReportType.CASH_REGISTER_CLOSING: {
        "name": "Bilan de clôture de caisse",
        "description": "Récapitulatif de la caisse avec écart théorique/réel",
        "required_params": ["cash_register_id", "date"],
        "optional_params": [],
        "formats": [ReportFormat.PDF, ReportFormat.EXCEL],
    },
    ReportType.MONTHLY_CONSOLIDATED: {
        "name": "Rapport mensuel consolidé",
        "description": "Synthèse mensuelle combinant dépenses et ventes, avec indicateurs clés",
        "required_params": ["year", "month"],
        "optional_params": ["department_id"],
        "formats": [ReportFormat.PDF, ReportFormat.EXCEL, ReportFormat.CSV],
    },
    ReportType.CLIENT_STATEMENT: {
        "name": "Relevé client",
        "description": "Historique détaillé des transactions pour un client donné",
        "required_params": ["client_id", "period_start", "period_end"],
        "optional_params": [],
        "formats": [ReportFormat.PDF, ReportFormat.EXCEL, ReportFormat.CSV],
    },
}
