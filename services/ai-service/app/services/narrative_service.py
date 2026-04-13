"""Narrative service — orchestrates report generation with insights and alerts."""

import logging

from app.models.narrative_generator import NarrativeGenerator
from app.schemas.narrative import (
    Alert,
    KeyInsight,
    NarrativeRequest,
    NarrativeResponse,
    ReportModule,
)

logger = logging.getLogger(__name__)


class NarrativeService:
    def __init__(self, generator: NarrativeGenerator):
        self.generator = generator

    def generate_report(self, request: NarrativeRequest) -> NarrativeResponse:
        """Generate a full narrative report with insights and alerts."""
        # 1. Format the period string
        period = self.generator.format_period(
            report_type=request.report_type.value,
            start=request.date_range.start,
            end=request.date_range.end,
        )

        # 2. Convert KPI data to dict
        data_dict = request.data.model_dump()

        # 3. Generate narrative text
        narrative_text, offline = self.generator.generate(
            report_type=request.report_type.value,
            period=period,
            data=data_dict,
            language=request.language,
            include_recommendations=request.include_recommendations,
        )

        # 4. Extract insights
        raw_insights = self.generator.extract_insights(data_dict)
        # Filter by module if not "all"
        if request.module != ReportModule.ALL:
            raw_insights = [
                i for i in raw_insights
                if i["module"] == request.module.value or i["module"] == "all"
            ]

        insights = [
            KeyInsight(
                title=i["title"],
                description=i["description"],
                severity=i["severity"],
                module=i["module"],
            )
            for i in raw_insights
        ]

        # 5. Extract alerts
        raw_alerts = self.generator.extract_alerts(data_dict)
        alerts = [
            Alert(
                message=a["message"],
                severity=a["severity"],
                metric=a["metric"],
                value=a["value"],
                threshold=a.get("threshold"),
            )
            for a in raw_alerts
        ]

        return NarrativeResponse(
            narrative=narrative_text,
            key_insights=insights,
            alerts=alerts,
            report_type=request.report_type,
            period=period,
            module=request.module,
            offline_mode=offline,
        )
