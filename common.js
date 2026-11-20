/**
 * AccountScope 통합 공통 코어 모듈 (common.js)
 * 김다은, 이영언, 채민서, 손유석, 조유빈 기능 통합 데이터 파이프라인
 */

'use strict';

const STORE_KEY = 'ai_accounting_journals_v1';

// 스토리지 입출력
function loadStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{"datasets":[]}');
  } catch {
    return { datasets: [] };
  }
}

function saveStore(data) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch (e) {
    toast('로컬 저장소 공간이 부족합니다.');
  }
}

// 기본 포맷팅 유틸
function money(v) {
  return Number(v || 0).toLocaleString('ko-KR') + '원';
}

function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : 0;
  const n = Number(String(v ?? '').replace(/[₩,\s원]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function rate(v) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return '-';
  const val = Number(v);
  return (val > 0 ? '+' : '') + val.toFixed(1) + '%';
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

// 엑셀 일련번호 및 다양한 날짜 포맷을 YYYY-MM-DD로 정밀 정규화
function normDate(val) {
  if (!val) return '';
  // 엑셀 일련번호 (예: 45312)
  if (typeof val === 'number' && val > 20000 && val < 90000) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(val) * 86400000);
    return dt.toISOString().slice(0, 10);
  }

  let s = String(val).trim().replace(/[./]/g, '-');
  // YYYYMMDD 8자리
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const y = m[1];
    const mo = m[2].padStart(2, '0');
    const d = m[3].padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }

  return s.slice(0, 10);
}

// 독립 내장 RFC 4180 CSV 파서 (SheetJS CDN 오프라인 시 완벽 대체)
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const out = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (c === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some(x => x !== '')) out.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  row.push(cell.trim());
  if (row.some(x => x !== '')) out.push(row);
  if (!out.length) return [];

  const headers = out[0];
  return out.slice(1).map(vals => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] !== undefined ? vals[idx] : '';
    });
    return obj;
  });
}

// 전체 평탄화 거래 데이터
function allRows() {
  return loadStore().datasets.flatMap(d =>
    d.rows.map(r => ({ ...r, datasetId: d.id, datasetName: d.name, year: d.year }))
  );
}

function yearOf(r) {
  const y = String(r.date || '').match(/(19|20)\d{2}/);
  return y ? Number(y[0]) : Number(r.year) || null;
}

function availableYears() {
  const rows = allRows();
  return [...new Set(rows.map(yearOf).filter(Boolean))].sort((a, b) => b - a);
}

// [이영언 파트 통합: FUN-04, 05, 06] 행 정규화, 계정 분류, 연도/월별 집계
function normalizeRow(r) {
  const get = (...keys) => {
    for (const k of keys) {
      if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') return r[k];
    }
    return '';
  };

  const rawDate = get('거래일자', '일자', '날짜', '전표일자', 'date', 'Date', 'tx_date');
  const date = normDate(rawDate);
  const account = String(get('계정과목', '계정과목명', 'account_name', 'account', '계정명')).trim();
  const debit = num(get('차변', '차변금액', '차변(출금)', 'debit', 'Debit'));
  const credit = num(get('대변', '대변금액', '대변(입금)', 'credit', 'Credit'));
  const category = classifyAccountName(account);

  return {
    date,
    accountCode: String(get('계정코드', '계정과목코드', 'code', 'account_code')),
    accountName: account,
    description: String(get('적요', '거래내용', 'description', 'memo')).trim(),
    customer: String(get('거래처', '거래처명', 'customer', 'partner')).trim(),
    debit,
    credit,
    voucherNo: String(get('전표번호', '번호', 'slip_no', 'voucher_no')),
    category,
    amount: debit || credit,
    raw: r
  };
}

