"""Chatbot engine — OpenAI API integration with intent detection, SQL validation, and RBAC."""

import logging
import re

logger = logging.getLogger(__name__)

# SQL keywords that are NEVER allowed (write operations)
_FORBIDDEN_SQL = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE|MERGE)\b",
    re.IGNORECASE,
)

# Only SELECT-type queries are permitted
_ALLOWED_SQL = re.compile(r"^\s*SELECT\b", re.IGNORECASE)

# Module-to-table mapping for RBAC validation
_MODULE_TABLES: dict[str, set[str]] = {
    "sales": {"sales", "transactions", "orders", "order_items", "payments"},
    "expenses": {"expenses", "expense_categories", "receipts"},
    "inventory": {"products", "stock", "inventory", "stock_movements"},
    "clients": {"clients", "customers", "client_scores"},
}

# Intent detection keywords
_INTENT_KEYWORDS: dict[str, list[str]] = {
    "query_data": [
        "combien", "total", "montant", "nombre", "liste", "top",
        "how many", "total", "amount", "count", "list",
        "chiffre d'affaires", "ca", "ventes", "dépenses",
        "moyenne", "average", "somme", "sum",
    ],
    "explanation": [
        "pourquoi", "expliquer", "comment", "qu'est-ce",
        "why", "explain", "how", "what is", "what are",
        "cause", "raison", "signifie", "meaning",
    ],
    "recommendation": [
        "recommander", "suggérer", "conseil", "améliorer", "optimiser",
        "recommend", "suggest", "advice", "improve", "optimize",
        "que faire", "what should", "best practice",
    ],
}


