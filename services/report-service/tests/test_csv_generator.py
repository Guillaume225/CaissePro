"""Tests for CSV generator."""

import csv
import os
import tempfile

from app.generators.csv_generator import generate_csv


class TestCsvGenerator:
    def test_generate_csv(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, "test.csv")
            headers = ["Référence", "Client", "Montant"]
            rows = [
                ["VTE-001", "Client A", "100 000 XOF"],
                ["VTE-002", "Client B", "250 000 XOF"],
            ]
            result = generate_csv(headers, rows, output_path)
            assert os.path.exists(result)

            with open(result, "r", encoding="utf-8-sig") as f:
                reader = csv.reader(f, delimiter=";")
                lines = list(reader)
                assert lines[0] == ["Référence", "Client", "Montant"]
                assert lines[1] == ["VTE-001", "Client A", "100 000 XOF"]
                assert len(lines) == 3

    def test_empty_csv(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, "empty.csv")
            result = generate_csv(["A", "B"], [], output_path)
            assert os.path.exists(result)

            with open(result, "r", encoding="utf-8-sig") as f:
                reader = csv.reader(f, delimiter=";")
                lines = list(reader)
                assert len(lines) == 1  # header only

    def test_special_characters(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, "special.csv")
            headers = ["Nom", "Détails"]
            rows = [["Côte d'Ivoire", "Résumé: état budgétaire"]]
            result = generate_csv(headers, rows, output_path)

            with open(result, "r", encoding="utf-8-sig") as f:
                content = f.read()
                assert "Côte d'Ivoire" in content
                assert "état budgétaire" in content

    def test_creates_directory(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, "subdir", "deep", "test.csv")
            result = generate_csv(["A"], [["1"]], output_path)
            assert os.path.exists(result)
