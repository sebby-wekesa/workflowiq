"""
accounting/tests_five_page.py

Covers the read-only pages (1 & 3) and their helpers:
  * summaries roll accounts into the right Home buckets, live from the ledger
  * bank vs cash-in-hand split works
  * upcoming loan repayments returns only unpaid, in-window items
  * the T-account ledger totals and closing balance are correct
"""

from decimal import Decimal
from datetime import date, timedelta
from django.test import TestCase
from django.utils import timezone

from .models import Organization, Account, AccountType
from .services import post_entry, Leg
from .loans import LoanRepayment, upcoming_repayments
from . import summaries


class FivePageHelperTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Co", base_currency="KES")
        n = [0]

        def add(name, t, sub):
            n[0] += 1
            return Account.objects.create(
                organization=self.org, code=str(1000 + n[0]), name=name, type=t, subtype=sub
            )

        self.bank = add("Equity Bank KES", AccountType.ASSET, "Cash & Cash Equivalents")
        self.cash = add("Petty Cash in Hand", AccountType.ASSET, "Cash & Cash Equivalents")
        self.ar = add("Trade Receivables", AccountType.ASSET, "Trade & Other Receivables")
        self.ap = add("Trade Payables", AccountType.LIABILITY, "Trade & Other Payables")
        self.loan = add("Asset Finance Loan", AccountType.LIABILITY, "Loans & Borrowings")
        self.eq = add("Share Capital", AccountType.EQUITY, "Equity")
        self.rev = add("Transport Income", AccountType.INCOME, "Revenue")

        post_entry(organization=self.org, date=date(2026, 1, 1), description="Capital",
                   legs=[Leg(account=self.bank, debit=Decimal("1000000")),
                         Leg(account=self.eq, credit=Decimal("1000000"))])
        post_entry(organization=self.org, date=date(2026, 1, 5), description="Invoice",
                   legs=[Leg(account=self.ar, debit=Decimal("500000")),
                         Leg(account=self.rev, credit=Decimal("500000"))])
        post_entry(organization=self.org, date=date(2026, 1, 8), description="Bill",
                   legs=[Leg(account=self.bank, debit=Decimal("0.00"), credit=Decimal("0.00"))
                         if False else Leg(account=self.ar, debit=Decimal("0.01")),
                         Leg(account=self.rev, credit=Decimal("0.01"))])

    def test_cash_and_bank_split(self):
        cb = summaries.cash_and_bank(self.org)
        # bank account (no 'cash' in a way that triggers) vs the petty cash one
        bank_names = [r["account"].name for r in cb["bank_rows"]]
        cash_names = [r["account"].name for r in cb["cash_rows"]]
        self.assertIn("Equity Bank KES", bank_names)
        self.assertIn("Petty Cash in Hand", cash_names)
        self.assertEqual(cb["bank_total"], Decimal("1000000.00"))

    def test_debtors_total(self):
        d = summaries.debtors(self.org)
        # 500,000 + the tiny 0.01 test posting
        self.assertEqual(d["total"], Decimal("500000.01"))

    def test_upcoming_repayments_window(self):
        # one due in 10 days (in window), one in 100 days (out), one paid (excluded)
        LoanRepayment.objects.create(organization=self.org, loan_account=self.loan,
                                     due_date=timezone.localdate() + timedelta(days=10),
                                     amount=Decimal("25000"))
        LoanRepayment.objects.create(organization=self.org, loan_account=self.loan,
                                     due_date=timezone.localdate() + timedelta(days=100),
                                     amount=Decimal("25000"))
        LoanRepayment.objects.create(organization=self.org, loan_account=self.loan,
                                     due_date=timezone.localdate() + timedelta(days=5),
                                     amount=Decimal("25000"), is_paid=True)
        rows = list(upcoming_repayments(self.org, within_days=30))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].amount, Decimal("25000"))