function classifyAccountName(accName) {
  const acc = String(accName || '').replace(/\s+/g, '');
  if (!acc) return '기타';

  // 자산/부채/자본 제외 키워드
  const balanceKeywords = [
    '현금', '보통예금', '당좌예금', '정기예금', '외상매출금', '외상매입금', '미수금', '미지급금',
    '미지급비용', '선급금', '선수금', '보증금', '임차보증금', '비품', '차량운반구', '기계장치',
    '차입금', '자본금', '예수금', '부가세대급금', '부가세예수금', '받을어음', '지급어음', '매출채권', '매입채무'
  ];
  if (balanceKeywords.some(k => acc.includes(k))) {
    return '자산/부채';
  }

  // 지출/원가 키워드
  const expenseKeywords = [
    '급여', '상여', '제수당', '퇴직급여', '복리후생비', '소모품비', '임차료', '지급임차료',
    '원재료', '재료비', '매출원가', '상품매출원가', '제품매출원가', '광고선전비', '접대비',
    '통신비', '수도광열비', '세금과공과', '지급수수료', '여비교통비', '감가상각비', '연구개발비',
    '이자비용', '운반비', '차량유지비', '보험료', '교육훈련비', '도서인쇄비', '지급이자', '잡손실'
  ];
  if (expenseKeywords.some(k => acc.includes(k))) {
    return '지출';
  }

  // 매출/수익 키워드
  if (['매출', '수익', '수입', '상품매출', '제품매출', '용역매출', '이자수익', '잡이익'].some(k => acc.includes(k))) {
    return '매출';
  }

  // 끝 글자가 '비', '료', '원'으로 끝나는 비용 계정 보정
  if (/(비|료|세|과)$/.test(acc)) {
    return '지출';
  }

  return '기타';
}

// 1~12월 연도별 매출/지출/차액 집계 (FUN-06)
function aggregateYearData(year) {
  const rows = allRows().filter(r => yearOf(r) === Number(year));
  const res = {
    year: Number(year),
    totalRows: rows.length,
    annualSales: 0,
    annualExpense: 0,
    annualProfit: 0,
    monthlySales: Array(12).fill(0),
    monthlyExpense: Array(12).fill(0),
    monthlyProfit: Array(12).fill(0),
    expenseAccounts: {},
    unclassified: []
  };

  rows.forEach(r => {
    const row = normalizeRow(r);
    // YYYY-MM-DD에서 정밀한 월 추출 (0~11)
    const mMatch = String(row.date).match(/^\d{4}-(\d{2})/);
    const m = mMatch ? Number(mMatch[1]) - 1 : -1;

    if (row.category === '매출') {
      const val = row.credit - row.debit;
      res.annualSales += val;
      if (m >= 0 && m < 12) res.monthlySales[m] += val;
    } else if (row.category === '지출') {
      const val = row.debit - row.credit;
      res.annualExpense += val;
      if (m >= 0 && m < 12) res.monthlyExpense[m] += val;
      res.expenseAccounts[row.accountName] = (res.expenseAccounts[row.accountName] || 0) + val;
    } else if (row.category === '기타') {
      res.unclassified.push(row);
    }
  });

  for (let i = 0; i < 12; i++) {
    res.monthlyProfit[i] = res.monthlySales[i] - res.monthlyExpense[i];
  }
  res.annualProfit = res.annualSales - res.annualExpense;

  return res;
}

