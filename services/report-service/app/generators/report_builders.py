"""
Report builders — one function per report type.
Each builder returns (context, table_headers, table_rows, summary) for multi-format output.
"""

from typing import Any
from datetime import date, datetime, timedelta
import asyncio

from app.enums import ReportType
from app.generators.data_collector import (
    fetch_expenses,
    fetch_sales,
    fetch_budgets,
    fetch_receivables,
    fetch_cash_register,
    fetch_client,
    format_xof,
    parse_date,
    aging_bracket,
)
from app.config import get_settings

settings = get_settings()


# ── Helper ──

def _safe_float(v: Any) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _status_class(status: str) -> str:
    s = status.lower()
    if s in ("paid", "completed", "approved", "active"):
        return "success"
    if s in ("pending", "partial", "submitted"):
        return "warning"
    if s in ("cancelled", "rejected", "overdue"):
        return "danger"
    return "info"


# ──────────────────────────────────────────────
# 1. Journal de caisse journalier
# ──────────────────────────────────────────────

async def build_daily_cash_journal(params: dict, token: str | None = None) -> dict:
    report_date = params.get("date", date.today().isoformat())
    cash_register_id = params.get("cash_register_id")

    expense_params: dict[str, Any] = {"date": report_date}
    sale_params: dict[str, Any] = {"date": report_date}
    if cash_register_id:
        sale_params["cashRegisterId"] = cash_register_id

    expenses_raw, sales_raw = await asyncio.gather(
        fetch_expenses(expense_params, token),
        fetch_sales(sale_params, token),
    )

    # Process sales
    sales = []
    total_sales_ht = 0
    total_sales_tva = 0
    total_sales_ttc = 0
    total_collected = 0

    for s in sales_raw:
        ht = _safe_float(s.get("amountHT", s.get("amount", 0)))
        tva = _safe_float(s.get("tvaAmount", ht * settings.tva_rate))
        ttc = _safe_float(s.get("amountTTC", ht + tva))
        total_sales_ht += ht
        total_sales_tva += tva
        total_sales_ttc += ttc
        if s.get("status", "").lower() in ("paid", "completed"):
            total_collected += ttc

        sales.append({
            "reference": s.get("reference", "—"),
            "client_name": s.get("clientName", s.get("client", {}).get("name", "—")),
            "payment_method": s.get("paymentMethod", "—"),
            "amount_ht": format_xof(ht),
            "tva": format_xof(tva),
            "amount_ttc": format_xof(ttc),
            "status": s.get("status", "—"),
            "status_class": _status_class(s.get("status", "")),
        })

    # Process expenses
    expenses = []
    total_exp = 0
    for e in expenses_raw:
        amt = _safe_float(e.get("amount", 0))
        total_exp += amt
        expenses.append({
            "reference": e.get("reference", "—"),
            "category": e.get("categoryName", e.get("category", {}).get("name", "—")),
            "description": e.get("description", "—"),
            "amount": format_xof(amt),
            "status": e.get("status", "—"),
            "status_class": _status_class(e.get("status", "")),
        })

    net = total_sales_ttc - total_exp

    context = {
        "date": report_date,
        "sales": sales,
        "expenses": expenses,
        "total_sales": format_xof(total_sales_ttc),
        "total_sales_ht": format_xof(total_sales_ht),
        "total_sales_tva": format_xof(total_sales_tva),
        "total_collected": format_xof(total_collected),
        "total_expenses": format_xof(total_exp),
        "net_balance": format_xof(net),
    }

    # Table data for Excel/CSV
    headers = ["Type", "Référence", "Description", "Montant HT", "TVA", "Montant TTC", "Statut"]
    rows = []
    for s in sales:
        rows.append(["Vente", s["reference"], s["client_name"], s["amount_ht"], s["tva"], s["amount_ttc"], s["status"]])
    for e in expenses:
        rows.append(["Dépense", e["reference"], e["description"], e["amount"], "—", e["amount"], e["status"]])

    summary = {
        "Date": report_date,
        "Total Ventes TTC": format_xof(total_sales_ttc),
        "Total Encaissé": format_xof(total_collected),
        "Total Dépenses": format_xof(total_exp),
        "Solde Net": format_xof(net),
    }

    return {
        "template": "daily_cash_journal",
        "context": context,
        "table_headers": headers,
        "table_rows": rows,
        "summary": summary,
        "title": f"Journal de Caisse — {report_date}",
    }


