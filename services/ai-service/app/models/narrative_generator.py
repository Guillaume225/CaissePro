"""Narrative report generator — OpenAI API + Jinja2 template fallback."""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# ── Jinja2 Templates (fallback) ─────────────────────────

_DAILY_TEMPLATE_FR = """## Rapport journalier — {{ period }}

### Résumé
Au cours de la journée du **{{ period }}**, votre activité a enregistré un chiffre d'affaires de **{{ "{:,.0f}".format(data.total_sales) }} FCFA** réparti sur **{{ data.transaction_count }}** transactions, soit un panier moyen de **{{ "{:,.0f}".format(data.average_ticket) }} FCFA**.

{% if data.total_expenses > 0 %}Les dépenses totales s'élèvent à **{{ "{:,.0f}".format(data.total_expenses) }} FCFA**.{% endif %}

{% if data.growth_rate is not none %}### Évolution
Le taux de croissance par rapport à la période précédente est de **{{ "{:.1f}".format(data.growth_rate) }}%**{% if data.growth_rate > 0 %}, ce qui est positif{% elif data.growth_rate < 0 %}, ce qui indique un recul{% endif %}.{% endif %}

{% if data.top_products %}### Top Produits
{% for p in data.top_products[:5] %}- {{ p.get('name', 'Produit') }} : {{ "{:,.0f}".format(p.get('amount', 0)) }} FCFA
{% endfor %}{% endif %}

{% if data.anomaly_count and data.anomaly_count > 0 %}### Alertes
**{{ data.anomaly_count }}** anomalie(s) détectée(s) nécessitant votre attention.{% endif %}
"""

_WEEKLY_TEMPLATE_FR = """## Rapport hebdomadaire — {{ period }}

### Vue d'ensemble
Cette semaine, votre activité a généré **{{ "{:,.0f}".format(data.total_sales) }} FCFA** de chiffre d'affaires avec **{{ data.transaction_count }}** transactions (panier moyen : **{{ "{:,.0f}".format(data.average_ticket) }} FCFA**).

{% if data.total_expenses > 0 %}Les dépenses de la semaine totalisent **{{ "{:,.0f}".format(data.total_expenses) }} FCFA**{% if data.profit_margin is not none %}, dégageant une marge de **{{ "{:.1f}".format(data.profit_margin) }}%**{% endif %}.{% endif %}

{% if data.growth_rate is not none %}### Tendance
Croissance par rapport à la semaine précédente : **{{ "{:.1f}".format(data.growth_rate) }}%**.{% endif %}

{% if data.top_products %}### Meilleures ventes
{% for p in data.top_products[:5] %}- {{ p.get('name', 'Produit') }} : {{ "{:,.0f}".format(p.get('amount', 0)) }} FCFA
{% endfor %}{% endif %}

{% if data.top_clients %}### Meilleurs clients
{% for c in data.top_clients[:5] %}- {{ c.get('name', 'Client') }} : {{ "{:,.0f}".format(c.get('amount', 0)) }} FCFA
{% endfor %}{% endif %}

{% if data.anomaly_count and data.anomaly_count > 0 %}### Anomalies
**{{ data.anomaly_count }}** anomalie(s) détectée(s) cette semaine.{% endif %}
"""

_MONTHLY_TEMPLATE_FR = """## Rapport mensuel — {{ period }}

### Synthèse du mois
Le mois de **{{ period }}** se conclut avec un chiffre d'affaires total de **{{ "{:,.0f}".format(data.total_sales) }} FCFA**, réparti sur **{{ data.transaction_count }}** transactions. Le panier moyen s'établit à **{{ "{:,.0f}".format(data.average_ticket) }} FCFA**.

{% if data.total_expenses > 0 %}### Dépenses
Le total des dépenses s'élève à **{{ "{:,.0f}".format(data.total_expenses) }} FCFA**{% if data.profit_margin is not none %}, avec une marge bénéficiaire de **{{ "{:.1f}".format(data.profit_margin) }}%**{% endif %}.{% endif %}

{% if data.growth_rate is not none %}### Croissance
Le taux de croissance par rapport au mois précédent est de **{{ "{:.1f}".format(data.growth_rate) }}%**.{% endif %}

{% if data.top_products %}### Top 5 Produits
{% for p in data.top_products[:5] %}{{ loop.index }}. {{ p.get('name', 'Produit') }} — {{ "{:,.0f}".format(p.get('amount', 0)) }} FCFA
{% endfor %}{% endif %}

{% if data.top_clients %}### Top 5 Clients
{% for c in data.top_clients[:5] %}{{ loop.index }}. {{ c.get('name', 'Client') }} — {{ "{:,.0f}".format(c.get('amount', 0)) }} FCFA
{% endfor %}{% endif %}

{% if data.anomaly_count and data.anomaly_count > 0 %}### Anomalies détectées
**{{ data.anomaly_count }}** anomalie(s) détectée(s) ce mois-ci. Consultez le tableau de bord des alertes.{% endif %}
"""

