"""CSV generation."""

import csv
import os


def generate_csv(
    headers: list[str],
    rows: list[list],
    output_path: str,
) -> str:
    """Generate a CSV file."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f, delimiter=";", quoting=csv.QUOTE_MINIMAL)
        writer.writerow(headers)
        writer.writerows(rows)

    return output_path