# ──────────────────────────────────────────────
# 2. État budgétaire
# ──────────────────────────────────────────────

async def build_budget_status(params: dict, token: str | None = None) -> dict:
    period_start = params.get("period_start", date.today().replace(day=1).isoformat())
    period_end = params.get("period_end", date.today().isoformat())
    department_id = params.get("department_id")
    category_id = params.get("category_id")

    budget_params: dict[str, Any] = {
        "periodStart": period_start,
        "periodEnd": period_end,
    }
    if department_id:
        budget_params["departmentId"] = department_id
    if category_id:
        budget_params["categoryId"] = category_id

    budgets_raw = await fetch_budgets(budget_params, token)

    budgets = []
    total_budget = 0
    total_consumed = 0

    for b in budgets_raw:
        allocated = _safe_float(b.get("amount", b.get("allocated", 0)))
        consumed = _safe_float(b.get("consumed", b.get("spent", 0)))
        remaining = allocated - consumed
        pct = round(consumed / allocated * 100, 1) if allocated > 0 else 0

        total_budget += allocated
        total_consumed += consumed

        budgets.append({
            "category": b.get("categoryName", b.get("category", {}).get("name", "—")),
            "department": b.get("departmentName", b.get("department", {}).get("name", "—")),
            "allocated": format_xof(allocated),
            "consumed": format_xof(consumed),
            "remaining": format_xof(remaining),
            "percentage": pct,
        })

    total_remaining = total_budget - total_consumed
    global_pct = round(total_consumed / total_budget * 100, 1) if total_budget > 0 else 0

    context = {
        "period_start": period_start,
        "period_end": period_end,
        "budgets": budgets,
        "total_budget": format_xof(total_budget),
        "total_consumed": format_xof(total_consumed),
        "total_remaining": format_xof(total_remaining),
        "global_percentage": global_pct,
    }

    headers = ["Catégorie", "Département", "Budget Alloué", "Consommé", "Reste", "Taux (%)"]
    rows = [[b["category"], b["department"], b["allocated"], b["consumed"], b["remaining"], f"{b['percentage']}%"] for b in budgets]

    summary = {
        "Période": f"{period_start} — {period_end}",
        "Budget Total": format_xof(total_budget),
        "Total Consommé": format_xof(total_consumed),
        "Reste Disponible": format_xof(total_remaining),
        "Taux Consommation Global": f"{global_pct}%",
    }

    return {
        "template": "budget_status",
        "context": context,
        "table_headers": headers,
        "table_rows": rows,
        "summary": summary,
        "title": f"État Budgétaire — {period_start} à {period_end}",
    }


# ──────────────────────────────────────────────
# 3. Balance âgée des créances
# ──────────────────────────────────────────────