// [채민서 파트 통합: FUN-07, 08, 09] 전년 대비 매출/지출 비교 및 계정별 지출 변동
function compareTwoYears(curYear, prevYear) {
  const cur = aggregateYearData(curYear);
  const prev = prevYear && prevYear !== curYear ? aggregateYearData(prevYear) : null;

  const salesDiff = prev ? cur.annualSales - prev.annualSales : 0;
  const salesRate = prev && prev.annualSales ? (salesDiff / Math.abs(prev.annualSales)) * 100 : null;

  const expDiff = prev ? cur.annualExpense - prev.annualExpense : 0;
  const expRate = prev && prev.annualExpense ? (expDiff / Math.abs(prev.annualExpense)) * 100 : null;

  const allAccNames = new Set([
    ...Object.keys(cur.expenseAccounts),
    ...(prev ? Object.keys(prev.expenseAccounts) : [])
  ]);

  const accountComparison = [...allAccNames].map(name => {
    const c = cur.expenseAccounts[name] || 0;
    const p = prev ? (prev.expenseAccounts[name] || 0) : 0;
    const diff = c - p;
    const r = p > 0 ? (diff / p) * 100 : (c > 0 ? 100 : 0);
    return { account: name, current: c, previous: p, diff, rate: r };
  });

  return {
    curYear: Number(curYear),
    prevYear: prevYear ? Number(prevYear) : null,
    cur,
    prev,
    salesDiff,
    salesRate,
    expDiff,
    expRate,
    accounts: accountComparison
  };
}

// [손유석 파트 통합: FUN-10, 11, 12] 다음 연도 매출 예측 및 AI 분석 의견
function forecastNextYear(baseYear) {
  const cur = aggregateYearData(baseYear);
  const prev = aggregateYearData(baseYear - 1);

  let growthRate = 0.08; // 기본 8%
  if (prev && prev.annualSales > 0 && cur.annualSales > 0) {
    const r = (cur.annualSales - prev.annualSales) / prev.annualSales;
    growthRate = Math.max(-0.5, Math.min(1.0, r)); // -50% ~ +100% 범위 보정
  }

  const nextYear = Number(baseYear) + 1;
  const forecastTotal = Math.round(cur.annualSales * (1 + growthRate));

  // 월별 배분
  const monthlyForecast = cur.monthlySales.map(v => Math.round(v * (1 + growthRate)));
  const monthlyTotal = monthlyForecast.reduce((a, b) => a + b, 0);
  if (monthlyTotal !== forecastTotal && monthlyForecast.length) {
    monthlyForecast[11] += (forecastTotal - monthlyTotal); // 절사 오차 조정
  }

  return {
    baseYear: Number(baseYear),
    nextYear,
    growthRate: growthRate * 100,
    curSales: cur.annualSales,
    forecastTotal,
    expectedDiff: forecastTotal - cur.annualSales,
    months: monthlyForecast.map((fc, i) => ({
      month: i + 1,
      actual: cur.monthlySales[i],
      forecast: fc,
      diff: fc - cur.monthlySales[i]
    }))
  };
}

// 규칙 기반 고품질 AI 경영 진단 문장 생성 (FUN-12)
function generateAIOpinion(curYear, prevYear) {
  const comp = compareTwoYears(curYear, prevYear);
  const cur = comp.cur;
  const prev = comp.prev;

  if (!prev || !prev.annualSales) {
    return `${curYear}년 총 매출은 ${money(cur.annualSales)}, 총 지출은 ${money(cur.annualExpense)}이며 당기 영업 마진은 ${money(cur.annualProfit)}입니다. 비교할 전년도 자료를 추가하면 연도 간 증감 심층 분석이 활성화됩니다.`;
  }

  const sStatus = comp.salesDiff >= 0 ? `전년 대비 +${money(comp.salesDiff)} (${rate(comp.salesRate)} 성장)` : `전년 대비 ${money(comp.salesDiff)} (${rate(comp.salesRate)} 감소)`;
  const eStatus = comp.expDiff >= 0 ? `전년 대비 +${money(comp.expDiff)} (${rate(comp.expRate)} 증가)` : `전년 대비 ${money(comp.expDiff)} (${rate(comp.expRate)} 절감)`;

  const topChanges = [...comp.accounts].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 2);
  const changeNotes = topChanges.length ? topChanges.map(a => `${a.account}(${a.diff > 0 ? '+' : ''}${money(a.diff)})`).join(', ') : '특이 변동 없음';

  let diagnosis = `${curYear}년 총 매출은 ${money(cur.annualSales)}(${sStatus}), 총 지출은 ${money(cur.annualExpense)}(${eStatus})입니다. 당기 영업 마진은 ${money(cur.annualProfit)}을 기록했습니다. `;
  if (comp.salesDiff > comp.expDiff) {
    diagnosis += `매출 성장률이 지출 증가율을 상회하여 수익성이 개선되는 건강한 흐름입니다. 주요 변동 항목: ${changeNotes}.`;
  } else {
    diagnosis += `지출 증가율이 매출 성장을 상회하여 판관비 및 원가율 모니터링이 필요합니다. 주요 변동 항목: ${changeNotes}.`;
  }

  return diagnosis;
}