_TEMPLATES_FR = {
    "daily": _DAILY_TEMPLATE_FR,
    "weekly": _WEEKLY_TEMPLATE_FR,
    "monthly": _MONTHLY_TEMPLATE_FR,
    "custom": _DAILY_TEMPLATE_FR,  # reuse daily for custom
}


class NarrativeGenerator:
    """Generate narrative reports using OpenAI API with Jinja2 fallback."""

    def __init__(
        self,
        openai_api_key: str | None = None,
        model_name: str = "gpt-4o",
        max_tokens: int = 2048,
    ):
        self.model_name = model_name
        self.max_tokens = max_tokens
        self._client = None
        self._jinja_env = None

        # Init OpenAI client
        if openai_api_key:
            try:
                from openai import OpenAI
                self._client = OpenAI(api_key=openai_api_key)
                logger.info("Narrative generator: OpenAI client ready")
            except ImportError:
                logger.warning("openai package not installed — Jinja2 fallback only")
            except Exception as exc:
                logger.warning("Failed to init OpenAI for narrative: %s", exc)

        # Init Jinja2 environment
        try:
            from jinja2 import Environment
            self._jinja_env = Environment(autoescape=False)
            logger.info("Jinja2 template engine ready")
        except ImportError:
            logger.warning("jinja2 not installed — limited fallback")

    @property
    def is_online(self) -> bool:
        return self._client is not None

    # ── Narrative Generation ──────────────────────────────

    def generate(
        self,
        report_type: str,
        period: str,
        data: dict,
        language: str = "fr",
        include_recommendations: bool = True,
    ) -> tuple[str, bool]:
        """Generate narrative text.

        Returns (narrative_text, is_offline).
        """
        if self._client is not None:
            try:
                return self._call_openai(
                    report_type, period, data, language, include_recommendations
                ), False
            except Exception as exc:
                logger.warning("OpenAI narrative generation failed: %s — fallback", exc)

        return self._jinja_fallback(report_type, period, data), True

    def _call_openai(
        self,
        report_type: str,
        period: str,
        data: dict,
        language: str,
        include_recommendations: bool,
    ) -> str:
        """Generate narrative using OpenAI API."""
        lang_instruction = "en français" if language == "fr" else "in English"
        reco_instruction = (
            "Inclus des recommandations actionables à la fin."
            if include_recommendations
            else "Ne mets pas de recommandations."
        )

        system_prompt = (
            f"Tu es un analyste financier expert pour un logiciel de caisse en Afrique de l'Ouest. "
            f"Rédige un rapport narratif {lang_instruction} au format Markdown. "
            f"Les montants sont en FCFA. Sois précis et professionnel. {reco_instruction}"
        )

        data_summary = self._format_data_for_prompt(data)

        user_prompt = (
            f"Génère un rapport narratif {report_type} pour la période '{period}'.\n\n"
            f"Données :\n{data_summary}\n\n"
            f"Structure le rapport avec : résumé, analyse des tendances, "
            f"points d'attention, et {'recommandations' if include_recommendations else 'conclusion'}."
        )

        response = self._client.chat.completions.create(
            model=self.model_name,
            max_tokens=self.max_tokens,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return response.choices[0].message.content

    def _jinja_fallback(self, report_type: str, period: str, data: dict) -> str:
        """Generate narrative using Jinja2 templates."""
        if self._jinja_env is None:
            return self._minimal_fallback(report_type, period, data)

        template_str = _TEMPLATES_FR.get(report_type, _DAILY_TEMPLATE_FR)
        template = self._jinja_env.from_string(template_str)

        # Convert dict to object-like access for template
        data_obj = _DataProxy(data)
        rendered = template.render(period=period, data=data_obj)
        # Clean up extra blank lines
        import re
        rendered = re.sub(r"\n{3,}", "\n\n", rendered).strip()
        return rendered

    @staticmethod
    def _minimal_fallback(report_type: str, period: str, data: dict) -> str:
        """Absolute minimal fallback without Jinja2."""
        total_sales = data.get("total_sales", 0)
        tx_count = data.get("transaction_count", 0)
        avg = data.get("average_ticket", 0)
        return (
            f"Rapport {report_type} — {period}\n\n"
            f"Chiffre d'affaires : {total_sales:,.0f} FCFA\n"
            f"Transactions : {tx_count}\n"
            f"Panier moyen : {avg:,.0f} FCFA"
        )

    @staticmethod
    def _format_data_for_prompt(data: dict) -> str:
        """Format KPI data into a clean text for the Claude prompt."""
        lines = []
        if data.get("total_sales"):
            lines.append(f"- Chiffre d'affaires : {data['total_sales']:,.0f} FCFA")
        if data.get("total_expenses"):
            lines.append(f"- Dépenses totales : {data['total_expenses']:,.0f} FCFA")
        if data.get("transaction_count"):
            lines.append(f"- Nombre de transactions : {data['transaction_count']}")
        if data.get("average_ticket"):
            lines.append(f"- Panier moyen : {data['average_ticket']:,.0f} FCFA")
        if data.get("growth_rate") is not None:
            lines.append(f"- Croissance : {data['growth_rate']:.1f}%")
        if data.get("profit_margin") is not None:
            lines.append(f"- Marge bénéficiaire : {data['profit_margin']:.1f}%")
        if data.get("anomaly_count"):
            lines.append(f"- Anomalies détectées : {data['anomaly_count']}")
        if data.get("top_products"):
            lines.append("- Top produits : " + ", ".join(
                f"{p.get('name', '?')} ({p.get('amount', 0):,.0f} FCFA)"
                for p in data["top_products"][:5]
            ))
        if data.get("top_clients"):
            lines.append("- Top clients : " + ", ".join(
                f"{c.get('name', '?')} ({c.get('amount', 0):,.0f} FCFA)"
                for c in data["top_clients"][:5]
            ))
        return "\n".join(lines) if lines else "Aucune donnée disponible."

    # ── Insight Extraction ────────────────────────────────

    @staticmethod
    def extract_insights(data: dict) -> list[dict]:
        """Extract key insights from KPI data."""
        insights = []

        growth = data.get("growth_rate")
        if growth is not None:
            if growth > 10:
                insights.append({
                    "title": "Forte croissance",
                    "description": f"Croissance de {growth:.1f}% par rapport à la période précédente.",
                    "severity": "info",
                    "module": "sales",
                })
            elif growth < -10:
                insights.append({
                    "title": "Baisse significative",
                    "description": f"Recul de {abs(growth):.1f}% par rapport à la période précédente.",
                    "severity": "warning",
                    "module": "sales",
                })

        margin = data.get("profit_margin")
        if margin is not None and margin < 10:
            insights.append({
                "title": "Marge faible",
                "description": f"La marge bénéficiaire est de {margin:.1f}%, en dessous du seuil de 10%.",
                "severity": "warning",
                "module": "expenses",
            })

        anomaly_count = data.get("anomaly_count", 0)
        if anomaly_count > 0:
            severity = "critical" if anomaly_count > 5 else "warning"
            insights.append({
                "title": "Anomalies détectées",
                "description": f"{anomaly_count} anomalie(s) nécessitent une vérification.",
                "severity": severity,
                "module": "sales",
            })

        avg_ticket = data.get("average_ticket", 0)
        if avg_ticket > 0 and data.get("transaction_count", 0) > 0:
            insights.append({
                "title": "Panier moyen",
                "description": f"Le panier moyen est de {avg_ticket:,.0f} FCFA sur {data['transaction_count']} transactions.",
                "severity": "info",
                "module": "sales",
            })

        return insights

    @staticmethod
    def extract_alerts(data: dict) -> list[dict]:
        """Extract alerts from KPI data based on thresholds."""
        alerts = []

        anomaly_count = data.get("anomaly_count", 0)
        if anomaly_count > 5:
            alerts.append({
                "message": f"Nombre élevé d'anomalies ({anomaly_count}) — vérification urgente requise",
                "severity": "critical",
                "metric": "anomaly_count",
                "value": anomaly_count,
                "threshold": 5,
            })
        elif anomaly_count > 0:
            alerts.append({
                "message": f"{anomaly_count} anomalie(s) détectée(s)",
                "severity": "warning",
                "metric": "anomaly_count",
                "value": anomaly_count,
                "threshold": 0,
            })

        growth = data.get("growth_rate")
        if growth is not None and growth < -20:
            alerts.append({
                "message": f"Chute importante du chiffre d'affaires ({growth:.1f}%)",
                "severity": "critical",
                "metric": "growth_rate",
                "value": growth,
                "threshold": -20,
            })

        margin = data.get("profit_margin")
        if margin is not None and margin < 5:
            alerts.append({
                "message": f"Marge bénéficiaire critique ({margin:.1f}%)",
                "severity": "critical",
                "metric": "profit_margin",
                "value": margin,
                "threshold": 5,
            })

        return alerts

    @staticmethod
    def format_period(report_type: str, start: str, end: str) -> str:
        """Format the period string for display."""
        try:
            start_dt = datetime.fromisoformat(start)
            end_dt = datetime.fromisoformat(end)
        except (ValueError, TypeError):
            return f"{start} — {end}"

        months_fr = [
            "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
            "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
        ]

        if report_type == "daily":
            return start_dt.strftime("%d/%m/%Y")
        elif report_type == "weekly":
            return f"Semaine du {start_dt.strftime('%d/%m')} au {end_dt.strftime('%d/%m/%Y')}"
        elif report_type == "monthly":
            return f"{months_fr[start_dt.month]} {start_dt.year}"
        else:
            return f"Du {start_dt.strftime('%d/%m/%Y')} au {end_dt.strftime('%d/%m/%Y')}"


class _DataProxy:
    """Allow attribute-style access on a dict for Jinja2 templates."""

    def __init__(self, data: dict):
        self._data = data

    def __getattr__(self, name: str):
        if name.startswith("_"):
            return super().__getattribute__(name)
        return self._data.get(name)