async def build_aged_receivables(params: dict, token: str | None = None) -> dict:
    as_of = params.get("as_of_date", date.today().isoformat())
    client_id = params.get("client_id")
    as_of_date = parse_date(as_of) or date.today()

    recv_params: dict[str, Any] = {"status": "pending", "asOfDate": as_of}
    if client_id:
        recv_params["clientId"] = client_id

    receivables_raw = await fetch_receivables(recv_params, token)

    # Group by client
    client_map: dict[str, dict] = {}
    invoices = []
    brackets = {"0-30 jours": 0, "31-60 jours": 0, "61-90 jours": 0, "90+ jours": 0}

    for r in receivables_raw:
        due = parse_date(r.get("dueDate"))
        days = (as_of_date - due).days if due else 0
        if days < 0:
            days = 0
        bracket = aging_bracket(days)
        remaining_amt = _safe_float(r.get("remainingAmount", r.get("amount", 0))) - _safe_float(r.get("paidAmount", 0))
        if remaining_amt <= 0:
            continue

        brackets[bracket] += remaining_amt
        cname = r.get("clientName", r.get("client", {}).get("name", "—"))
        cid = r.get("clientId", "unknown")

        if cid not in client_map:
            client_map[cid] = {
                "name": cname,
                "phone": r.get("clientPhone", "—"),
                "bracket_0_30": 0, "bracket_31_60": 0,
                "bracket_61_90": 0, "bracket_90_plus": 0,
                "total": 0, "max_age": 0,
            }
        cm = client_map[cid]
        cm["total"] += remaining_amt
        cm["max_age"] = max(cm["max_age"], days)
        if days <= 30:
            cm["bracket_0_30"] += remaining_amt
        elif days <= 60:
            cm["bracket_31_60"] += remaining_amt
        elif days <= 90:
            cm["bracket_61_90"] += remaining_amt
        else:
            cm["bracket_90_plus"] += remaining_amt

        invoices.append({
            "reference": r.get("reference", "—"),
            "client_name": cname,
            "due_date": r.get("dueDate", "—"),
            "days_overdue": days,
            "total_amount": format_xof(_safe_float(r.get("amount", 0))),
            "paid_amount": format_xof(_safe_float(r.get("paidAmount", 0))),
            "remaining": format_xof(remaining_amt),
        })

    clients = []
    for cm in client_map.values():
        clients.append({
            **cm,
            "bracket_0_30": format_xof(cm["bracket_0_30"]),
            "bracket_31_60": format_xof(cm["bracket_31_60"]),
            "bracket_61_90": format_xof(cm["bracket_61_90"]),
            "bracket_90_plus": format_xof(cm["bracket_90_plus"]),
            "total": format_xof(cm["total"]),
        })

    total = sum(brackets.values())

    context = {
        "as_of_date": as_of,
        "clients": clients,
        "invoices": invoices,
        "total_receivables": format_xof(total),
        "bracket_0_30": format_xof(brackets["0-30 jours"]),
        "bracket_31_60": format_xof(brackets["31-60 jours"]),
        "bracket_61_90": format_xof(brackets["61-90 jours"]),
        "bracket_90_plus": format_xof(brackets["90+ jours"]),
        "bracket_61_plus": format_xof(brackets["61-90 jours"] + brackets["90+ jours"]),
    }

    headers = ["Client", "0-30 j", "31-60 j", "61-90 j", "90+ j", "Total"]
    rows = []
    for cm in client_map.values():
        rows.append([cm["name"], format_xof(cm["bracket_0_30"]), format_xof(cm["bracket_31_60"]),
                      format_xof(cm["bracket_61_90"]), format_xof(cm["bracket_90_plus"]),
                      format_xof(cm["total"])])

    summary = {
        "Date de Référence": as_of,
        "Total Créances": format_xof(total),
        "0-30 jours": format_xof(brackets["0-30 jours"]),
        "31-60 jours": format_xof(brackets["31-60 jours"]),
        "61-90 jours": format_xof(brackets["61-90 jours"]),
        "90+ jours": format_xof(brackets["90+ jours"]),
    }

    return {
        "template": "aged_receivables",
        "context": context,
        "table_headers": headers,
        "table_rows": rows,
        "summary": summary,
        "title": f"Balance Âgée — au {as_of}",
    }


# ──────────────────────────────────────────────
# 4. Bilan de clôture de caisse
# ──────────────────────────────────────────────

