"""
accounting/loans.py

Minimal loan repayment schedule. The ledger knows a loan account's BALANCE, but not
WHEN repayments fall due — Page 1 (Home) needs "upcoming repayments to prepare for".
This adds just that: a schedule of due dates/amounts tied to a loan account.

Recording an actual repayment is still a normal ledger posting (Dr Loan / Cr Bank);
this model is the forward-looking calendar, not the posting itself.
"""

from decimal import Decimal
from datetime import timedelta
from django.db import models
from django.utils import timezone

from .models import Organization, Account


class LoanRepayment(models.Model):
    """One scheduled repayment for a loan account."""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE,
                                     related_name="loan_repayments")
    loan_account = models.ForeignKey(Account, on_delete=models.CASCADE,
                                     related_name="repayments",
                                     limit_choices_to={"type": "liability"})
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal("0.00"))
    is_paid = models.BooleanField(default=False)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["due_date"]

    def __str__(self):
        return f"{self.loan_account.name}: {self.amount} due {self.due_date}"


def upcoming_repayments(organization: Organization, within_days: int = 30):
    """Unpaid repayments due within the next `within_days` (the 'prepare for' list)."""
    today = timezone.localdate()
    horizon = today + timedelta(days=within_days)
    return (
        LoanRepayment.objects.filter(
            organization=organization, is_paid=False,
            due_date__gte=today, due_date__lte=horizon,
        )
        .select_related("loan_account")
        .order_by("due_date")
    )