// [조유빈 파트 통합: FUN-13, 14, 15] 증감 원인 요약 및 SVG 차트 생성기
function getCausesSummary(curYear, prevYear) {
  const comp = compareTwoYears(curYear, prevYear);
  const topChanges = [...comp.accounts]
    .filter(a => a.diff !== 0)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 4);

  return topChanges.map(c => ({
    account: c.account,
    title: `${c.account} ${c.diff > 0 ? '지출 증가' : '비용 절감'} (${rate(c.rate)})`,
    diff: c.diff,
    rate: c.rate,
    type: c.diff > 0 ? 'up' : 'down',
    prev: c.previous,
    cur: c.current,
    desc: `전년(${money(c.previous)}) 대비 ${c.diff > 0 ? '+' : ''}${money(c.diff)} (${rate(c.rate)}) 변동이 확인되었습니다.`
  }));
}

// 순수 인라인 SVG 라인 차트 생성기
function createSvgLineChart(series, W = 720, H = 220) {
  const p = { l: 55, r: 15, t: 15, b: 25 };
  const allVals = series.flatMap(s => s.values || []);
  const max = Math.max(10, Math.ceil(Math.max(...allVals, 10) / 4) * 4);
  const x = i => p.l + i * (W - p.l - p.r) / 11;
  const y = v => H - p.b - (Math.max(0, Number(v) || 0) / max) * (H - p.t - p.b);

  let h = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">`;
  for (let j = 0; j <= 4; j++) {
    const val = max * j / 4;
    const yy = y(val);
    const label = val >= 100000000 ? (val / 100000000).toFixed(1) + '억' : val >= 10000 ? Math.round(val / 10000) + '만' : Math.round(val);
    h += `<line x1="${p.l}" x2="${W - p.r}" y1="${yy}" y2="${yy}" stroke="#e8edf2" stroke-width="1"/>`;
    h += `<text x="${p.l - 8}" y="${yy + 4}" font-size="10" fill="#8a97a5" text-anchor="end">${label}</text>`;
  }
  for (let i = 0; i < 12; i++) {
    h += `<text x="${x(i)}" y="${H - 8}" font-size="10" fill="#7e8d9a" text-anchor="middle">${i + 1}월</text>`;
  }

  series.forEach(s => {
    let path = '';
    (s.values || []).forEach((v, i) => {
      const cx = x(i), cy = y(v);
      path += (i === 0 ? 'M ' : ' L ') + cx + ' ' + cy;
      h += `<circle cx="${cx}" cy="${cy}" r="3" fill="${s.color}"><title>${s.name} ${i + 1}월: ${money(v)}</title></circle>`;
    });
    if (path) {
      h += `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.2" ${s.dash ? 'stroke-dasharray="5 4"' : ''}/>`;
    }
  });

  h += `</svg><div class="row" style="gap:16px;font-size:11px;color:#667085;margin-top:8px">`;
  series.forEach(s => {
    h += `<span class="row" style="gap:5px"><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${s.color}"></i>${esc(s.name)}</span>`;
  });
  h += `</div>`;
  return h;
}