async def build_cash_register_closing(params: dict, token: str | None = None) -> dict:
    register_id = params.get("cash_register_id", "")
    report_date = params.get("date", date.today().isoformat())

    register, sales_raw, expenses_raw = await asyncio.gather(
        fetch_cash_register(register_id, token),
        fetch_sales({"date": report_date, "cashRegisterId": register_id}, token),
        fetch_expenses({"date": report_date}, token),
    )

    register = register or {}
    register_name = register.get("name", f"Caisse #{register_id[:8]}" if register_id else "Caisse")
    opening = _safe_float(register.get("openingBalance", 0))
    actual = _safe_float(register.get("actualBalance", register.get("closingBalance", 0)))

    # Process by payment method
    pm_map: dict[str, dict] = {}
    total_income = 0
    for s in sales_raw:
        ttc = _safe_float(s.get("amountTTC", s.get("amount", 0)))
        method = s.get("paymentMethod", "Espèces")
        if method not in pm_map:
            pm_map[method] = {"count": 0, "amount": 0}
        pm_map[method]["count"] += 1
        pm_map[method]["amount"] += ttc
        total_income += ttc

    total_outflow = sum(_safe_float(e.get("amount", 0)) for e in expenses_raw)
    theoretical = opening + total_income - total_outflow
    variance = actual - theoretical
    total_tx = sum(pm["count"] for pm in pm_map.values())

    payment_methods = []
    for method, data in pm_map.items():
        pct = round(data["amount"] / total_income * 100, 1) if total_income > 0 else 0
        payment_methods.append({
            "method": method,
            "count": data["count"],
            "amount": format_xof(data["amount"]),
            "percentage": pct,
        })

    context = {
        "register_name": register_name,
        "date": report_date,
        "opening_balance": format_xof(opening),
        "total_income": format_xof(total_income),
        "total_outflow": format_xof(total_outflow),
        "theoretical_balance": format_xof(theoretical),
        "actual_balance": format_xof(actual),
        "variance": format_xof(variance),
        "variance_abs": abs(variance),
        "payment_methods": payment_methods,
        "total_transactions": total_tx,
    }

    headers = ["Libellé", "Montant"]
    rows = [
        ["Solde d'ouverture", format_xof(opening)],
        ["(+) Encaissements", format_xof(total_income)],
        ["(−) Décaissements", format_xof(total_outflow)],
        ["Solde théorique", format_xof(theoretical)],
        ["Solde réel", format_xof(actual)],
        ["ÉCART", format_xof(variance)],
    ]

    summary = {
        "Caisse": register_name,
        "Date": report_date,
        "Ouverture": format_xof(opening),
        "Encaissements": format_xof(total_income),
        "Décaissements": format_xof(total_outflow),
        "Théorique": format_xof(theoretical),
        "Réel": format_xof(actual),
        "Écart": format_xof(variance),
    }

    return {
        "template": "cash_register_closing",
        "context": context,
        "table_headers": headers,
        "table_rows": rows,
        "summary": summary,
        "title": f"Clôture de Caisse — {register_name} — {report_date}",
    }


# ──────────────────────────────────────────────
# 5. Rapport mensuel consolidé
# ──────────────────────────────────────────────

