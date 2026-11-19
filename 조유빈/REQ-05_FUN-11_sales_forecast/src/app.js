import { forecastSales } from './forecast.js';
import { parseJournal } from './journal.js';

const get = id => document.getElementById(id);
const form = get('forecast-form');
const first = get('first-year');
const base = get('base-year');
const month = get('closed-month');
const confirmed = get('confirmed');
const fileInput = get('journal');
const exampleButton = get('example');
const predictButton = get('predict');
const errorMessage = get('error');
const result = get('result');
const seoulToday = new Date(Date.now() + 9 * 3600 * 1000);
const currentYear = seoulToday.getUTCFullYear();
const currentMonth = seoulToday.getUTCMonth() + 1;
const latestClosedYear = currentYear - Number(currentMonth === 1);
const numberFormat = new Intl.NumberFormat('ko-KR');
const won = amount => numberFormat.format(amount) + '원';
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
let entries = [];
let loadVersion = 0;

function clearResult() {
  result.hidden = true;
  errorMessage.hidden = true;
}

function displayMonthlyForecast(outcome) {
  get('monthly-title').textContent = outcome.targetYear + '년 월별 예상 순매출';
  get('monthly-rows').replaceChildren(...outcome.monthlyForecast.map(({ month, forecast }) => {
    const row = document.createElement('tr');
    const label = document.createElement('th');
    const amount = document.createElement('td');
    label.scope = 'row';
    label.textContent = month + '월';
    amount.textContent = won(forecast);
    row.append(label, amount);
    return row;
  }));
  get('monthly-total').textContent = won(outcome.forecast);
  get('monthly-basis').textContent = outcome.monthlyBasisYears.length
    ? outcome.monthlyBasisYears.join('년, ') + '년의 월별 순매출 비중을 반영했습니다.'
    : '비중을 계산할 수 있는 연간 자료가 부족해 연간 예상액을 12개월에 고르게 배분했습니다.';
}

function updateMonths(max = 12) {
  const calendarLimit = Number(base.value) === currentYear ? currentMonth - 1 : 12;
  month.replaceChildren(...Array.from({ length: calendarLimit }, (_, index) =>
    new Option((index + 1) + '월', String(index + 1))));
  month.value = String(Math.min(calendarLimit, max));
}

async function loadJournal(getContents, filename) {
  const version = ++loadVersion;
  predictButton.disabled = true;
  clearResult();
  confirmed.checked = false;
  get('file-status').textContent = '분개장을 읽고 있습니다.';
  try {
    const loaded = parseJournal(await getContents(), filename);
    if (version !== loadVersion) return;
    let startYear = Infinity;
    let lastYear = 0;
    let lastMonth = 0;
    for (const { date } of loaded) {
      if (typeof date !== 'string' || !datePattern.test(date)) continue;
      const year = Number(date.slice(0, 4));
      const selectedMonth = Number(date.slice(5, 7));
      if (year < 2000 || year > latestClosedYear || selectedMonth < 1 || selectedMonth > 12 ||
          (year === currentYear && selectedMonth >= currentMonth)) continue;
      startYear = Math.min(startYear, year);
      if (year > lastYear) lastMonth = 0;
      if (year >= lastYear) {
        lastYear = year;
        lastMonth = Math.max(lastMonth, selectedMonth);
      }
    }
    if (lastYear) {
      first.value = Math.max(startYear, lastYear - 9);
      base.value = lastYear;
      updateMonths(lastMonth);
    }
    entries = loaded;
    predictButton.disabled = false;
    get('file-status').textContent = filename + ' · 전표 ' + loaded.length.toLocaleString('ko-KR') + '행';
  } catch (error) {
    if (version !== loadVersion) return;
    entries = [];
    get('file-status').textContent = '분개장을 불러오지 못했습니다.';
    errorMessage.textContent = error instanceof SyntaxError ? 'JSON 파일 형식을 확인하세요.' : error.message;
    errorMessage.hidden = false;
  }
}

base.max = first.max = String(latestClosedYear);
base.value = first.value = String(latestClosedYear);
updateMonths();
base.addEventListener('change', () => updateMonths());

form.addEventListener('change', event => {
  clearResult();
  if (event.target !== confirmed) confirmed.checked = false;
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) void loadJournal(() => file.text(), file.name);
});

exampleButton.addEventListener('click', () => {
  fileInput.value = '';
  void loadJournal(async () => {
    const response = await fetch('./examples/sample-journal.json');
    if (!response.ok) throw Error('예시 파일을 읽지 못했습니다.');
    return response.text();
  }, 'sample-journal.json');
});

form.addEventListener('submit', event => {
  event.preventDefault();
  clearResult();
  const outcome = forecastSales({
    entries,
    firstYear: Number(first.value),
    baseYear: Number(base.value),
    closedMonth: Number(month.value),
    confirmed: confirmed.checked,
    extraAccounts: get('accounts').value.split(/[\n,]/).map(name => name.trim()).filter(Boolean),
  });
  if (!outcome.ok) {
    errorMessage.textContent = outcome.error;
    errorMessage.hidden = false;
    return;
  }
  get('result-title').textContent = outcome.targetYear + '년 예상 순매출';
  get('amount').textContent = won(outcome.forecast);
  get('range').textContent = '연간 참고 구간 ' + won(outcome.lower) + ' ~ ' + won(outcome.upper) +
    ' (표시 폭 ±' + won(outcome.requestedMargin) + ')';
  get('actual').textContent = outcome.baseYear + '년 1~' + outcome.closedMonth + '월 · ' + won(outcome.netToDate);
  get('method').textContent = outcome.method;
  const checked = outcome.backtestCount
    ? outcome.backtestCount + '회 · 평균 ' + won(outcome.backtestMae) + ' · 최대 ' + won(outcome.backtestMax)
    : '검증에 필요한 완결 연도가 부족합니다.';
  const exceeded = outcome.marginStatus === 'historical_exceeded' ? ' 과거 최대 오차가 300,000원을 넘었습니다.' : '';
  get('validation').textContent = checked + exceeded;
  displayMonthlyForecast(outcome);
  get('included').textContent = '포함 · ' + outcome.matchedAccounts.join(', ');
  get('excluded').textContent = '제외 · ' + (outcome.excludedAccounts.join(', ') || '없음') + ' (최대 30개 표시)';
  result.hidden = false;
});