// 순수 인라인 SVG 수평 바 차트 생성기
function createSvgBarChart(rows, W = 720) {
  if (!rows || !rows.length) return '<div class="empty">표시할 데이터가 없습니다.</div>';
  const l = 90, w = W - l - 20, step = 26, H = rows.length * step + 20;
  const max = Math.max(1, ...rows.flatMap(r => [r.a, r.b]));

  let h = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">`;
  rows.forEach((r, i) => {
    const base = 16 + i * step;
    const aa = (Math.abs(r.a || 0) / max) * w;
    const bb = (Math.abs(r.b || 0) / max) * w;
    h += `<text x="${l - 8}" y="${base + 7}" font-size="11" fill="#67788c" text-anchor="end">${esc(r.label)}</text>`;
    h += `<rect x="${l}" y="${base - 6}" width="${aa}" height="6" rx="2" fill="#94b7d8"><title>${r.label} 전년: ${money(r.a)}</title></rect>`;
    h += `<rect x="${l}" y="${base + 2}" width="${bb}" height="6" rx="2" fill="#286cce"><title>${r.label} 기준: ${money(r.b)}</title></rect>`;
  });
  h += `</svg><div class="row" style="gap:16px;font-size:11px;color:#667085;margin-top:8px">
    <span class="row" style="gap:5px"><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#94b7d8"></i>전년도</span>
    <span class="row" style="gap:5px"><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#286cce"></i>기준 연도</span>
  </div>`;
  return h;
}

// 공통 사이드바 네비게이션 렌더러
function renderSidebar(activeId) {
  const aside = document.querySelector('aside.sidebar');
  if (!aside) return;

  const rows = allRows();
  const ys = availableYears();

  aside.innerHTML = `
    <a class="brand" href="index.html">
      <span class="brand-mark">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      </span>
      <span class="brand-text">Account<span class="brand-sub">Scope</span></span>
    </a>
    <div class="nav-label">MY WORKSPACE</div>
    <nav class="nav">
      <a class="${activeId === 'overview' ? 'active' : ''}" href="index.html">
        ▦　업무 개요
      </a>
      <a class="${activeId === 'upload' ? 'active' : ''}" href="upload.html">
        ⇧　분개장 업로드
      </a>
      <a class="${activeId === 'data' ? 'active' : ''}" href="data.html">
        ▤　데이터 조회 <span class="num">${rows.length}</span>
      </a>
      <a class="${activeId === 'years' ? 'active' : ''}" href="years.html">
        ◷　연도별 관리 <span class="num">${ys.length}</span>
      </a>
    </nav>

    <div class="nav-label" style="margin-top:20px">ANALYSIS & REPORT</div>
    <nav class="nav">
      <a class="${activeId === 'classify' ? 'active' : ''}" href="classify.html">
        ▤　계정 분류·집계
      </a>
      <a class="${activeId === 'compare' ? 'active' : ''}" href="compare.html">
        ◫　전년 대비 비교
      </a>
      <a class="${activeId === 'forecast' ? 'active' : ''}" href="forecast.html">
        ↗　차기 매출 예측
      </a>
      <a class="${activeId === 'report' ? 'active' : ''}" href="report.html">
        ▨　경영 분석 보고서
      </a>
    </nav>

    <div class="side-note">
      분개장 데이터를 기반으로 손익 집계, 전년 비교 및 결산 보고서를 발행합니다.<br>
      <button class="btn soft" style="width:100%;margin-top:10px;font-size:11px" onclick="injectDemoData()">
        샘플 데이터 로드
      </button>
    </div>
  `;
}

