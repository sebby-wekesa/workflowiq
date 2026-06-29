"""
accounting/summaries.py

Live aggregation helpers that read the ledger and roll accounts up into the buckets
the Home page and Cash Book need. Everything is derived from posted journal lines —
nothing stored, so every figure is current as at the moment it's read.
"""

from decimal import Decimal
from django.db.models import Sum

from .models import Account, AccountType, JournalLine, EntryStatus
from .services import account_balance
from .classification import CLASSIFICATIONS


# Map our classification subtypes to the Home-page buckets.
CASH_BANK_SUBTYPES = {"Cash & Cash Equivalents"}
RECEIVABLE_SUBTYPES = {"Trade & Other Receivables"}
PAYABLE_SUBTYPES = {"Trade & Other Payables"}
LOAN_SUBTYPES = {"Loans & Borrowings", "Long-Term Liabilities"}
ACCRUAL_SUBTYPES = {"Other Current Liabilities"}


def _accounts_by_subtypes(org, subtypes):
    return Account.objects.filter(
        organization=org, is_active=True, subtype__in=subtypes
    ).order_by("code")


def _sum_balances(accounts):
    total = Decimal("0.00")
    rows = []
    for a in accounts:
        bal = account_balance(a)
        rows.append({"account": a, "balance": bal})
        total += bal
    return rows, total


def cash_and_bank(org):
    """
    Cash at bank and cash in hand. We distinguish 'bank' from physical cash by name
    heuristic: accounts under Cash & Cash Equivalents whose name contains 'cash' (and
    not 'bank') are treated as cash-in-hand; the rest are bank. This keeps it working
    with existing data; a dedicated flag can replace the heuristic later.
    """
    accts = _accounts_by_subtypes(org, CASH_BANK_SUBTYPES)
    bank_rows, cash_rows = [], []
    bank_total = cash_total = Decimal("0.00")
    for a in accts:
        bal = account_balance(a)
        name = a.name.lower()
        is_cash_in_hand = ("cash" in name and "bank" not in name) or "petty" in name
        if is_cash_in_hand:
            cash_rows.append({"account": a, "balance": bal}); cash_total += bal
        else:
            bank_rows.append({"account": a, "balance": bal}); bank_total += bal
    return {
        "bank_rows": bank_rows, "bank_total": bank_total,
        "cash_rows": cash_rows, "cash_total": cash_total,
        "grand_total": bank_total + cash_total,
    }


def debtors(org):
    rows, total = _sum_balances(_accounts_by_subtypes(org, RECEIVABLE_SUBTYPES))
    return {"rows": rows, "total": total}


def creditors(org):
    rows, total = _sum_balances(_accounts_by_subtypes(org, PAYABLE_SUBTYPES))
    return {"rows": rows, "total": total}


def accruals(org):
    rows, total = _sum_balances(_accounts_by_subtypes(org, ACCRUAL_SUBTYPES))
    return {"rows": rows, "total": total}


def outstanding_loans(org):
    rows, total = _sum_balances(_accounts_by_subtypes(org, LOAN_SUBTYPES))
    return {"rows": rows, "total": total}
