const MIN_DISPLAY_MARGIN = 100000;
const MAX_DISPLAY_MARGIN = 300000;
const MONTH_COUNT = 12;
const SEASONAL_YEAR_LIMIT = 3;

function allocateByMonth(annualForecast, completeYears, targetYear) {
  const seasonalWeights = Array(MONTH_COUNT).fill(0n);
  const basisYears = [];
  for (const { year, months } of completeYears) {
    if (!months.some(amount => amount > 0n)) continue;
    basisYears.push(year);
    months.forEach((amount, index) => {
      if (amount > 0n) seasonalWeights[index] += amount;
    });
  }

  const weights = basisYears.length ? seasonalWeights : Array(MONTH_COUNT).fill(1n);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0n);
  const annualWon = BigInt(annualForecast);
  const allocations = weights.map((weight, index) => {
    const weightedWon = annualWon * weight;
    return {
      month: index + 1,
      amount: weightedWon / weightTotal,
      remainder: weightedWon % weightTotal,
    };
  });
  const allocated = allocations.reduce((sum, item) => sum + item.amount, 0n);
  // Distribute leftover won by fractional remainder, breaking ties by month.
  const priority = [...allocations].sort((a, b) =>
    a.remainder === b.remainder ? a.month - b.month : a.remainder > b.remainder ? -1 : 1);
  for (const item of priority.slice(0, Number(annualWon - allocated))) item.amount += 1n;

  return {
    monthlyForecast: allocations.map(({ month, amount }) => ({
      year: targetYear, month, forecast: Number(amount),
    })),
    monthlyBasisYears: basisYears,
  };
}

