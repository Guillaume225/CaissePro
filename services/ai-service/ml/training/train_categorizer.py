#!/usr/bin/env python3
"""Train the expense categorizer model.

Generates synthetic training data (500 examples) augmented with the 50 seed
expenses, trains a TF-IDF + CalibratedLinearSVC pipeline, evaluates it, and
saves the .pkl bundle to ml/models/categorizer.pkl.

Usage:
    cd services/ai-service
    python -m ml.training.train_categorizer
"""

from __future__ import annotations

import json
import logging
import random
import sys
from pathlib import Path

# Ensure project root is importable
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from app.models.categorizer import CATEGORIES, ExpenseCategorizer  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

random.seed(42)

# ── Seed data (50 realistic expenses) ────────────────────
SEED_DATA: list[dict] = [
    # Fournitures bureau (5)
    {"desc": "Achat ramettes papier A4 80g", "amount": 35000, "benef": "Papeterie Centrale", "cat": "Fournitures bureau"},
    {"desc": "Cartouches encre imprimante HP", "amount": 85000, "benef": "Bureau Plus", "cat": "Fournitures bureau"},
    {"desc": "Agrafes, trombones et classeurs", "amount": 12000, "benef": "Papeterie du Marché", "cat": "Fournitures bureau"},
    {"desc": "Achat stylos et marqueurs", "amount": 8500, "benef": "Office Dépôt", "cat": "Fournitures bureau"},
    {"desc": "Cahiers et blocs-notes réunion", "amount": 15000, "benef": "Papeterie Centrale", "cat": "Fournitures bureau"},
    # Transport (5)
    {"desc": "Carburant véhicule de service", "amount": 45000, "benef": "Total Energies", "cat": "Transport"},
    {"desc": "Billet avion mission Douala-Yaoundé", "amount": 120000, "benef": "Camair-Co", "cat": "Transport"},
    {"desc": "Location véhicule mission terrain", "amount": 75000, "benef": "Avis Location", "cat": "Transport"},
    {"desc": "Frais de taxi course professionnelle", "amount": 5000, "benef": "Taxi urbain", "cat": "Transport"},
    {"desc": "Péage autoroute Douala-Yaoundé", "amount": 3000, "benef": "Péage SOCAPALM", "cat": "Transport"},
    # Maintenance (5)
    {"desc": "Réparation climatiseur bureau direction", "amount": 180000, "benef": "Froid Express", "cat": "Maintenance"},
    {"desc": "Entretien groupe électrogène", "amount": 95000, "benef": "ElectroPower", "cat": "Maintenance"},
    {"desc": "Plomberie sanitaires étage 2", "amount": 45000, "benef": "Plombi-Service", "cat": "Maintenance"},
    {"desc": "Remplacement néon bureau comptabilité", "amount": 12000, "benef": "Bricolux", "cat": "Maintenance"},
    {"desc": "Peinture et rénovation salle réunion", "amount": 250000, "benef": "Peinture Pro", "cat": "Maintenance"},
    # Salaires (5)
    {"desc": "Salaire mensuel mars 2026 personnel", "amount": 4500000, "benef": "Paie interne", "cat": "Salaires"},
    {"desc": "Heures supplémentaires février", "amount": 320000, "benef": "Paie interne", "cat": "Salaires"},
    {"desc": "Prime de rendement trimestrielle", "amount": 600000, "benef": "Paie interne", "cat": "Salaires"},
    {"desc": "Indemnité de logement agents", "amount": 250000, "benef": "Paie interne", "cat": "Salaires"},
    {"desc": "Paiement consultant externe audit", "amount": 850000, "benef": "Cabinet Mazars", "cat": "Salaires"},
    # Charges sociales (5)
    {"desc": "Cotisations CNPS trimestrielles", "amount": 1200000, "benef": "CNPS", "cat": "Charges sociales"},
    {"desc": "Assurance maladie employés", "amount": 450000, "benef": "AXA Cameroun", "cat": "Charges sociales"},
    {"desc": "Cotisation retraite complémentaire", "amount": 380000, "benef": "CNPS", "cat": "Charges sociales"},
    {"desc": "Taxe sur les salaires mensuelle", "amount": 520000, "benef": "DGI", "cat": "Charges sociales"},
    {"desc": "Prévoyance sociale octobre", "amount": 290000, "benef": "Mutuelle Santé", "cat": "Charges sociales"},
    # Loyers (5)
    {"desc": "Loyer bureaux siège social mars", "amount": 1200000, "benef": "SCI Immobilia", "cat": "Loyers"},
    {"desc": "Loyer entrepôt stockage zone industrielle", "amount": 450000, "benef": "Immo Plus", "cat": "Loyers"},
    {"desc": "Bail parking véhicules société", "amount": 80000, "benef": "Parking Central", "cat": "Loyers"},
    {"desc": "Location salle conférence journée", "amount": 150000, "benef": "Hôtel Hilton", "cat": "Loyers"},
    {"desc": "Charges locatives trimestrielles", "amount": 350000, "benef": "SCI Immobilia", "cat": "Loyers"},
    # Énergie (5)
    {"desc": "Facture électricité ENEO mars", "amount": 380000, "benef": "ENEO", "cat": "Énergie"},
    {"desc": "Facture eau CDE février", "amount": 45000, "benef": "CDE", "cat": "Énergie"},
    {"desc": "Recharge gaz climatisation", "amount": 65000, "benef": "Gaz Express", "cat": "Énergie"},
    {"desc": "Gasoil groupe électrogène", "amount": 120000, "benef": "Total Energies", "cat": "Énergie"},
    {"desc": "Panneaux solaires maintenance", "amount": 200000, "benef": "Solar Africa", "cat": "Énergie"},
    # Télécom (5)
    {"desc": "Abonnement internet fibre optique", "amount": 85000, "benef": "MTN Business", "cat": "Télécom"},
    {"desc": "Forfait téléphonique flotte entreprise", "amount": 120000, "benef": "Orange Cameroun", "cat": "Télécom"},
    {"desc": "Licence Microsoft 365 annuelle", "amount": 450000, "benef": "Microsoft", "cat": "Télécom"},
    {"desc": "Hébergement serveur cloud", "amount": 180000, "benef": "OVH", "cat": "Télécom"},
    {"desc": "Renouvellement nom de domaine", "amount": 15000, "benef": "GoDaddy", "cat": "Télécom"},
    # Formation (5)
    {"desc": "Séminaire management leadership", "amount": 350000, "benef": "ESSEC Business", "cat": "Formation"},
    {"desc": "Formation sécurité incendie personnel", "amount": 180000, "benef": "SafetyFirst", "cat": "Formation"},
    {"desc": "Cours anglais professionnel", "amount": 120000, "benef": "British Council", "cat": "Formation"},
    {"desc": "Certification comptabilité OHADA", "amount": 250000, "benef": "ONECCA", "cat": "Formation"},
    {"desc": "Atelier Excel avancé équipe finance", "amount": 95000, "benef": "FormaPro", "cat": "Formation"},
    # Divers (5)
    {"desc": "Frais de représentation direction", "amount": 150000, "benef": "Restaurant Le Bois", "cat": "Divers"},
    {"desc": "Cadeaux clients fin d'année", "amount": 200000, "benef": "Artisanat local", "cat": "Divers"},
    {"desc": "Abonnement journal économique", "amount": 25000, "benef": "Jeune Afrique", "cat": "Divers"},
    {"desc": "Don association caritative", "amount": 100000, "benef": "Croix-Rouge", "cat": "Divers"},
    {"desc": "Frais de notaire contrat bail", "amount": 350000, "benef": "Me Nkoulou", "cat": "Divers"},
]

