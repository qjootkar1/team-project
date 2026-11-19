import argparse
from datetime import datetime, timedelta, timezone
from fractions import Fraction
from pathlib import Path

from ai_sales_analysis import SALES, normalize, read_journal, summarize

METHODS = {
    "run_rate": "마감 기간 월평균 연환산",
    "seasonal": "전년 매출 계절성 반영",
    "average": "최근 두 해 연매출 평균",
    "trend": "전년 동기 대비 증감 반영",
}
MAX_MARGIN = 300_000


def round_won(value):
    return int(value + Fraction(1, 2))


def annual_forecast(rows, first_year, base_year, closed_month, extra_accounts=()):
    today = datetime.now(timezone(timedelta(hours=9))).date()
    if not 2000 <= first_year <= base_year <= today.year or base_year - first_year >= 10:
        raise ValueError("자료 시작 연도와 기준 연도를 확인하세요. 최대 10년까지 지원합니다.")
    if not 1 <= closed_month <= 12 or (
        base_year == today.year and closed_month >= today.month
    ):
        raise ValueError("입력을 마친 마감 월을 선택하세요.")
    if not 1 <= len(rows) <= 50_000:
        raise ValueError("분개장 행 수는 1~50,000행이어야 합니다.")

    names = SALES.split() + [
        "제품판매수익", "용역수익", "공사수익", "수출매출액", "매출환입및에누리"
    ]
    accounts = {normalize(name) for name in [*names, *extra_accounts]}
    actuals = {
        year: summarize(
            rows, year, closed_month if year == base_year else 12, accounts, set()
        )
        for year in range(first_year, base_year + 1)
    }
    if not actuals[base_year]["매출전표수"]:
        raise ValueError("기준 기간에 매출 계정이 없습니다. 계정 이름을 확인하세요.")

    monthly = {
        year: [item["순매출"] for item in period["월별"]]
        for year, period in actuals.items()
    }
    totals = {year: sum(values) for year, values in monthly.items()}

    def estimate(year, method):
        ytd = sum(monthly[year][:closed_month])
        if method == "run_rate":
            return round_won(max(0, Fraction(ytd * 12, closed_month)))

        prior_ytd = sum(monthly[year - 1][:closed_month])
        estimated_year = ytd + totals[year - 1] - prior_ytd
        if method == "seasonal":
            value = estimated_year
        elif method == "average":
            value = Fraction(estimated_year + totals[year - 1], 2)
        else:
            value = estimated_year + Fraction((ytd - prior_ytd) * 12, closed_month)
        return round_won(max(0, value))

    last_complete = base_year - (closed_month < 12)
    complete_span = last_complete - first_year
    methods = ["run_rate"]
    if base_year > first_year and complete_span != 1:
        if closed_month < 12:
            methods.append("seasonal")
        methods.append("average")
    if complete_span >= 2:
        methods.append("trend")

    first_origin = first_year + (complete_span >= 2)
    options = []
    for method in methods:
        errors = [
            abs(estimate(year, method) - totals[year + 1])
            for year in range(first_origin, last_complete)
        ]
        options.append({
            "method": METHODS[method],
            "forecast": estimate(base_year, method),
            "checks": len(errors),
            "mae": round_won(Fraction(sum(errors), len(errors))) if errors else None,
            "max_error": max(errors) if errors else None,
        })

    ranked = sorted(options, key=lambda option: (option["mae"] or 0, option["max_error"] or 0))
    chosen = next(
        (option for option in ranked if option["checks"] and option["max_error"] <= MAX_MARGIN),
        ranked[0],
    )
    error = chosen["max_error"]
    margin = max(100_000, min(MAX_MARGIN, error if error is not None else MAX_MARGIN))
    return {
        **chosen,
        "target_year": base_year + 1,
        "lower": max(0, chosen["forecast"] - margin),
        "upper": chosen["forecast"] + margin,
    }, {year: monthly[year] for year in range(first_year, last_complete + 1)}


def run(callback):
    parser = argparse.ArgumentParser()
    parser.add_argument("journal", type=Path)
    parser.add_argument("--first-year", type=int, required=True)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--month", type=int, required=True)
    parser.add_argument("--sales-account", action="append", default=[])
    args = parser.parse_args()
    try:
        result, complete_months = annual_forecast(
            read_journal(args.journal), args.first_year, args.year, args.month, args.sales_account
        )
        callback(result, complete_months)
    except (OSError, ValueError) as error:
        parser.error(str(error))


def print_annual(result, _complete_months):
    print(f"{result['target_year']}년 예상 순매출 {result['forecast']:,}원")
    print(f"적용 방식  {result['method']}")
    print(f"연간 참고 범위  {result['lower']:,}원 ~ {result['upper']:,}원")
    if result["checks"]:
        print(
            f"과거 검증 {result['checks']}회, 평균 오차 {result['mae']:,}원, "
            f"최대 오차 {result['max_error']:,}원"
        )
    else:
        print("과거 검증에 필요한 완결 연도가 부족합니다.")


if __name__ == "__main__":
    run(print_annual)