async def build_monthly_consolidated(params: dict, token: str | None = None) -> dict:
    year = int(params.get("year", date.today().year))
    month = int(params.get("month", date.today().month))
    department_id = params.get("department_id")

    period_start = date(year, month, 1).isoformat()
    next_month = date(year, month, 1) + timedelta(days=32)
    period_end = date(next_month.year, next_month.month, 1).isoformat()

    sale_params: dict[str, Any] = {"periodStart": period_start, "periodEnd": period_end}
    exp_params: dict[str, Any] = {"periodStart": period_start, "periodEnd": period_end}
    if department_id:
        exp_params["departmentId"] = department_id

    sales_raw, expenses_raw, budgets_raw = await asyncio.gather(
        fetch_sales(sale_params, token),
        fetch_expenses(exp_params, token),
        fetch_budgets(exp_params, token),
    )

    # Sales by category
    cat_sales: dict[str, dict] = {}
    total_rev_ht = 0
    total_rev_tva = 0
    total_rev_ttc = 0

    for s in sales_raw:
        ht = _safe_float(s.get("amountHT", s.get("amount", 0)))
        tva_amt = _safe_float(s.get("tvaAmount", ht * settings.tva_rate))
        ttc = ht + tva_amt
        cat = s.get("categoryName", s.get("category", "Divers"))
        if cat not in cat_sales:
            cat_sales[cat] = {"count": 0, "ht": 0, "tva": 0, "ttc": 0}
        cat_sales[cat]["count"] += 1
        cat_sales[cat]["ht"] += ht
        cat_sales[cat]["tva"] += tva_amt
        cat_sales[cat]["ttc"] += ttc
        total_rev_ht += ht
        total_rev_tva += tva_amt
        total_rev_ttc += ttc

    sales_by_category = []
    for cat, data in cat_sales.items():
        pct = round(data["ttc"] / total_rev_ttc * 100, 1) if total_rev_ttc > 0 else 0
        sales_by_category.append({
            "category": cat,
            "count": data["count"],
            "amount_ht": format_xof(data["ht"]),
            "tva": format_xof(data["tva"]),
            "amount_ttc": format_xof(data["ttc"]),
            "percentage": pct,
        })

    # Expenses by category
    cat_exp: dict[str, dict] = {}
    total_exp = 0
    for e in expenses_raw:
        amt = _safe_float(e.get("amount", 0))
        cat = e.get("categoryName", e.get("category", {}).get("name", "Divers"))
        dept = e.get("departmentName", e.get("department", {}).get("name", "—"))
        key = f"{cat}|{dept}"
        if key not in cat_exp:
            cat_exp[key] = {"category": cat, "department": dept, "count": 0, "spent": 0}
        cat_exp[key]["count"] += 1
        cat_exp[key]["spent"] += amt
        total_exp += amt

    # Map budgets
    budget_map: dict[str, float] = {}
    total_budget_val = 0
    for b in budgets_raw:
        bcat = b.get("categoryName", b.get("category", {}).get("name", ""))
        bdept = b.get("departmentName", b.get("department", {}).get("name", ""))
        bkey = f"{bcat}|{bdept}"
        bal = _safe_float(b.get("amount", b.get("allocated", 0)))
        budget_map[bkey] = bal
        total_budget_val += bal

    expenses_by_category = []
    for key, data in cat_exp.items():
        bgt = budget_map.get(key, 0)
        rate = round(data["spent"] / bgt * 100, 1) if bgt > 0 else 0
        expenses_by_category.append({
            **data,
            "budget": format_xof(bgt),
            "spent": format_xof(data["spent"]),
            "rate": rate,
        })

    net_result_raw = total_rev_ttc - total_exp
    net_margin = round(net_result_raw / total_rev_ttc * 100, 1) if total_rev_ttc else 0
    budget_rate = round(total_exp / total_budget_val * 100, 1) if total_budget_val else 0

    month_names = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                   "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

    kpis = [
        {"label": "Chiffre d'affaires TTC", "value": format_xof(total_rev_ttc), "trend": "stable", "change": "—"},
        {"label": "Total dépenses", "value": format_xof(total_exp), "trend": "stable", "change": "—"},
        {"label": "Résultat net", "value": format_xof(net_result_raw), "trend": "up" if net_result_raw >= 0 else "down", "change": format_xof(abs(net_result_raw))},
        {"label": "Marge nette", "value": f"{net_margin}%", "trend": "up" if net_margin > 0 else "down", "change": f"{net_margin}%"},
        {"label": "Nombre de ventes", "value": str(len(sales_raw)), "trend": "stable", "change": "—"},
        {"label": "Nombre de dépenses", "value": str(len(expenses_raw)), "trend": "stable", "change": "—"},
    ]

    context = {
        "month_label": f"{month_names[month]} {year}",
        "sales_by_category": sales_by_category,
        "expenses_by_category": expenses_by_category,
        "kpis": kpis,
        "total_revenue": format_xof(total_rev_ttc),
        "total_revenue_ht": format_xof(total_rev_ht),
        "total_revenue_tva": format_xof(total_rev_tva),
        "total_expenses": format_xof(total_exp),
        "net_result": format_xof(net_result_raw),
        "net_result_raw": net_result_raw,
        "net_margin": net_margin,
        "total_budget": format_xof(total_budget_val),
        "budget_rate": budget_rate,
        "total_sales_count": len(sales_raw),
        "total_expenses_count": len(expenses_raw),
    }

    headers = ["Type", "Catégorie", "Département", "Montant", "% du Total"]
    rows = []
    for sc in sales_by_category:
        rows.append(["Vente", sc["category"], "—", sc["amount_ttc"], f"{sc['percentage']}%"])
    for ec in expenses_by_category:
        rows.append(["Dépense", ec["category"], ec["department"], ec["spent"], f"{ec['rate']}%"])

    summary = {
        "Mois": f"{month_names[month]} {year}",
        "Chiffre d'Affaires": format_xof(total_rev_ttc),
        "Total Dépenses": format_xof(total_exp),
        "Résultat Net": format_xof(net_result_raw),
        "Marge Nette": f"{net_margin}%",
    }

    return {
        "template": "monthly_consolidated",
        "context": context,
        "table_headers": headers,
        "table_rows": rows,
        "summary": summary,
        "title": f"Rapport Consolidé — {month_names[month]} {year}",
    }