class ChatbotEngine:
    """AI chatbot engine with OpenAI API, SQL validation, and RBAC filtering."""

    def __init__(
        self,
        openai_api_key: str | None = None,
        model_name: str = "gpt-4o",
        max_tokens: int = 1024,
    ):
        self.model_name = model_name
        self.max_tokens = max_tokens
        self._client = None

        if openai_api_key:
            try:
                from openai import OpenAI
                self._client = OpenAI(api_key=openai_api_key)
                logger.info("OpenAI client initialized (model=%s)", model_name)
            except ImportError:
                logger.warning("openai package not installed — fallback mode only")
            except Exception as exc:
                logger.warning("Failed to init OpenAI client: %s — fallback mode", exc)

    @property
    def is_online(self) -> bool:
        return self._client is not None

    # ── Intent Detection ─────────────────────────────────

    def detect_intent(self, message: str) -> str:
        """Classify user intent from message text."""
        msg_lower = message.lower()
        scores: dict[str, int] = {"query_data": 0, "explanation": 0, "recommendation": 0}

        for intent, keywords in _INTENT_KEYWORDS.items():
            for kw in keywords:
                if kw in msg_lower:
                    scores[intent] += 1

        best = max(scores, key=scores.get)  # type: ignore[arg-type]
        if scores[best] == 0:
            return "general"
        return best

    # ── SQL Validation ───────────────────────────────────

    @staticmethod
    def validate_sql(sql: str) -> tuple[bool, str]:
        """Validate that an SQL string is safe (read-only, no injection).

        Returns (is_valid, error_message).
        """
        if not sql or not sql.strip():
            return False, "SQL vide"

        # Block write/DDL operations
        if _FORBIDDEN_SQL.search(sql):
            return False, "Opérations d'écriture interdites (INSERT/UPDATE/DELETE/DROP/...)"

        # Must start with SELECT
        if not _ALLOWED_SQL.match(sql):
            return False, "Seules les requêtes SELECT sont autorisées"

        # Block common injection patterns
        if "--" in sql or "/*" in sql or ";" in sql:
            return False, "Caractères suspects détectés (commentaires ou multi-requêtes)"

        # Block UNION-based injection
        if re.search(r"\bUNION\b", sql, re.IGNORECASE):
            return False, "UNION non autorisé pour des raisons de sécurité"

        return True, ""

    # ── RBAC Filtering ───────────────────────────────────

    @staticmethod
    def check_rbac(
        query_tables: list[str],
        allowed_modules: list[str],
    ) -> tuple[bool, list[str]]:
        """Check if the user has access to the requested tables.

        Returns (is_allowed, denied_tables).
        """
        allowed_tables: set[str] = set()
        for module in allowed_modules:
            allowed_tables.update(_MODULE_TABLES.get(module, set()))

        denied = [t for t in query_tables if t.lower() not in allowed_tables]
        return len(denied) == 0, denied

    @staticmethod
    def extract_tables(sql: str) -> list[str]:
        """Extract table names from a simple SELECT query."""
        # Match FROM <table> and JOIN <table>
        tables = re.findall(
            r"\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)",
            sql, re.IGNORECASE,
        )
        return list(dict.fromkeys(tables))  # unique, preserve order

    # ── Chat Generation ──────────────────────────────────

    def generate_response(
        self,
        message: str,
        conversation_history: list[dict] | None = None,
        system_prompt: str | None = None,
        module: str | None = None,
    ) -> tuple[str, bool]:
        """Generate a response using Claude API or fallback.

        Returns (response_text, is_offline).
        """
        if self._client is not None:
            try:
                return self._call_openai(message, conversation_history, system_prompt), False
            except Exception as exc:
                logger.warning("OpenAI API call failed: %s — using fallback", exc)

        return self._fallback_response(message, module), True

    def _call_openai(
        self,
        message: str,
        conversation_history: list[dict] | None = None,
        system_prompt: str | None = None,
    ) -> str:
        """Call OpenAI Chat Completions API."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        if conversation_history:
            for msg in conversation_history[-10:]:  # keep last 10 for context window
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })
        messages.append({"role": "user", "content": message})

        response = self._client.chat.completions.create(
            model=self.model_name,
            max_tokens=self.max_tokens,
            messages=messages,
        )
        return response.choices[0].message.content

    @staticmethod
    def _fallback_response(message: str, module: str | None = None) -> str:
        """Generate a smart rule-based fallback when Claude is unavailable."""
        msg_lower = message.lower()
        m = module or "expense"

        # ── Module-specific keyword → response maps ──────────────

        # ADMIN module
        if m == "admin":
            if any(w in msg_lower for w in ["utilisateur", "user", "combien d'util", "nombre d'util", "actif"]):
                return (
                    "Pour connaître le nombre d'utilisateurs, consultez la page Gestion des utilisateurs.\n\n"
                    "Depuis le module Administration :\n"
                    "• Allez dans **Gestion des utilisateurs** (/admin/users)\n"
                    "• Vous y verrez la liste complète avec les filtres par statut\n"
                    "• Les KPIs admin affichent aussi le nombre d'utilisateurs actifs\n\n"
                    "[ACTION: navigate | Voir les utilisateurs | /admin/users]"
                )
            if any(w in msg_lower for w in ["rôle", "role", "permission"]):
                return (
                    "Les rôles et permissions sont gérés dans la section dédiée :\n\n"
                    "• **Gestion des rôles** (/admin/roles) : créer, modifier et assigner des rôles\n"
                    "• **Permissions** : chaque rôle possède un ensemble de permissions granulaires\n"
                    "• Rôles par défaut : admin, manager, cashier, viewer\n\n"
                    "[ACTION: navigate | Gestion des rôles | /admin/roles]"
                )
            if any(w in msg_lower for w in ["audit", "log", "journal", "action", "dernière"]):
                return (
                    "Les journaux d'audit enregistrent toutes les actions des utilisateurs :\n\n"
                    "• Consultez **Journaux d'audit** (/admin/audit) pour l'historique complet\n"
                    "• Filtrez par utilisateur, type d'action, ou période\n"
                    "• Les 10 dernières actions apparaissent aussi sur le dashboard admin\n\n"
                    "[ACTION: navigate | Journaux d'audit | /admin/audit]"
                )
            if any(w in msg_lower for w in ["société", "company", "entreprise"]):
                return (
                    "La gestion multi-sociétés est accessible depuis :\n\n"
                    "• **Gestion des sociétés** (/admin/companies)\n"
                    "• Vous pouvez créer, modifier et basculer entre les sociétés\n"
                    "• Chaque société a ses propres paramètres et utilisateurs\n\n"
                    "[ACTION: navigate | Gestion des sociétés | /admin/companies]"
                )
            if any(w in msg_lower for w in ["employé", "employee", "salarié"]):
                return (
                    "La gestion des employés permet de :\n\n"
                    "• Créer et modifier les fiches employés (/admin/employees)\n"
                    "• Définir les limites de décaissement par employé\n"
                    "• Gérer les accès au portail employé\n\n"
                    "[ACTION: navigate | Gestion des employés | /admin/employees]"
                )
            if any(w in msg_lower for w in ["circuit", "validation", "approbation"]):
                return (
                    "Les circuits de validation définissent le workflow d'approbation :\n\n"
                    "• Configurez les étapes de validation dans **Circuits de validation**\n"
                    "• Définissez les seuils de montant par niveau d'approbation\n"
                    "• Les circuits s'appliquent aux dépenses et demandes de décaissement\n\n"
                    "[ACTION: navigate | Circuits de validation | /admin/approval-circuits]"
                )
            if any(w in msg_lower for w in ["sécurité", "security", "mot de passe", "mfa"]):
                return (
                    "Les paramètres de sécurité incluent :\n\n"
                    "• Configuration MFA (authentification multi-facteurs)\n"
                    "• Politique de mots de passe\n"
                    "• Gestion des sessions\n"
                    "• Consultez **Paramètres de sécurité** (/admin/security)\n\n"
                    "[ACTION: navigate | Paramètres de sécurité | /admin/security]"
                )

        # EXPENSE module
        if m == "expense":
            if any(w in msg_lower for w in ["dépense", "expense", "coût", "montant"]):
                return (
                    "Pour consulter vos dépenses :\n\n"
                    "• **Liste des dépenses** (/expenses) avec filtres et pagination\n"
                    "• Les KPIs dépenses affichent le total, les en-attente et le budget\n"
                    "• Vous pouvez créer une nouvelle dépense depuis /expenses/new\n\n"
                    "[ACTION: navigate | Voir les dépenses | /expenses]"
                )
            if any(w in msg_lower for w in ["demande", "décaissement", "attente", "pending"]):
                return (
                    "Les demandes de décaissement en attente sont visibles ici :\n\n"
                    "• Page **Demandes en attente** (/pending-requests)\n"
                    "• Vous pouvez approuver, rejeter ou traiter les demandes\n"
                    "• Chaque demande a une référence de suivi\n\n"
                    "[ACTION: navigate | Demandes en attente | /pending-requests]"
                )
            if any(w in msg_lower for w in ["caisse", "clôture", "journée", "ouvrir", "fermer"]):
                return (
                    "Pour la gestion de caisse :\n\n"
                    "• Le tableau de bord affiche l'état actuel de la caisse\n"
                    "• Ouvrez/clôturez la journée depuis le dashboard\n"
                    "• Les opérations du jour sont listées en temps réel\n\n"
                    "[ACTION: navigate | Tableau de bord | /]"
                )
            if any(w in msg_lower for w in ["rapport", "report", "export"]):
                return (
                    "Les rapports de caisse sont disponibles :\n\n"
                    "• **Rapports de caisse** (/expenses/cash-reports)\n"
                    "• Filtrez par période pour des rapports détaillés\n"
                    "• Export disponible en PDF et Excel\n\n"
                    "[ACTION: navigate | Rapports de caisse | /expenses/cash-reports]"
                )
            if any(w in msg_lower for w in ["créer", "nouvelle", "ajouter", "new"]):
                return (
                    "Pour créer une nouvelle dépense :\n\n"
                    "1. Allez sur **Créer une dépense** (/expenses/new)\n"
                    "2. Remplissez le formulaire (montant, catégorie, bénéficiaire)\n"
                    "3. Ajoutez les pièces jointes si nécessaire\n"
                    "4. Soumettez pour validation\n\n"
                    "[ACTION: navigate | Créer une dépense | /expenses/new]"
                )
            if any(w in msg_lower for w in ["avance", "advance", "justif"]):
                return (
                    "La gestion des avances permet de :\n\n"
                    "• Créer des avances pour les employés\n"
                    "• Suivre les justificatifs d'avances\n"
                    "• Les avances non justifiées apparaissent dans les alertes\n\n"
                    "[ACTION: navigate | Voir les dépenses | /expenses]"
                )

        # FNE module
        if m == "fne":
            if any(w in msg_lower for w in ["facture", "invoice", "fne"]):
                return (
                    "Pour gérer vos factures FNE :\n\n"
                    "• **Liste des factures** (/fne/invoices) avec statuts et filtres\n"
                    "• Créez une facture FNE depuis /fne/invoices/new\n"
                    "• Certifiez les factures manuellement ou en masse\n\n"
                    "[ACTION: navigate | Voir les factures | /fne/invoices]"
                )
            if any(w in msg_lower for w in ["vignette", "sticker", "solde"]):
                return (
                    "Le solde de vignettes est consultable depuis le dashboard FNE :\n\n"
                    "• Le KPI « Solde vignettes » s'affiche sur /fne\n"
                    "• L'API /fne-invoices/sticker-balance retourne le solde exact\n\n"
                    "[ACTION: navigate | Dashboard FNE | /fne]"
                )
            if any(w in msg_lower for w in ["client", "customer"]):
                return (
                    "Les clients FNE sont gérés séparément :\n\n"
                    "• **Liste clients FNE** (/fne/clients)\n"
                    "• Créez, modifiez ou supprimez des clients FNE\n"
                    "• Les clients sont liés aux factures\n\n"
                    "[ACTION: navigate | Clients FNE | /fne/clients]"
                )
            if any(w in msg_lower for w in ["produit", "product", "article"]):
                return (
                    "Les produits FNE sont gérés ici :\n\n"
                    "• **Liste produits FNE** (/fne/products)\n"
                    "• Chaque produit a son code, sa description et son taux de taxe\n\n"
                    "[ACTION: navigate | Produits FNE | /fne/products]"
                )
            if any(w in msg_lower for w in ["comptab", "écriture", "accounting"]):
                return (
                    "La comptabilité FNE permet de :\n\n"
                    "• Générer les écritures comptables à partir des factures\n"
                    "• Consulter les écritures sur /fne/accounting\n"
                    "• Exporter pour votre logiciel comptable\n\n"
                    "[ACTION: navigate | Comptabilité FNE | /fne/accounting]"
                )
            if any(w in msg_lower for w in ["certif", "normaliser"]):
                return (
                    "La certification FNE :\n\n"
                    "• Certifiez une facture individuellement depuis son détail\n"
                    "• Utilisez la certification en masse depuis la liste\n"
                    "• Les factures certifiées reçoivent un numéro normalisé unique\n\n"
                    "[ACTION: navigate | Voir les factures | /fne/invoices]"
                )

        # DECISION module
        if m == "decision":
            if any(w in msg_lower for w in ["dépense", "valider", "approuver", "rejeter", "attente", "pending"]):
                return (
                    "Les dépenses en attente de validation :\n\n"
                    "• Consultez **Validation des dépenses** (/validation)\n"
                    "• Approuvez ou rejetez chaque dépense avec un motif\n"
                    "• Les demandes de décaissement sont aussi disponibles\n\n"
                    "[ACTION: navigate | Validation dépenses | /validation]"
                )
            if any(w in msg_lower for w in ["kpi", "indicateur", "chiffre", "résumé", "tableau"]):
                return (
                    "Vos indicateurs clés depuis le dashboard décisionnaire :\n\n"
                    "• Solde de caisse, dépenses du mois, revenus\n"
                    "• Tendances et comparaisons mensuelles\n"
                    "• Alertes IA sur les anomalies détectées\n\n"
                    "[ACTION: navigate | Dashboard | /]"
                )
            if any(w in msg_lower for w in ["mois", "month", "mensuel"]):
                return (
                    "Les dépenses du mois en cours :\n\n"
                    "• Consultez **Dépenses du mois** (/month-expenses)\n"
                    "• Vue agrégée par catégorie et par statut\n"
                    "• Comparez avec les mois précédents\n\n"
                    "[ACTION: navigate | Dépenses du mois | /month-expenses]"
                )
            if any(w in msg_lower for w in ["devis", "commentaire", "décision"]):
                return (
                    "La liste des devis avec commentaires décisionnels :\n\n"
                    "• Consultez **Liste des devis** (/devis)\n"
                    "• Ajoutez des commentaires décisionnels sur chaque devis\n"
                    "• Les factures FNE sont accessibles en lecture seule\n\n"
                    "[ACTION: navigate | Liste des devis | /devis]"
                )
            if any(w in msg_lower for w in ["facture", "fne", "invoice"]):
                return (
                    "Les factures FNE sont accessibles en lecture seule :\n\n"
                    "• Consultez les factures sans modification possible\n"
                    "• Ajoutez des commentaires décisionnels via le bouton dédié\n\n"
                    "[ACTION: navigate | Factures FNE | /fne/invoices]"
                )

        # MANAGER-CAISSE module
        if m == "manager-caisse":
            if any(w in msg_lower for w in ["état", "caisse", "state", "solde"]):
                return (
                    "L'état actuel de la caisse :\n\n"
                    "• Consultez le **Dashboard manager** (/manager-caisse/dashboard)\n"
                    "• KPIs : solde, trésorerie, opérations du jour\n"
                    "• Ouvrez ou clôturez la journée de caisse\n\n"
                    "[ACTION: navigate | Dashboard manager | /manager-caisse/dashboard]"
                )
            if any(w in msg_lower for w in ["clôture", "historique", "closing", "history"]):
                return (
                    "L'historique des clôtures de caisse :\n\n"
                    "• **Historique des clôtures** (/manager-caisse/closing-history)\n"
                    "• Filtrez par période pour retrouver une journée précise\n"
                    "• Chaque clôture contient le détail des opérations\n\n"
                    "[ACTION: navigate | Historique clôtures | /manager-caisse/closing-history]"
                )
            if any(w in msg_lower for w in ["écriture", "comptab", "accounting", "entry"]):
                return (
                    "Les écritures comptables :\n\n"
                    "• Consultez les écritures sur /manager-caisse/accounting-entries\n"
                    "• Traitez ou annulez les écritures en attente\n"
                    "• Configuration comptable sur /manager-caisse/accounting\n\n"
                    "[ACTION: navigate | Écritures comptables | /manager-caisse/accounting-entries]"
                )
            if any(w in msg_lower for w in ["catégorie", "category"]):
                return (
                    "La gestion des catégories de dépenses :\n\n"
                    "• Créez et modifiez les catégories depuis /manager-caisse/categories\n"
                    "• Chaque catégorie peut avoir un code comptable associé\n\n"
                    "[ACTION: navigate | Gestion catégories | /manager-caisse/categories]"
                )
            if any(w in msg_lower for w in ["rapport", "période", "report"]):
                return (
                    "Les rapports par période :\n\n"
                    "• **Rapports par période** (/manager-caisse/period-reports)\n"
                    "• Choisissez la période et le type de rapport\n"
                    "• Export disponible en PDF et Excel\n\n"
                    "[ACTION: navigate | Rapports par période | /manager-caisse/period-reports]"
                )
            if any(w in msg_lower for w in ["paramètre", "setting", "config"]):
                return (
                    "Les paramètres de caisse :\n\n"
                    "• **Paramètres de caisse** (/manager-caisse/settings)\n"
                    "• Configurez les heures d'ouverture, les limites, etc.\n"
                    "• Configuration comptable sur /manager-caisse/accounting\n\n"
                    "[ACTION: navigate | Paramètres de caisse | /manager-caisse/settings]"
                )

        # ── Cross-module generic responses ───────────────────
        if any(w in msg_lower for w in ["bonjour", "salut", "hello", "hi", "bonsoir"]):
            module_names = {
                "expense": "Caisse Dépenses",
                "fne": "FNE (Factures Normalisées)",
                "admin": "Administration",
                "decision": "Décisionnaire",
                "manager-caisse": "Manager Caisse",
            }
            name = module_names.get(m, m)
            return (
                f"Bonjour ! Je suis l'assistant IA du module **{name}**.\n\n"
                "Je peux vous aider à :\n"
                "• Naviguer vers les pages du module\n"
                "• Répondre à vos questions sur les fonctionnalités\n"
                "• Vous guider dans vos tâches quotidiennes\n\n"
                "Que souhaitez-vous faire ?"
            )

        if any(w in msg_lower for w in ["aide", "help", "quoi faire", "comment"]):
            return (
                "Voici comment je peux vous aider :\n\n"
                "• Posez-moi une question sur votre module actif\n"
                "• Demandez-moi de vous diriger vers une page\n"
                "• Interrogez-moi sur les fonctionnalités disponibles\n\n"
                "Essayez par exemple : « Quelles sont les fonctionnalités disponibles ? »"
            )

        if any(w in msg_lower for w in ["merci", "thank"]):
            return "De rien ! N'hésitez pas si vous avez d'autres questions."

        if any(w in msg_lower for w in ["fonctionnalité", "feature", "quoi", "que peux"]):
            _features = {
                "expense": (
                    "Le module **Caisse Dépenses** offre :\n\n"
                    "• Gestion des dépenses (création, soumission, validation)\n"
                    "• Demandes de décaissement\n"
                    "• Ouverture/clôture de caisse\n"
                    "• Rapports de caisse\n"
                    "• Gestion des avances\n"
                    "• Notifications"
                ),
                "fne": (
                    "Le module **FNE** offre :\n\n"
                    "• Création et certification de factures normalisées\n"
                    "• Gestion des clients et produits FNE\n"
                    "• Comptabilité FNE (écritures comptables)\n"
                    "• Dashboard avec KPIs et tendances\n"
                    "• Import/export en masse"
                ),
                "admin": (
                    "Le module **Administration** offre :\n\n"
                    "• Gestion des utilisateurs et rôles\n"
                    "• Gestion des sociétés et employés\n"
                    "• Configuration FNE\n"
                    "• Circuits de validation\n"
                    "• Journaux d'audit\n"
                    "• Concepteur de rapports\n"
                    "• Paramètres de sécurité"
                ),
                "decision": (
                    "Le module **Décisionnaire** offre :\n\n"
                    "• Dashboard exécutif avec KPIs consolidés\n"
                    "• Validation des dépenses (approuver/rejeter)\n"
                    "• Vue des dépenses du mois\n"
                    "• Liste des devis avec commentaires décisionnels\n"
                    "• Consultation FNE en lecture seule"
                ),
                "manager-caisse": (
                    "Le module **Manager Caisse** offre :\n\n"
                    "• Dashboard manager avec KPIs\n"
                    "• Gestion des clôtures de caisse\n"
                    "• Écritures comptables\n"
                    "• Rapports par période\n"
                    "• Gestion des catégories\n"
                    "• Configuration comptable"
                ),
            }
            return _features.get(m, _features["expense"])

        # ── Ultimate generic fallback ────────────────────
        module_names = {
            "expense": "Caisse Dépenses",
            "fne": "FNE",
            "admin": "Administration",
            "decision": "Décisionnaire",
            "manager-caisse": "Manager Caisse",
        }
        name = module_names.get(m, m)
        return (
            f"Je suis l'assistant IA du module **{name}**. "
            "Je n'ai pas bien compris votre demande.\n\n"
            "Essayez de reformuler ou posez-moi une question comme :\n"
            "• « Quelles sont les fonctionnalités disponibles ? »\n"
            "• « Comment créer une dépense ? »\n"
            "• « Montre-moi les KPIs »"
        )

    # ── System Prompt Builder ────────────────────────────

    @staticmethod
    def build_system_prompt(user_role: str, allowed_modules: list[str]) -> str:
        """Build the system prompt with RBAC context."""
        modules_str = ", ".join(allowed_modules)
        return (
            "Tu es l'assistant IA de CaisseFlow Pro, un logiciel de gestion de caisse "
            "pour les commerces en Afrique de l'Ouest (FCFA). "
            f"L'utilisateur a le rôle '{user_role}' et accès aux modules : {modules_str}. "
            "Réponds de manière concise et professionnelle en français. "
            "Si on te demande des données, structure ta réponse clairement. "
            "Ne fournis JAMAIS d'informations sur des modules auxquels l'utilisateur n'a pas accès. "
            "Les montants sont toujours en FCFA."
        )