// 2개년 정밀 샘플 데이터 주입기
function injectDemoData() {
  const store = {
    datasets: [
      {
        id: 'demo-2023',
        name: '2023년_분개장원장.xlsx',
        year: 2023,
        uploadedAt: new Date('2024-01-10').toISOString(),
        rows: [
          { '일자': '2023-01-15', '계정과목': '상품매출', '차변': 0, '대변': 11000000, '거래처': '쿠팡', '적요': '1월 상품매출' },
          { '일자': '2023-02-18', '계정과목': '상품매출', '차변': 0, '대변': 11500000, '거래처': '네이버', '적요': '2월 상품매출' },
          { '일자': '2023-03-25', '계정과목': '상품매출', '차변': 0, '대변': 13200000, '거래처': '거래처A', '적요': '3월 상품매출' },
          { '일자': '2023-04-20', '계정과목': '상품매출', '차변': 0, '대변': 12800000, '거래처': '거래처B', '적요': '4월 상품매출' },
          { '일자': '2023-05-15', '계정과목': '용역매출', '차변': 0, '대변': 14100000, '거래처': '클라이언트C', '적요': '5월 컨설팅' },
          { '일자': '2023-06-22', '계정과목': '상품매출', '차변': 0, '대변': 13900000, '거래처': '네이버', '적요': '6월 상품매출' },
          { '일자': '2023-07-18', '계정과목': '상품매출', '차변': 0, '대변': 13500000, '거래처': '쿠팡', '적요': '7월 상품매출' },
          { '일자': '2023-08-20', '계정과목': '상품매출', '차변': 0, '대변': 12900000, '거래처': '거래처A', '적요': '8월 상품매출' },
          { '일자': '2023-09-25', '계정과목': '상품매출', '차변': 0, '대변': 13300000, '거래처': '네이버', '적요': '9월 상품매출' },
          { '일자': '2023-10-18', '계정과목': '상품매출', '차변': 0, '대변': 13800000, '거래처': '쿠팡', '적요': '10월 상품매출' },
          { '일자': '2023-11-20', '계정과목': '용역매출', '차변': 0, '대변': 12600000, '거래처': '클라이언트D', '적요': '11월 용역수수료' },
          { '일자': '2023-12-28', '계정과목': '상품매출', '차변': 0, '대변': 13000000, '거래처': '네이버', '적요': '12월 결산매출' },
          { '일자': '2023-01-25', '계정과목': '급여', '차변': 48000000, '대변': 0, '거래처': '임직원', '적요': '연간 임직원 급여' },
          { '일자': '2023-03-10', '계정과목': '광고선전비', '차변': 15000000, '대변': 0, '거래처': '메타코리아', '적요': '상반기 SNS 광고' },
          { '일자': '2023-05-15', '계정과목': '임차료', '차변': 14400000, '대변': 0, '거래처': '센텀빌딩', '적요': '사무실 임차료' },
          { '일자': '2023-07-20', '계정과목': '지급수수료', '차변': 8500000, '대변': 0, '거래처': 'PG사', '적요': '전자결제 수수료' },
          { '일자': '2023-09-10', '계정과목': '여비교통비', '차변': 6200000, '대변': 0, '거래처': '코레일/항공', '적요': '지방 출장비' },
          { '일자': '2023-11-15', '계정과목': '복리후생비', '차변': 8200000, '대변': 0, '거래처': '케이터링', '적요': '임직원 복지' }
        ]
      },
      {
        id: 'demo-2024',
        name: '2024년_분개장원장.xlsx',
        year: 2024,
        uploadedAt: new Date('2025-01-15').toISOString(),
        rows: [
          { '일자': '2024-01-15', '계정과목': '상품매출', '차변': 0, '대변': 13200000, '거래처': '쿠팡', '적요': '1월 상품매출' },
          { '일자': '2024-02-18', '계정과목': '상품매출', '차변': 0, '대변': 14500000, '거래처': '네이버', '적요': '2월 상품매출' },
          { '일자': '2024-03-25', '계정과목': '상품매출', '차변': 0, '대변': 16800000, '거래처': '거래처A', '적요': '3월 상품매출' },
          { '일자': '2024-04-20', '계정과목': '상품매출', '차변': 0, '대변': 15100000, '거래처': '거래처B', '적요': '4월 상품매출' },
          { '일자': '2024-05-15', '계정과목': '용역매출', '차변': 0, '대변': 17200000, '거래처': '클라이언트C', '적요': '5월 컨설팅' },
          { '일자': '2024-06-22', '계정과목': '상품매출', '차변': 0, '대변': 16400000, '거래처': '네이버', '적요': '6월 상품매출' },
          { '일자': '2024-07-18', '계정과목': '상품매출', '차변': 0, '대변': 15800000, '거래처': '쿠팡', '적요': '7월 상품매출' },
          { '일자': '2024-08-20', '계정과목': '상품매출', '차변': 0, '대변': 14900000, '거래처': '거래처A', '적요': '8월 상품매출' },
          { '일자': '2024-09-25', '계정과목': '상품매출', '차변': 0, '대변': 15300000, '거래처': '네이버', '적요': '9월 상품매출' },
          { '일자': '2024-10-18', '계정과목': '상품매출', '차변': 0, '대변': 16100000, '거래처': '쿠팡', '적요': '10월 상품매출' },
          { '일자': '2024-11-20', '계정과목': '용역매출', '차변': 0, '대변': 14600000, '거래처': '클라이언트D', '적요': '11월 용역' },
          { '일자': '2024-12-28', '계정과목': '상품매출', '차변': 0, '대변': 14600000, '거래처': '네이버', '적요': '12월 결산' },
          { '일자': '2024-01-25', '계정과목': '급여', '차변': 54000000, '대변': 0, '거래처': '임직원', '적요': '임직원 급여' },
          { '일자': '2024-03-10', '계정과목': '광고선전비', '차변': 22500000, '대변': 0, '거래처': '메타코리아', '적요': '신규 론칭 광고' },
          { '일자': '2024-05-15', '계정과목': '임차료', '차변': 14400000, '대변': 0, '거래처': '센텀빌딩', '적요': '사무실 임차료' },
          { '일자': '2024-07-20', '계정과목': '지급수수료', '차변': 12300000, '대변': 0, '거래처': 'PG사', '적요': '결제 및 서버비' },
          { '일자': '2024-09-10', '계정과목': '여비교통비', '차변': 4100000, '대변': 0, '거래처': '코레일', '적요': '화상회의 도입 출장감소' },
          { '일자': '2024-11-15', '계정과목': '복리후생비', '차변': 9800000, '대변': 0, '거래처': '케이터링', '적요': '건강검진 지원' }
        ]
      }
    ]
  };

  saveStore(store);
  toast('정밀 샘플 데이터 2개년도가 로드되었습니다.');
  setTimeout(() => location.reload(), 300);
}