# ── Synthetic data templates per category ─────────────────
SYNTHETIC_TEMPLATES: dict[str, list[dict]] = {
    "Fournitures bureau": [
        {"descs": ["Achat de {item}", "Commande {item} pour le service {dept}", "Réapprovisionnement {item}", "Fourniture {item} bureau"],
         "items": ["papier A4", "papier A3", "enveloppes", "toner", "cartouches", "post-it", "ruban adhésif", "ciseaux", "agrafeuse", "perforatrice", "pochettes plastique", "chemises cartonnées", "étiquettes", "tampons encreurs", "correcteur", "surligneur"],
         "depts": ["comptabilité", "RH", "direction", "commercial", "logistique"],
         "beneficiaries": ["Papeterie Centrale", "Bureau Plus", "Office Dépôt", "Papeterie du Marché", "Fourni-Bureau", "Staples Afrique"],
         "amount_range": (3000, 150000)},
    ],
    "Transport": [
        {"descs": ["Carburant {vehicle}", "Frais de déplacement {dest}", "Billet {mode} {dest}", "Location véhicule {dest}", "Péage {dest}"],
         "vehicles": ["véhicule de service", "camionnette livraison", "voiture direction"],
         "dests": ["Douala", "Yaoundé", "Bafoussam", "Garoua", "Kribi", "mission terrain", "chantier"],
         "modes": ["avion", "bus", "train"],
         "beneficiaries": ["Total Energies", "TRADEX", "Camair-Co", "Avis Location", "Hertz", "SCDP"],
         "amount_range": (2000, 250000)},
    ],
    "Maintenance": [
        {"descs": ["Réparation {equip}", "Entretien {equip}", "Remplacement {piece} {equip}", "Maintenance préventive {equip}", "Dépannage {equip}"],
         "equips": ["climatiseur", "ascenseur", "groupe électrogène", "plomberie", "toiture", "portail", "système alarme", "onduleur"],
         "pieces": ["filtre", "courroie", "compresseur", "moteur", "joint", "robinet"],
         "beneficiaries": ["Froid Express", "ElectroPower", "BâtiService", "Plombi-Service", "Bricolux", "TechniPro"],
         "amount_range": (8000, 500000)},
    ],
    "Salaires": [
        {"descs": ["Salaire {month} {year}", "Paie mensuelle {month}", "Heures supplémentaires {month}", "Prime {type}", "Indemnité {type}", "Rémunération consultant {domain}"],
         "months": ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
         "years": ["2025", "2026"],
         "types": ["de rendement", "trimestrielle", "annuelle", "de transport", "de logement", "de risque"],
         "domains": ["audit", "informatique", "juridique", "comptable"],
         "beneficiaries": ["Paie interne", "Cabinet Mazars", "Deloitte", "Ernst & Young", "Consultant RH"],
         "amount_range": (150000, 6000000)},
    ],
    "Charges sociales": [
        {"descs": ["Cotisations {org} {period}", "Assurance {type} employés", "Charges sociales {period}", "Contribution {org}", "Prévoyance sociale {period}"],
         "orgs": ["CNPS", "DGI", "Mutuelle Santé"],
         "periods": ["trimestrielles", "mensuelles", "annuelles", "T1 2026", "T2 2026"],
         "types": ["maladie", "décès", "invalidité", "maternité"],
         "beneficiaries": ["CNPS", "AXA Cameroun", "DGI", "Mutuelle Santé", "SAHAM Assurance", "Allianz Cameroun"],
         "amount_range": (100000, 2500000)},
    ],
    "Loyers": [
        {"descs": ["Loyer {local} {period}", "Bail {local}", "Location {local} {period}", "Charges locatives {period}", "Caution {local}"],
         "locals": ["bureaux siège", "entrepôt", "parking", "salle conférence", "appartement de fonction", "local commercial"],
         "periods": ["mars 2026", "avril 2026", "trimestriel", "mensuel", "annuel"],
         "beneficiaries": ["SCI Immobilia", "Immo Plus", "Hôtel Hilton", "Propriétaire", "Agence Immo", "Résidence Bonanjo"],
         "amount_range": (50000, 2000000)},
    ],
    "Énergie": [
        {"descs": ["Facture {utility} {period}", "Consommation {utility}", "Recharge {fuel}", "Abonnement {utility}"],
         "utilities": ["électricité ENEO", "eau CDE", "gaz", "énergie solaire"],
         "fuels": ["gaz", "gasoil groupe électrogène", "fioul"],
         "periods": ["mars 2026", "février 2026", "bimestriel", "trimestriel"],
         "beneficiaries": ["ENEO", "CDE", "Total Energies", "Gaz Express", "Solar Africa", "SONATREL"],
         "amount_range": (15000, 500000)},
    ],
    "Télécom": [
        {"descs": ["Abonnement {service}", "Forfait {service}", "Licence {software}", "Renouvellement {service}", "Hébergement {service}"],
         "services": ["internet fibre", "téléphonique flotte", "cloud", "VPN", "vidéoconférence Zoom"],
         "softwares": ["Microsoft 365", "antivirus Kaspersky", "ERP SAP", "Adobe Creative", "Slack Business"],
         "beneficiaries": ["MTN Business", "Orange Cameroun", "Microsoft", "OVH", "GoDaddy", "AWS", "Google Cloud"],
         "amount_range": (10000, 600000)},
    ],
    "Formation": [
        {"descs": ["Formation {topic}", "Séminaire {topic}", "Cours {topic}", "Certification {topic}", "Atelier {topic}", "Stage {topic}"],
         "topics": ["management", "sécurité incendie", "anglais professionnel", "comptabilité OHADA", "Excel avancé", "leadership", "gestion de projet", "marketing digital", "droit du travail", "premiers secours"],
         "beneficiaries": ["ESSEC Business", "British Council", "ONECCA", "FormaPro", "Université Yaoundé", "SafetyFirst", "IFC"],
         "amount_range": (50000, 500000)},
    ],
    "Divers": [
        {"descs": ["Frais de {type}", "Achat {item}", "Abonnement {item}", "Don {dest}", "Frais {type}"],
         "types": ["représentation", "réception", "notaire", "avocat", "huissier", "mission"],
         "items": ["journal économique", "cadeaux clients", "fournitures cuisine", "eau minérale", "café"],
         "dests": ["association", "œuvre caritative", "communauté"],
         "beneficiaries": ["Restaurant Le Bois", "Artisanat local", "Jeune Afrique", "Croix-Rouge", "Me Nkoulou", "Traiteur Élégance"],
         "amount_range": (5000, 400000)},
    ],
}


