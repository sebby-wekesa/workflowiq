"""
accounting/views_five_page.py

Page 1 (Home) and Page 3 (Chart of Accounts & Ledgers) of the five-page dashboard.
Both are pure reads over the existing ledger — no posting here.

Pages 2 (Accountant posting forms), 4 (financial statements), and 5 (tax) wait on
TJ's form/statement detail before they're built.
"""

from decimal import Decimal
from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required

from .models import Account, AccountType, JournalLine, EntryStatus
from .services import account_balance
from .views_petty_cash import get_active_organization
from . import summaries
from .loans import upcoming_repayments


@login_required
def home(request):
    """Page 1 — live at-a-glance figures."""
    org = get_active_organization(request)
    return render(request, "accounting/five/home.html", {
        "cashbank": summaries.cash_and_bank(org),
        "loans": summaries.outstanding_loans(org),
        "upcoming": upcoming_repayments(org, within_days=30),
        "debtors": summaries.debtors(org),
        "creditors": summaries.creditors(org),
        "accruals": summaries.accruals(org),
    })


@login_required
def chart_and_ledgers(request):
    """
    Page 3 — chart of accounts, each account with a quick balance. Clicking an account
    opens its full T-account ledger (ledger view below). We list accounts grouped by
    type so the chart reads naturally.
    """
    org = get_active_organization(request)
    accounts = (
        Account.objects.filter(organization=org, is_active=True)
        .order_by("type", "code")
    )
    by_type = {}
    for a in accounts:
        by_type.setdefault(a.get_type_display(), []).append({
            "account": a, "balance": account_balance(a),
        })
    return render(request, "accounting/five/chart_ledgers.html", {
        "by_type": by_type,
    })


@login_required
def account_ledger(request, account_id):
    """
    The T-account for one account: debits on the left, credits on the right, running
    balance, printable as a monthly/yearly POS-style report.
    """
    org = get_active_organization(request)
    account = get_object_or_404(Account, pk=account_id, organization=org)

    period = request.GET.get("period", "all")  # all | month | year (filter hook)
    qs = JournalLine.objects.filter(
        account=account,
        entry__status__in=[EntryStatus.POSTED, EntryStatus.REVERSED],
    ).select_related("entry").order_by("entry__date", "entry__id", "id")

    debit_normal = account.normal_side == "debit"
    running = Decimal("0.00")
    debit_total = credit_total = Decimal("0.00")
    rows = []
    for ln in qs:
        debit_total += ln.debit_base
        credit_total += ln.credit_base
        delta = (ln.debit_base - ln.credit_base) if debit_normal \
            else (ln.credit_base - ln.debit_base)
        running += delta
        rows.append({
            "date": ln.entry.date,
            "entry_number": ln.entry.entry_number,
            "description": ln.description or ln.entry.description,
            "debit": ln.debit_base,
            "credit": ln.credit_base,
            "running": running,
            "job": ln.job, "truck": ln.truck,
            "reversed": ln.entry.status == EntryStatus.REVERSED,
        })

    return render(request, "accounting/five/account_ledger.html", {
        "account": account,
        "rows": rows,
        "debit_total": debit_total,
        "credit_total": credit_total,
        "closing": running,
        "period": period,
    })
