"""Tests for enums and report templates."""

from app.enums import ReportType, ReportFormat, JobStatus, ScheduleFrequency, REPORT_TEMPLATES


class TestReportType:
    def test_all_report_types_exist(self):
        assert len(ReportType) == 6
        expected = [
            "daily_cash_journal",
            "budget_status",
            "aged_receivables",
            "cash_register_closing",
            "monthly_consolidated",
            "client_statement",
        ]
        for e in expected:
            assert e in [rt.value for rt in ReportType]

    def test_all_formats_exist(self):
        assert len(ReportFormat) == 3
        assert ReportFormat.PDF.value == "pdf"
        assert ReportFormat.EXCEL.value == "xlsx"
        assert ReportFormat.CSV.value == "csv"

    def test_job_statuses(self):
        assert len(JobStatus) == 4
        assert JobStatus.PENDING.value == "pending"
        assert JobStatus.PROCESSING.value == "processing"
        assert JobStatus.COMPLETED.value == "completed"
        assert JobStatus.FAILED.value == "failed"

    def test_schedule_frequencies(self):
        assert len(ScheduleFrequency) == 3


class TestReportTemplates:
    def test_all_report_types_have_templates(self):
        for rt in ReportType:
            assert rt in REPORT_TEMPLATES

    def test_template_structure(self):
        for rt, tmpl in REPORT_TEMPLATES.items():
            assert "name" in tmpl
            assert "description" in tmpl
            assert "required_params" in tmpl
            assert "optional_params" in tmpl
            assert "formats" in tmpl
            assert isinstance(tmpl["formats"], list)

    def test_daily_cash_journal_requires_date(self):
        tmpl = REPORT_TEMPLATES[ReportType.DAILY_CASH_JOURNAL]
        assert "date" in tmpl["required_params"]

    def test_budget_status_requires_period(self):
        tmpl = REPORT_TEMPLATES[ReportType.BUDGET_STATUS]
        assert "period_start" in tmpl["required_params"]
        assert "period_end" in tmpl["required_params"]

    def test_aged_receivables_requires_as_of_date(self):
        tmpl = REPORT_TEMPLATES[ReportType.AGED_RECEIVABLES]
        assert "as_of_date" in tmpl["required_params"]

    def test_cash_register_closing_requires_register_and_date(self):
        tmpl = REPORT_TEMPLATES[ReportType.CASH_REGISTER_CLOSING]
        assert "cash_register_id" in tmpl["required_params"]
        assert "date" in tmpl["required_params"]

    def test_monthly_consolidated_requires_year_month(self):
        tmpl = REPORT_TEMPLATES[ReportType.MONTHLY_CONSOLIDATED]
        assert "year" in tmpl["required_params"]
        assert "month" in tmpl["required_params"]

    def test_client_statement_requires_client_and_period(self):
        tmpl = REPORT_TEMPLATES[ReportType.CLIENT_STATEMENT]
        assert "client_id" in tmpl["required_params"]
        assert "period_start" in tmpl["required_params"]
        assert "period_end" in tmpl["required_params"]

    def test_all_templates_support_pdf(self):
        for rt, tmpl in REPORT_TEMPLATES.items():
            assert ReportFormat.PDF in tmpl["formats"], f"{rt} should support PDF"