function prepare(request, now) {
  const fail = error => ({ ok: false, error });
  const historyLimit = 10;
  const wonLimit = 1e13;
  const base = request?.baseYear;
  const first = request?.firstYear;
  const cutoff = request?.closedMonth;
  const entries = request?.entries;
  const seoul = new Date(now.getTime() + 9 * 3600 * 1000);
  const currentYear = seoul.getUTCFullYear();
  const currentMonth = seoul.getUTCMonth() + 1;
  if (request?.confirmed !== true || !Number.isInteger(base) || !Number.isInteger(first) ||
      first < 2000 || first > base || base - first >= historyLimit || base > currentYear ||
      !Number.isInteger(cutoff) || cutoff < 1 || cutoff > MONTH_COUNT ||
      (base === currentYear && cutoff >= currentMonth)) {
    return fail('분개장이 모두 입력된 시작 연도, 기준 연도, 마감 월을 확인하세요. 최대 10년을 분석합니다.');
  }
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 50000) {
    return fail('분석 기간에 분개가 있어야 합니다. 한 번에 최대 50,000행을 분석합니다.');
  }
  const normalize = value => value.normalize('NFKC').replace(/\s+/gu, '').toLowerCase();
  const accounts = new Set([
    '매출', '매출액', '상품매출', '제품매출', '제품판매수익', '용역매출', '용역수익',
    '서비스매출', '공사매출', '공사수익', '수출매출', '수출매출액', '기타매출',
    '매출환입', '매출에누리', '매출할인', '매출환입및에누리'
  ].map(normalize));
  const extraAccounts = request.extraAccounts === undefined ? [] : request.extraAccounts;
  if (!Array.isArray(extraAccounts) || extraAccounts.length > 30 ||
      extraAccounts.some(name => typeof name !== 'string' || !name.trim() || name.length > 100)) {
    return fail('추가 매출 계정은 30개까지 등록할 수 있습니다.');
  }
  for (const name of extraAccounts) accounts.add(normalize(name));

  const rows = Array.from({ length: base - first + 1 }, () => Array(MONTH_COUNT).fill(0n));
  const matched = new Set();
  const skipped = new Set();
  const ids = new Set();
  let matchedCount = 0;
  let activeYearMatched = 0;
  for (const entry of entries) {
    const date = entry?.date;
    const validDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
    if (!validDate) return fail('실제 달력에 있는 날짜인지 확인하세요. 전표 날짜 ' + String(date ?? '없음').slice(0, 30));
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    if (year < first || year > base || (year === base && month > cutoff)) continue;
    const { id, account, debit, credit } = entry;
    if (typeof id !== 'string' || !id || id.length > 200 || typeof account !== 'string' ||
        !account.trim() || account.length > 200 ||
        ![debit, credit].every(n => Number.isSafeInteger(n) && n >= 0 && n <= wonLimit) ||
        (debit > 0) === (credit > 0)) {
      return fail(date + ' 전표의 계정, 식별자, 차변·대변 금액을 확인하세요. 금액은 원 단위 정수여야 합니다.');
    }
    if (ids.has(id)) return fail('중복된 전표 식별자가 있습니다. 중복 항목을 확인하세요.');
    ids.add(id);
    if (!accounts.has(normalize(account))) {
      skipped.add(account.trim());
      continue;
    }
    matched.add(account.trim());
    matchedCount++;
    if (year === base) activeYearMatched++;
    rows[year - first][month - 1] += BigInt(credit) - BigInt(debit);
  }
  if (!activeYearMatched) {
    return fail('기준 연도 마감 기간에 매출 계정이 없습니다. 실제 계정과목 이름을 확인하고 추가 매출 계정에 등록하세요.');
  }

  const sum = values => values.reduce((total, value) => total + value, 0);
  const exceedsLimit = value => value > BigInt(wonLimit) || value < -BigInt(wonLimit);
  if (rows.some(months => months.some(exceedsLimit) || exceedsLimit(months.reduce((a, b) => a + b, 0n)))) {
    return fail('집계 금액이 지원 범위를 초과했습니다.');
  }
  const monthly = rows.map(months => months.map(Number));
  const totals = monthly.map(sum);
  const roundForecast = value => Math.round(Math.max(0, value));
  const methods = {
    run_rate: '마감기간 월평균 연환산',
    seasonal: '전년 매출 계절성 반영',
    recent_average: '최근 두 해 연매출 평균',
    yoy_change: '전년 동기 대비 증감 반영',
  };

  function annualize(index, method) {
    const ytd = sum(monthly[index].slice(0, cutoff));
    if (method === 'run_rate') return ytd * MONTH_COUNT / cutoff;
    const lastYear = totals[index - 1];
    const priorYtd = sum(monthly[index - 1].slice(0, cutoff));
    const remainder = lastYear - priorYtd;
    const estimatedBaseYear = ytd + remainder;
    if (method === 'seasonal') return estimatedBaseYear;
    if (method === 'yoy_change') return estimatedBaseYear + (ytd - priorYtd) * MONTH_COUNT / cutoff;
    return (estimatedBaseYear + lastYear) / 2;
  }

  const baseIndex = rows.length - 1;
  // Hold out each known target year and use only data through its preceding cutoff.
  const lastCompleteIndex = baseIndex - Number(cutoff < MONTH_COUNT);
  const eligible = ['run_rate'];
  if (baseIndex >= 1) {
    if (cutoff < MONTH_COUNT) eligible.push('seasonal');
    eligible.push('recent_average');
  }
  if (lastCompleteIndex >= 2) eligible.push('yoy_change');

  // Compare every method over the same historical target years.
  const firstOrigin = eligible.length > 1 && lastCompleteIndex >= 2 ? 1 : 0;
  const evaluatedMethods = lastCompleteIndex === 1 ? ['run_rate'] : eligible;
  const candidates = evaluatedMethods.map(method => {
    const absoluteErrors = [];
    for (let i = firstOrigin; i < lastCompleteIndex; i++) {
      absoluteErrors.push(Math.abs(roundForecast(annualize(i, method)) - totals[i + 1]));
    }
    return {
      method,
      label: methods[method],
      forecast: roundForecast(annualize(baseIndex, method)),
      backtestCount: absoluteErrors.length,
      backtestMae: absoluteErrors.length ? Math.round(sum(absoluteErrors) / absoluteErrors.length) : null,
      backtestMax: absoluteErrors.length ? Math.max(...absoluteErrors) : null,
    };
  });

  const ranked = [...candidates].sort((a, b) =>
    (a.backtestMae ?? 0) - (b.backtestMae ?? 0) || (a.backtestMax ?? 0) - (b.backtestMax ?? 0));
  const preferred = ranked[0];
  const withinTarget = ranked.filter(option => option.backtestMax !== null && option.backtestMax <= MAX_DISPLAY_MARGIN);
  const reference = withinTarget[0] ?? preferred;
  const completeYearEnd = lastCompleteIndex + 1;
  const seasonalStart = Math.max(0, completeYearEnd - SEASONAL_YEAR_LIMIT);
  const completeYears = rows.slice(seasonalStart, completeYearEnd).map((months, index) => ({
    year: first + seasonalStart + index, months,
  }));

  return {
    ok: true, baseYear: base, targetYear: base + 1, firstYear: first, closedMonth: cutoff,
    netToDate: totals[baseIndex], matchedCount, matchedAccounts: [...matched].sort().slice(0, 30),
    excludedAccounts: [...skipped].sort().slice(0, 30), preferred: reference,
    ...allocateByMonth(reference.forecast, completeYears, base + 1),
  };
}


export function forecastSales(request, now = new Date()) {
  const prepared = prepare(request, now);
  if (!prepared.ok) return prepared;

  const { preferred, ...summary } = prepared;
  const margin = Math.min(MAX_DISPLAY_MARGIN, Math.max(MIN_DISPLAY_MARGIN, preferred.backtestMax ?? MAX_DISPLAY_MARGIN));
  return {
    ...summary,
    forecast: preferred.forecast,
    lower: Math.max(0, preferred.forecast - margin),
    upper: preferred.forecast + margin,
    requestedMargin: margin,
    marginStatus: preferred.backtestMax === null
      ? 'unverified'
      : preferred.backtestMax <= MAX_DISPLAY_MARGIN ? 'historical_within' : 'historical_exceeded',
    method: preferred.label,
    methodId: preferred.method,
    backtestCount: preferred.backtestCount,
    backtestMae: preferred.backtestMae,
    backtestMax: preferred.backtestMax,
  };
}
