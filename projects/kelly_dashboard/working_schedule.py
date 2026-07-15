"""Per-area working-schedule overrides.

The dashboard infers each plant-area's working weekdays from historical Actual
(see ``data_loader._add_working_flag``): a day is non-working where Actual is
missing or 100% ("closed"). That inference is correct for every area currently
in the data (verified across all five plants).

This module is the escape hatch for the rare cases the *data itself* can't
reveal — e.g. an area whose source rows are missing on the days it actually
operates. An entry here overrides the inferred schedule for that one area.
Keep it minimal; empty means pure inference.
"""
from __future__ import annotations

# (warehouse_id, area ID) -> frozenset of working weekdays (Mon=0 .. Sun=6).
# Consulted AFTER data inference and wins over it.
AREA_WORKDAY_OVERRIDES: dict[tuple[str, str], frozenset[int]] = {
    # Columbus "Weekend Shift" crews have no weekend rows in the source, so they
    # are inferred Mon–Fri (a data gap). Uncomment with the real schedule once
    # confirmed by the plant:
    # ("columbus", "ECP (Contacts) — Weekend Shift"): frozenset({5, 6}),
    # ("columbus", "Lens — Weekend Shift"): frozenset({5, 6}),
}
