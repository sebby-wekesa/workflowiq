from django.urls import path
from . import views_petty_cash as pc
from . import views_dashboard as dash
from . import views_five_page as five

app_name = "accounting"

urlpatterns = [
    path("", five.home, name="home"),
    path("ledgers/", five.chart_and_ledgers, name="chart_ledgers"),
    path("ledgers/<int:account_id>/", five.account_ledger, name="account_ledger"),
    path("setup/", dash.dashboard, name="dashboard"),
    path("setup/account/add/", dash.add_account, name="add_account"),
    path("setup/account/<int:account_id>/report/", dash.account_report, name="account_report"),
    path("petty-cash/", pc.petty_cash_tab, name="petty_cash_tab"),
    path("petty-cash/route/<int:route_id>/budget.json", pc.route_budget_json, name="route_budget_json"),
]