// ==========================================================
// [n8n & AI API 연동 헬퍼]
// n8n Webhook이 실행 중이면 실제 OpenAI/Gemini 요약을 가져오고,
// 미실행 시 기존 로컬 규칙 기반 generateAIOpinion()으로 즉시 안전 폴백합니다.
// ==========================================================
const N8N_AI_WEBHOOK_URL = 'http://localhost:5678/webhook/generate-ai-summary';

async function fetchAISummary(curYear, prevYear) {
  const comp = compareTwoYears(curYear, prevYear);
  const cur = comp.cur;
  const topChanges = [...comp.accounts].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 3);

  const payload = {
    year: curYear,
    sales: money(cur.annualSales),
    salesDiff: rate(comp.salesRate),
    expense: money(cur.annualExpense),
    expDiff: rate(comp.expRate),
    profit: money(cur.annualProfit),
    topAccounts: topChanges.map(a => `${a.account}(${a.diff > 0 ? '+' : ''}${money(a.diff)})`).join(', ')
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2초 초과 시 폴백

    const res = await fetch(N8N_AI_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error('API 응답 실패');
    const data = await res.json();
    if (data && data.ai_summary) {
      return data.ai_summary;
    }
    throw new Error('응답 형식 불일치');
  } catch (e) {
    // n8n이 꺼져있거나 실패 시 기존 로컬 요약 엔진으로 100% 안전 무중단 폴백
    return generateAIOpinion(curYear, prevYear);
  }
}