def _pick(lst: list[str]) -> str:
    return random.choice(lst)


def _generate_synthetic(n_per_category: int = 50) -> list[dict]:
    """Generate n synthetic examples per category."""
    data = []
    for cat_name, templates in SYNTHETIC_TEMPLATES.items():
        tpl = templates[0]
        for _ in range(n_per_category):
            desc_template = _pick(tpl["descs"])
            # Fill in placeholders dynamically
            desc = desc_template
            for key in ["item", "items", "dept", "depts", "vehicle", "vehicles", "dest", "dests",
                        "mode", "modes", "equip", "equips", "piece", "pieces", "month", "months",
                        "year", "years", "type", "types", "domain", "domains", "org", "orgs",
                        "period", "periods", "local", "locals", "utility", "utilities",
                        "fuel", "fuels", "service", "services", "software", "softwares",
                        "topic", "topics"]:
                placeholder = "{" + key + "}"
                if placeholder in desc:
                    # Try plural key first (list), then singular
                    list_key = key + "s" if key + "s" in tpl else key
                    if list_key in tpl:
                        desc = desc.replace(placeholder, _pick(tpl[list_key]))

            lo, hi = tpl["amount_range"]
            amount = random.randint(lo // 1000, hi // 1000) * 1000

            data.append({
                "desc": desc,
                "amount": amount,
                "benef": _pick(tpl["beneficiaries"]),
                "cat": cat_name,
            })
    return data


def load_feedback_data(feedback_path: Path) -> list[dict]:
    """Load previous user feedback from JSONL file."""
    if not feedback_path.exists():
        return []
    data = []
    for line in feedback_path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            record = json.loads(line)
            data.append({
                "desc": record["description"],
                "amount": record["amount"],
                "benef": record.get("beneficiary", ""),
                "cat": record["category_name"],
            })
    return data


def main():
    logger.info("=== CaisseFlow Expense Categorizer Training ===")

    # 1) Combine seed + synthetic + feedback data
    all_data = list(SEED_DATA)
    logger.info("Seed data: %d examples", len(SEED_DATA))

    synthetic = _generate_synthetic(n_per_category=50)
    all_data.extend(synthetic)
    logger.info("Synthetic data: %d examples", len(synthetic))

    feedback_path = PROJECT_ROOT / "ml" / "data" / "feedback.jsonl"
    feedback = load_feedback_data(feedback_path)
    if feedback:
        all_data.extend(feedback)
        logger.info("Feedback data: %d examples", len(feedback))

    logger.info("Total training data: %d examples", len(all_data))

    # 2) Prepare arrays
    descriptions = [d["desc"] for d in all_data]
    amounts = [d["amount"] for d in all_data]
    beneficiaries = [d["benef"] for d in all_data]
    labels = [d["cat"] for d in all_data]

    # Check class distribution
    from collections import Counter
    dist = Counter(labels)
    logger.info("Class distribution: %s", dict(sorted(dist.items())))

    # 3) Train
    categorizer = ExpenseCategorizer()
    report = categorizer.train(descriptions, amounts, beneficiaries, labels)

    # 4) Print evaluation
    logger.info("\n=== Evaluation Results ===")
    logger.info("Accuracy: %.4f", report["accuracy"])
    logger.info("Macro avg — P: %.4f  R: %.4f  F1: %.4f",
                report["macro avg"]["precision"],
                report["macro avg"]["recall"],
                report["macro avg"]["f1-score"])
    logger.info("")
    for cls_name in sorted(CATEGORIES.values()):
        if cls_name in report:
            m = report[cls_name]
            logger.info("  %-20s  P=%.3f  R=%.3f  F1=%.3f  support=%d",
                        cls_name, m["precision"], m["recall"], m["f1-score"], m["support"])

    # 5) Save model
    output_path = PROJECT_ROOT / "ml" / "models" / "categorizer.pkl"
    categorizer.save(str(output_path))
    logger.info("\nModel saved to %s", output_path)
    logger.info("=== Training complete ===")


if __name__ == "__main__":
    main()
