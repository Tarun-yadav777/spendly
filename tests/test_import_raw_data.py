from unittest.mock import MagicMock

import pandas as pd
import pytest

from database import import_raw_data as ird


def _stub_classification(monkeypatch):
    """Isolate transform_data's cleaning logic from real LLM calls."""
    monkeypatch.setattr(ird, "_get_client", lambda: object())
    monkeypatch.setattr(ird, "classify_expense", lambda name, note: "Food")


def _raw_sheet(rows):
    return pd.DataFrame(rows)


# ---- parse_sheet_name ----

def test_parse_sheet_name_valid():
    assert ird.parse_sheet_name("Budget-jul26") == (7, 2026)
    assert ird.parse_sheet_name("Budget-JUL26") == (7, 2026)
    assert ird.parse_sheet_name("Budget-dec25") == (12, 2025)


def test_parse_sheet_name_rejects_sept24():
    with pytest.raises(ValueError):
        ird.parse_sheet_name("Budget-Sept24")


def test_parse_sheet_name_rejects_malformed():
    with pytest.raises(ValueError):
        ird.parse_sheet_name("Budget-25")  # missing month
    with pytest.raises(ValueError):
        ird.parse_sheet_name("Expenses-jul26")  # wrong prefix
    with pytest.raises(ValueError):
        ird.parse_sheet_name("Budget-jul2026")  # 4-digit year


# ---- transform_data ----

def test_transform_data_drops_header_and_total_rows(monkeypatch):
    _stub_classification(monkeypatch)
    raw = {
        "Budget-jan25": _raw_sheet([
            ["BUDGET", None, None],
            ["EXPENSE", "AMOUNT", "Note"],
            ["Rent", 650, "Rent+Wifi"],
            ["Grocery", 50, "Dunnes"],
            ["Total", 700, None],
        ])
    }

    result = ird.transform_data(raw)

    assert len(result) == 2
    assert set(result["expense_name"]) == {"Rent", "Grocery"}
    assert "BUDGET" not in result["expense_name"].values
    assert "Total" not in result["expense_name"].values


def test_transform_data_handles_numeric_note(monkeypatch):
    _stub_classification(monkeypatch)
    raw = {
        "Budget-jan25": _raw_sheet([
            ["BUDGET", None, None],
            ["EXPENSE", "AMOUNT", "Note"],
            ["Mobile Recharge", 13, 48],
            ["Total", 13, None],
        ])
    }

    result = ird.transform_data(raw)

    assert len(result) == 1
    # a numeric note must not crash the pipeline; exact string formatting isn't specified
    assert result.iloc[0]["note"] in ("48", "48.0")


def test_transform_data_rounds_amount(monkeypatch):
    _stub_classification(monkeypatch)
    raw = {
        "Budget-jan25": _raw_sheet([
            ["BUDGET", None, None],
            ["EXPENSE", "AMOUNT", "Note"],
            ["Grocery", 5.5978260869565215, "Dunnes"],
            ["Total", 5.6, None],
        ])
    }

    result = ird.transform_data(raw)

    assert result.iloc[0]["amount"] == 5.6


def test_transform_data_sets_month_year_and_source_sheet(monkeypatch):
    _stub_classification(monkeypatch)
    raw = {
        "Budget-jul26": _raw_sheet([
            ["EXPENSE", "AMOUNT", "Note"],
            ["Rent", 650, "Wifi"],
        ])
    }

    result = ird.transform_data(raw)

    assert result.iloc[0]["month"] == 7
    assert result.iloc[0]["year"] == 2026
    assert result.iloc[0]["source_sheet"] == "Budget-jul26"


def test_transform_data_propagates_bad_sheet_name(monkeypatch):
    _stub_classification(monkeypatch)
    raw = {
        "Budget-Sept24": _raw_sheet([
            ["EXPENSE", "AMOUNT", "Note"],
            ["Rent", 650, "Wifi"],
        ])
    }

    with pytest.raises(ValueError):
        ird.transform_data(raw)


# ---- classify_expense ----

def test_classify_expense_fallback_on_api_error(monkeypatch):
    class FakeMessages:
        def create(self, **kwargs):
            raise ird.anthropic.APIConnectionError(request=MagicMock())

    class FakeClient:
        messages = FakeMessages()

    monkeypatch.setattr(ird, "_get_client", lambda: FakeClient())

    assert ird.classify_expense("Grocery", "Dunnes") == "Others"


def test_classify_expense_fallback_on_invalid_response(monkeypatch):
    class FakeBlock:
        text = "NotACategory"

    class FakeResponse:
        content = [FakeBlock()]

    class FakeMessages:
        def create(self, **kwargs):
            return FakeResponse()

    class FakeClient:
        messages = FakeMessages()

    monkeypatch.setattr(ird, "_get_client", lambda: FakeClient())

    assert ird.classify_expense("Weird Purchase", "") == "Others"


def test_classify_expense_returns_valid_category(monkeypatch):
    class FakeBlock:
        text = "Groceries"

    class FakeResponse:
        content = [FakeBlock()]

    class FakeMessages:
        def create(self, **kwargs):
            return FakeResponse()

    class FakeClient:
        messages = FakeMessages()

    monkeypatch.setattr(ird, "_get_client", lambda: FakeClient())

    assert ird.classify_expense("Grocery", "Dunnes") == "Groceries"


# ---- categorize_expenses caching ----

def test_categorize_expenses_caches_by_pair(monkeypatch):
    monkeypatch.setattr(ird, "_get_client", lambda: object())

    calls = []

    def fake_classify(name, note):
        calls.append((name, note))
        return "Groceries"

    monkeypatch.setattr(ird, "classify_expense", fake_classify)

    df = pd.DataFrame([
        {"expense_name": "Grocery", "note": "Dunnes"},
        {"expense_name": "Grocery", "note": "Dunnes"},
        {"expense_name": "Grocery", "note": "Dunnes"},
        {"expense_name": "Rent", "note": ""},
    ])

    result = ird.categorize_expenses(df)

    assert len(calls) == 2  # one call per unique (name, note) pair
    assert list(result["category"]) == ["Groceries", "Groceries", "Groceries", "Groceries"]
