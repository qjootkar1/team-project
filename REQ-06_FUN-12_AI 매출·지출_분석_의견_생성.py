import argparse
import csv
import json
import os
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

SALES = (
    "매출 매출액 상품매출 제품매출 용역매출 서비스매출 공사매출 "
    "수출매출 기타매출 매출환입 매출에누리 매출할인"
)
EXPENSES = (
    "지출 비용 매출원가 상품매출원가 제품매출원가 급여 복리후생비 "
    "임차료 지급임차료 수도광열비 통신비 운반비 소모품비 "
    "지급수수료 광고선전비 보험료 감가상각비 이자비용"
)


def normalize(name):
    return "".join(unicodedata.normalize("NFKC", name).split()).casefold()


def read_journal(path):
    with path.open(encoding="utf-8-sig", newline="") as file:
        if path.suffix.lower() == ".csv":
            return list(csv.DictReader(file))
        if path.suffix.lower() == ".json":
            data = json.load(file)
            rows = data.get("entries") if isinstance(data, dict) else data
            if isinstance(rows, list):
                return rows
    raise ValueError("CSV UTF-8 또는 전표 배열이 담긴 JSON을 선택하세요.")


def won(value):
    if value is None or value == "":
        return 0
    value = str(value).strip()
    if not re.fullmatch(r"(?:\d+|\d{1,3}(?:,\d{3})+)", value):
        raise ValueError("금액은 0 이상의 원 단위 정수로 입력하세요.")
    return int(value.replace(",", ""))


def summarize(rows, year, month, sales_accounts, expense_accounts):
    result = {
        "연도": year,
        "매출전표수": 0,
        "지출전표수": 0,
        "월별": [
            {"월": i, "순매출": 0, "순비용": 0}
            for i in range(1, month + 1)
        ],
    }

    for number, row in enumerate(rows, 1):
        try:
            date_text = row.get("date") or row.get("날짜") or row.get("일자") or ""
            date_text = date_text.strip().rstrip(".").replace(".", "-").replace("/", "-")
            date = datetime.strptime(date_text, "%Y-%m-%d")

            if date.year != year or date.month > month:
                continue

            account = normalize(row.get("account") or row.get("계정과목") or "")
            if account not in sales_accounts and account not in expense_accounts:
                continue

            debit = won(row.get("debit", row.get("차변")))
            credit = won(row.get("credit", row.get("대변")))
            if (debit > 0) == (credit > 0):
                raise ValueError("차변과 대변 중 한쪽에만 양수 금액을 입력하세요.")

            monthly = result["월별"][date.month - 1]
            if account in sales_accounts:
                monthly["순매출"] += credit - debit
                result["매출전표수"] += 1
            else:
                monthly["순비용"] += debit - credit
                result["지출전표수"] += 1
        except (AttributeError, TypeError, ValueError) as error:
            raise ValueError(f"자료 {number}행을 확인하세요. {error}") from error

    result["순매출합계"] = sum(row["순매출"] for row in result["월별"])
    result["순비용합계"] = sum(row["순비용"] for row in result["월별"])
    return result


def ai_opinion(current, previous, key):
    instructions = (
        "제공된 집계만 근거로 한국어 분석 의견을 작성하세요. "
        "기준 기간 요약, 월별 또는 전년 동기 주요 변화, 확인할 항목을 각각 짧게 쓰세요. "
        "금액 단위는 원이고 지출은 순비용 집계입니다. 자료에 없는 원인을 추정하지 마세요. "
        "전표수가 0이면 해당 항목은 미집계로 설명하고 실적 0원이나 증감률로 단정하지 마세요. "
        "전년 동기가 null이면 비교를 생략하세요."
    )
    request = Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps({
            "model": os.getenv("OPENAI_MODEL") or "gpt-4.1-mini",
            "instructions": instructions,
            "input": json.dumps(
                {"기준기간": current, "전년동기": previous},
                ensure_ascii=False,
            ),
            "max_output_tokens": 1200,
            "store": False,
        }).encode(),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    with urlopen(request, timeout=45) as response:
        data = json.load(response)

    text = "\n".join(
        part["text"]
        for item in data.get("output", []) if item["type"] == "message"
        for part in item.get("content", []) if part["type"] == "output_text"
    ).strip()
    if data.get("status") != "completed" or not text:
        raise ValueError("AI 분석 의견을 받지 못했습니다.")
    return text


def main():
    parser = argparse.ArgumentParser(description="분개장 매출·지출 AI 분석")
    parser.add_argument("file", type=Path)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--month", type=int, required=True, choices=range(1, 13))
    parser.add_argument("--sales-account", action="append", default=[])
    parser.add_argument("--expense-account", action="append", default=[])
    args = parser.parse_args()

    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        parser.exit(1, "OPENAI_API_KEY를 먼저 설정하세요.\n")

    sales = set(map(normalize, SALES.split() + args.sales_account))
    expenses = set(map(normalize, EXPENSES.split() + args.expense_account))

    try:
        if sales & expenses:
            raise ValueError("같은 계정을 매출과 지출에 중복 등록할 수 없습니다.")

        rows = read_journal(args.file)
        current = summarize(rows, args.year, args.month, sales, expenses)
        previous = summarize(rows, args.year - 1, args.month, sales, expenses)

        if not current["매출전표수"] and not current["지출전표수"]:
            raise ValueError("기준 기간에 집계된 매출·지출 전표가 없습니다.")
        if not previous["매출전표수"] and not previous["지출전표수"]:
            previous = None

        print(ai_opinion(current, previous, key))
    except HTTPError as error:
        parser.exit(
            1, f"OpenAI API 요청 실패 (HTTP {error.code}). 키와 모델 설정을 확인하세요.\n"
        )
    except (OSError, ValueError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
