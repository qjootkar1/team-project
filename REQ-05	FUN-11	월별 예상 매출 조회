import argparse
import csv
import json
import re
from datetime import datetime, timedelta, timezone
from fractions import Fraction
from pathlib import Path
from unicodedata import normalize

SALES = (
    "매출 매출액 상품매출 제품매출 제품판매수익 용역매출 용역수익 서비스매출 "
    "공사매출 공사수익 수출매출 수출매출액 기타매출 매출환입 매출에누리 "
    "매출할인 매출환입및에누리"
).split()


def read_rows(path):
    with path.open(encoding="utf-8-sig", newline="") as file:
        if path.suffix.lower() == ".csv":
            reader = csv.DictReader(file)
            headers = set(reader.fieldnames or [])
            supported_headers = (
                {"날짜", "계정과목", "차변", "대변"},
                {"일자", "계정과목", "차변", "대변"},
                {"date", "account", "debit", "credit"},
            )
            if not any(required <= headers for required in supported_headers):
                raise ValueError("CSV 열 이름을 확인하세요.")
            return list(reader)
        if path.suffix.lower() == ".json":
            data = json.load(file)
            rows = data.get("entries") if isinstance(data, dict) else data
            if isinstance(rows, list):
                return rows
    raise ValueError("CSV UTF-8 또는 분개장 JSON을 선택하세요.")


def account_key(name):
    return "".join(normalize("NFKC", name).split()).casefold()


def won(raw):
    value = str(raw).strip() if raw is not None else ""
    if not value:
        return 0
    if not re.fullmatch(r"(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)", value):
        raise ValueError("금액은 0 이상의 원 단위 정수여야 합니다.")
    return int(value.replace(",", ""))


def monthly_actuals(rows, first, base, cutoff, extra_accounts):
    if not 1 <= len(rows) <= 50_000:
        raise ValueError("분개장은 1~50,000행이어야 합니다.")

    months = {year: [0] * 12 for year in range(first, base + 1)}
    accounts = {account_key(name) for name in [*SALES, *extra_accounts]}
    found_base_sale = False
    ids = set()

    for number, row in enumerate(rows, 1):
        try:
            date_text = row.get("date") or row.get("날짜") or row.get("일자") or ""
            date_text = date_text.strip().rstrip(".").replace(".", "-").replace("/", "-")
            date = datetime.strptime(date_text, "%Y-%m-%d")
            if date.year not in months or (date.year == base and date.month > cutoff):
                continue

            account = account_key(row.get("account") or row.get("계정과목") or "")
            if account not in accounts:
                continue

            identifier = row.get("id")
            if identifier is not None and str(identifier).strip():
                key = str(identifier).strip()
                if key in ids:
                    raise ValueError("중복된 매출 전표 ID입니다.")
                ids.add(key)

            debit = won(row.get("debit", row.get("차변")))
            credit = won(row.get("credit", row.get("대변")))
            if (debit > 0) == (credit > 0):
                raise ValueError("차변과 대변 중 한쪽에만 양수 금액을 입력하세요.")

            months[date.year][date.month - 1] += credit - debit
            found_base_sale |= date.year == base
        except (AttributeError, TypeError, ValueError) as error:
            raise ValueError(f"분개장 자료 {number}행을 확인하세요. {error}") from error

    if not found_base_sale:
        raise ValueError("기준 기간에 매출 계정이 없습니다. 계정과목 이름을 확인하세요.")
    return months


def forecast_annual(actuals, first, base, cutoff):
    last_complete = base - (cutoff < 12)
    methods = ["연환산"]
    if base > first and last_complete - first != 1:
        if cutoff < 12:
            methods.append("전년 계절성")
        methods.append("최근 두 해 평균")
    if last_complete - first >= 2:
        methods.append("전년 동기 증감")

    def predict(year, method):
        ytd = sum(actuals[year][:cutoff])
        if method == "연환산":
            value = Fraction(ytd * 12, cutoff)
        else:
            prior = actuals[year - 1]
            prior_ytd = sum(prior[:cutoff])
            seasonal = ytd + sum(prior[cutoff:])
            value = seasonal
            if method == "최근 두 해 평균":
                value = Fraction(seasonal + sum(prior), 2)
            elif method == "전년 동기 증감":
                value = seasonal + Fraction((ytd - prior_ytd) * 12, cutoff)
        return int(max(0, value) + Fraction(1, 2))

    def score(method):
        start = first + (last_complete - first >= 2)
        errors = [
            abs(predict(year, method) - sum(actuals[year + 1]))
            for year in range(start, last_complete)
        ]
        if not errors:
            return 0, 0, 0
        maximum = max(errors)
        mean = int(Fraction(sum(errors), len(errors)) + Fraction(1, 2))
        return maximum > 300_000, mean, maximum

    return predict(base, min(methods, key=score)), last_complete


def forecast_monthly(annual, actuals, last_complete):
    years = sorted(year for year in actuals if year <= last_complete)[-3:]
    weights = [sum(max(0, actuals[year][i]) for year in years) for i in range(12)]
    if not any(weights):
        weights = [1] * 12

    total_weight = sum(weights)
    allocation = [divmod(annual * weight, total_weight) for weight in weights]
    amounts = [amount for amount, _ in allocation]
    order = sorted(range(12), key=lambda i: (-allocation[i][1], i))
    for i in order[:annual - sum(amounts)]:
        amounts[i] += 1
    return amounts


def main():
    parser = argparse.ArgumentParser(description="다음 연도 월별 예상 순매출 조회")
    parser.add_argument("journal", type=Path)
    parser.add_argument("--first-year", type=int, required=True)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--month", type=int, choices=range(1, 13), required=True)
    parser.add_argument("--sales-account", action="append", default=[])
    args = parser.parse_args()

    first, base, cutoff = args.first_year, args.year, args.month
    now = datetime.now(timezone(timedelta(hours=9)))
    if not 2000 <= first <= base <= now.year or base - first >= 10:
        parser.error("시작 연도와 기준 연도를 확인하세요. 최대 10년을 분석합니다.")
    if base == now.year and cutoff >= now.month:
        parser.error("입력을 마친 지난달까지 선택하세요.")

    try:
        actuals = monthly_actuals(
            read_rows(args.journal), first, base, cutoff, args.sales_account
        )
        annual, last_complete = forecast_annual(actuals, first, base, cutoff)
        amounts = forecast_monthly(annual, actuals, last_complete)
    except (OSError, ValueError) as error:
        parser.error(str(error))

    print(f"{base + 1}년 월별 예상 순매출")
    for month, amount in enumerate(amounts, 1):
        print(f"{month:>2}월  {amount:>12,}원")
    print(f"연간 합계  {annual:,}원")


if __name__ == "__main__":
    main()
