import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forecastSales } from '../src/forecast.js';
import { parseJournal } from '../src/journal.js';

const now = new Date('2026-11-19T00:00:00Z');
const sample = readFileSync(new URL('../examples/sample-journal.json', import.meta.url), 'utf8');
const sampleEntries = parseJournal(sample, 'sample.json');

function estimate(entries, overrides = {}) {
  return forecastSales({
    entries, firstYear: 2026, baseYear: 2026, closedMonth: 10, confirmed: true, ...overrides,
  }, now);
}

test('기존 분개장 JSON으로 상승 추세를 검증하고 다음 연도를 예측한다', () => {
  const result = estimate(sampleEntries, { firstYear: 2022, baseYear: 2025, closedMonth: 12 });
  assert.equal(result.targetYear, 2026);
  assert.equal(result.netToDate, 11238000);
  assert.equal(result.forecast, 11358000);
  assert.equal(result.methodId, 'yoy_change');
  assert.equal(result.backtestCount, 2);
  assert.equal(result.backtestMax, 0);
});

test('UTF-8 CSV에서 대변과 차변을 합산하고 마감 뒤 거래와 현금을 제외한다', () => {
  const csv = '\uFEFF일자,계정과목,차변,대변\r\n' +
    '2026.1.2,상품매출,,"1,000,000"\r\n2026-10-08,매출환입,"100,000",\r\n' +
    '2026-10-10,현금,,500000\r\n2026-11-01,상품매출,,5000000\r\n';
  const result = estimate(parseJournal(csv, 'journal.CSV'));
  assert.equal(result.targetYear, 2027);
  assert.equal(result.netToDate, 900000);
  assert.equal(result.forecast, 1080000);
  assert.equal(result.marginStatus, 'unverified');
  assert.deepEqual(result.excludedAccounts, ['현금']);
});

test('마감 월 현재 알려진 실적만 사용하고 미완결 연도는 과거 검증에서 제외한다', () => {
  const result = estimate(sampleEntries, { firstYear: 2022, baseYear: 2025, closedMonth: 9 });
  const filtered = sampleEntries.filter(entry => !entry.date.startsWith('2025-') || entry.date.slice(5, 7) <= '09');
  assert.equal(result.ok, true);
  assert.equal(result.backtestCount, 1);
  assert.deepEqual(result, estimate(filtered, { firstYear: 2022, baseYear: 2025, closedMonth: 9 }));
});

test('잘못된 날짜, 금액, 중복 전표, 진행 중인 마감 월을 검출한다', () => {
  const valid = { id: 'v', date: '2026-02-01', account: '상품매출', debit: 0, credit: 100 };
  assert.equal(estimate([{ ...valid, date: '2026-02-30' }]).ok, false);
  assert.equal(estimate([{ ...valid, credit: NaN }]).ok, false);
  assert.equal(estimate([valid, valid]).ok, false);
  assert.equal(estimate([valid], { closedMonth: 11 }).ok, false);
  assert.equal(estimate([valid], { confirmed: false }).ok, false);
});

test('별도 계정을 등록할 수 있으며 신뢰 구간 대신 제한된 표시 폭을 반환한다', () => {
  const rows = parseJournal(JSON.stringify({ entries: [
    { date: '2024-01-01', account: '설치매출', credit: 100000 },
    { date: '2025-01-01', account: '설치매출', credit: 800000 },
  ] }), 'sales.json');
  const result = estimate(rows, { firstYear: 2024, baseYear: 2025, closedMonth: 12, extraAccounts: ['설치매출'] });
  assert.equal(result.ok, true);
  assert.equal(result.backtestMax, 700000);
  assert.equal(result.marginStatus, 'historical_exceeded');
  assert.equal(result.requestedMargin, 300000);
});

function revenue(date, credit, debit = 0) {
  return { id: date, date, account: '상품매출', credit, debit };
}

test('완결 연도의 월별 비중을 적용하며 금액을 원 단위로 정확히 배분한다', () => {
  const result = estimate([
    revenue('2025-01-01', 101), revenue('2025-12-01', 303),
  ], { firstYear: 2025, baseYear: 2025, closedMonth: 12 });
  assert.deepEqual(result.monthlyBasisYears, [2025]);
  assert.deepEqual(result.monthlyForecast.map(row => row.month), Array.from({ length: 12 }, (_, i) => i + 1));
  assert.ok(result.monthlyForecast.every(row => row.year === 2026));
  assert.equal(result.monthlyForecast[0].forecast, 101);
  assert.equal(result.monthlyForecast[11].forecast, 303);
  assert.equal(result.monthlyForecast.reduce((sum, row) => sum + row.forecast, 0), result.forecast);
});

test('월별 비중은 최근 3개 완결 연도와 양수 순매출을 사용한다', () => {
  const result = estimate([
    revenue('2022-02-01', 100000),
    revenue('2023-01-01', 100), revenue('2024-01-01', 100),
    revenue('2025-01-01', 100), revenue('2025-03-01', 0, 1),
    revenue('2026-04-01', 900),
  ], { firstYear: 2022 });
  assert.deepEqual(result.monthlyBasisYears, [2023, 2024, 2025]);
  assert.ok(result.forecast > 0);
  assert.equal(result.monthlyForecast[0].forecast, result.forecast);
  assert.ok(result.monthlyForecast.slice(1).every(row => row.forecast === 0));
});

test('완결 연도가 없으면 12개월에 균등 배분하고 남는 원을 조정한다', () => {
  const result = estimate([revenue('2026-03-01', 101)]);
  assert.deepEqual(result.monthlyBasisYears, []);
  assert.equal(result.forecast, 121);
  assert.deepEqual(result.monthlyForecast.map(row => row.forecast), [11, ...Array(11).fill(10)]);
});

test('연간 예상액이 0원이면 12개월 예상액도 0원이다', () => {
  const result = estimate([revenue('2026-03-01', 0, 100)]);
  assert.equal(result.forecast, 0);
  assert.equal(result.monthlyForecast.length, 12);
  assert.ok(result.monthlyForecast.every(row => row.forecast === 0));
});