# ──────────────────────────────────────────────
# 6. Relevé client
# ──────────────────────────────────────────────

async def build_client_statement(params: dict, token: str | None = None) -> dict:
    client_id = params.get("client_id", "")
    period_start = params.get("period_start", date.today().replace(day=1).isoformat())
    period_end = params.get("period_end", date.today().isoformat())

    client_info, sales_raw = await asyncio.gather(
        fetch_client(client_id, token),
        fetch_sales({"clientId": client_id, "periodStart": period_start, "periodEnd": period_end}, token),
    )

    client_info = client_info or {}
    client_name = client_info.get("name", f"Client #{client_id[:8]}" if client_id else "—")

    transactions = []
    running = 0
    total_debits = 0
    total_credits = 0

    for s in sorted(sales_raw, key=lambda x: x.get("createdAt", x.get("date", ""))):
        ttc = _safe_float(s.get("amountTTC", s.get("amount", 0)))
        paid = _safe_float(s.get("paidAmount", 0))
        status = s.get("status", "")

        # Debit = sale amount, Credit = payment received
        running += ttc
        total_debits += ttc
        transactions.append({
            "date": s.get("date", s.get("createdAt", "—"))[:10],
            "reference": s.get("reference", "—"),
            "description": f"Vente — {s.get('description', s.get('reference', ''))}",
            "debit": format_xof(ttc),
            "credit": "—",
            "running_balance": format_xof(running),
        })

        if paid > 0:
            running -= paid
            total_credits += paid
            transactions.append({
                "date": s.get("paymentDate", s.get("date", "—"))[:10],
                "reference": s.get("reference", "—"),
                "description": f"Paiement reçu",
                "debit": "—",
                "credit": format_xof(paid),
                "running_balance": format_xof(running),
            })

    context = {
        "client_name": client_name,
        "client_phone": client_info.get("phone", "—"),
        "client_email": client_info.get("email", ""),
        "client_address": client_info.get("address", ""),
        "period_start": period_start,
        "period_end": period_end,
        "transactions": transactions,
        "total_purchases": format_xof(total_debits),
        "total_paid": format_xof(total_credits),
        "outstanding_balance": format_xof(total_debits - total_credits),
        "outstanding_raw": total_debits - total_credits,
        "opening_balance": format_xof(0),
        "total_debits": format_xof(total_debits),
        "total_credits": format_xof(total_credits),
        "transaction_count": len(sales_raw),
    }

    headers = ["Date", "Référence", "Description", "Débit", "Crédit", "Solde"]
    rows = [[t["date"], t["reference"], t["description"], t["debit"], t["credit"], t["running_balance"]] for t in transactions]

    summary = {
        "Client": client_name,
        "Période": f"{period_start} — {period_end}",
        "Total Achats": format_xof(total_debits),
        "Total Payé": format_xof(total_credits),
        "Solde Dû": format_xof(total_debits - total_credits),
    }

    return {
        "template": "client_statement",
        "context": context,
        "table_headers": headers,
        "table_rows": rows,
        "summary": summary,
        "title": f"Relevé Client — {client_name}",
    }


# ── Dispatcher ──

BUILDERS = {
    ReportType.DAILY_CASH_JOURNAL: build_daily_cash_journal,
    ReportType.BUDGET_STATUS: build_budget_status,
    ReportType.AGED_RECEIVABLES: build_aged_receivables,
    ReportType.CASH_REGISTER_CLOSING: build_cash_register_closing,
    ReportType.MONTHLY_CONSOLIDATED: build_monthly_consolidated,
    ReportType.CLIENT_STATEMENT: build_client_statement,
}


async def build_report(report_type: ReportType, params: dict, token: str | None = None) -> dict:
    builder = BUILDERS.get(report_type)
    if not builder:
        raise ValueError(f"Type de rapport inconnu: {report_type}")
    return await builder(params, token)
