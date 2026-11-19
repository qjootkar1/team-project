/**
 * shared.js - 조유빈 담당 기능 공통 스크립트 모듈
 * FUN-13 (주요 증감 원인 요약), FUN-14 (분석 결과 그래프 표시), FUN-15 (분석 보고서 생성 및 다운로드)
 */

'use strict';

const KEY = 'accounting-n8n-v1';
const CONF_KEY = 'accounting-n8n-url';

// 포맷팅 유틸
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const fmt = n => Number(n || 0).toLocaleString('ko-KR');
const won = n => fmt(n) + '원';
const rate = n => n === null || n === undefined ? '-' : Number(n).toFixed(1) + '%';

// 토스트 메시지
function toast(message) {
  document.querySelector('.toast')?.remove();
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = message;
  document.body.append(d);
  setTimeout(() => d.remove(), 4000);
}

// 공통 네비게이션 렌더링
function renderNavigation(activePageId) {
  const navContainer = $('common-nav');
  if (!navContainer) return;

  const pages = [
    { id: 'home', label: '전체 홈 (HUB)', href: 'index.html' },
    { id: 'fun-13', label: 'FUN-13 증감 원인 요약', href: 'fun-13.html' },
    { id: 'fun-14', label: 'FUN-14 분석 그래프', href: 'fun-14.html' },
    { id: 'fun-15', label: 'FUN-15 보고서 생성/PDF', href: 'fun-15.html' },
  ];

  navContainer.innerHTML = `
    <header class="top-header">
      <div class="bar">
        <div class="brand-group">
          <a href="index.html" class="brand">
            <span>📊 회계 분석 시스템</span>
            <span class="brand-badge">조유빈 담당 모듈</span>
          </a>
          <nav class="nav-tabs">
            ${pages.map(p => `
              <a href="${p.href}" class="nav-tab ${p.id === activePageId ? 'active' : ''}">
                ${p.label}
              </a>
            `).join('')}
          </nav>
        </div>
        <div class="user-badge">
          <span>👤 담당자: <b>조유빈</b></span>
        </div>
      </div>
    </header>
  `;
}

// 데모 데이터 (로컬 스토리지에 데이터가 없을 때도 각 페이지가 독립적으로 예쁘게 표시되도록 제공)
function getMockData() {
  return {
    ok: true,
    year: 2024,
    previous: 2023,
    current: {
      sales: 184500000,
      expenses: 122800000,
      profit: 61700000
    },
    changes: {
      sales: { amount: 28500000, rate: 18.3, label: null },
      expenses: { amount: 14200000, rate: 13.1, label: null }
    },
    monthly: [
      { month: 1, currentSales: 13200000, currentExpenses: 9100000, previousSales: 11000000, previousExpenses: 8200000 },
      { month: 2, currentSales: 14500000, currentExpenses: 9400000, previousSales: 11500000, previousExpenses: 8300000 },
      { month: 3, currentSales: 16800000, currentExpenses: 11200000, previousSales: 13200000, previousExpenses: 9500000 },
      { month: 4, currentSales: 15100000, currentExpenses: 9800000, previousSales: 12800000, previousExpenses: 8900000 },
      { month: 5, currentSales: 17200000, currentExpenses: 10500000, previousSales: 14100000, previousExpenses: 9300000 },
      { month: 6, currentSales: 16400000, currentExpenses: 10100000, previousSales: 13900000, previousExpenses: 9200000 },
      { month: 7, currentSales: 15800000, currentExpenses: 10400000, previousSales: 13500000, previousExpenses: 9400000 },
      { month: 8, currentSales: 14900000, currentExpenses: 9900000, previousSales: 12900000, previousExpenses: 9100000 },
      { month: 9, currentSales: 15300000, currentExpenses: 10200000, previousSales: 13300000, previousExpenses: 9300000 },
      { month: 10, currentSales: 16100000, currentExpenses: 10600000, previousSales: 13800000, previousExpenses: 9600000 },
      { month: 11, currentSales: 14600000, currentExpenses: 10500000, previousSales: 12600000, previousExpenses: 8700000 },
      { month: 12, currentSales: 14600000, currentExpenses: 11100000, previousSales: 13000000, previousExpenses: 9100000 }
    ],
    accounts: [
      { account: '급여', previous: 48000000, current: 54000000, amount: 6000000, rate: 12.5, reason: '신규 채용 2명 및 연봉 인상분 반영' },
      { account: '광고선전비', previous: 15000000, current: 22500000, amount: 7500000, rate: 50.0, reason: '하반기 신제품 론칭 SNS 디지털 마케팅 캠페인 집행' },
      { account: '지급임차료', previous: 14400000, current: 14400000, amount: 0, rate: 0.0, reason: '임대차 계약 유지로 변동 없음' },
      { account: '지급수수료', previous: 8500000, current: 12300000, amount: 3800000, rate: 44.7, reason: '전자결제(PG) 연동 및 클라우드 인프라 유지보수비 증가' },
      { account: '여비교통비', previous: 6200000, current: 4100000, amount: -2100000, rate: -33.9, reason: '비대면 화상 회의 확대로 지방 출장 감소' },
      { account: '소모품비', previous: 5100000, current: 4900000, amount: -200000, rate: -3.9, reason: '사무용품 대량 구매 할인 적용' },
      { account: '복리후생비', previous: 8200000, current: 9800000, amount: 1600000, rate: 19.5, reason: '직원 복지포인트 및 건강검진 지원 확대' },
      { account: '통신비', previous: 3200000, current: 2800000, amount: -400000, rate: -12.5, reason: '통신사 법인 결합요금제 변경' }
    ],
    forecast: {
      year: 2025,
      total: 218200000,
      rate: 18.3,
      baseline: false,
      months: [
        { month: 1, actual: 13200000, forecast: 15600000 },
        { month: 2, actual: 14500000, forecast: 17100000 },
        { month: 3, actual: 16800000, forecast: 19800000 },
        { month: 4, actual: 15100000, forecast: 17800000 },
        { month: 5, actual: 17200000, forecast: 20300000 },
        { month: 6, actual: 16400000, forecast: 19400000 },
        { month: 7, actual: 15800000, forecast: 18700000 },
        { month: 8, actual: 14900000, forecast: 17600000 },
        { month: 9, actual: 15300000, forecast: 18100000 },
        { month: 10, actual: 16100000, forecast: 19000000 },
        { month: 11, actual: 14600000, forecast: 17300000 },
        { month: 12, actual: 14600000, forecast: 17500000 }
      ]
    },
    summary: '2024년 총 매출은 1억 8,450만원(전년 대비 +18.3%), 총 지출은 1억 2,280만원(전년 대비 +13.1%)으로 당기 영업이익은 6,170만원을 기록했습니다. 신제품 론칭에 따른 광고선전비(+50.0%)와 인원 충원으로 인한 급여(+12.5%) 지출이 주된 증가 요인이나, 매출 성장률(+18.3%)이 지출 증가율(+13.1%)을 상회하여 수익성이 개선되었습니다.',
    causes: [
      {
        title: '광고선전비 급증 (+7,500,000원, +50.0%)',
        account: '광고선전비',
        amount: 7500000,
        rate: 50.0,
        type: 'up',
        text: '전년(1,500만원) 대비 50.0% 증가. 하반기 신규 서비스 론칭 마케팅 및 온라인 광고 집행 영향이 큽니다.'
      },
      {
        title: '급여 인상 및 신규 채용 (+6,000,000원, +12.5%)',
        account: '급여',
        amount: 6000000,
        rate: 12.5,
        type: 'up',
        text: '전년(4,800만원) 대비 12.5% 증가. 개발 및 영업 인력 충원과 정기 호봉 승급에 따른 고정비 상승입니다.'
      },
      {
        title: '지급수수료 증가 (+3,800,000원, +44.7%)',
        account: '지급수수료',
        amount: 3800000,
        rate: 44.7,
        type: 'up',
        text: '전년(850만원) 대비 44.7% 증가. 온라인 매출 비중 증가에 따른 전자결제(PG) 수수료 및 서버 비용이 증가했습니다.'
      },
      {
        title: '여비교통비 절감 (-2,100,000원, -33.9%)',
        account: '여비교통비',
        amount: -2100000,
        rate: -33.9,
        type: 'down',
        text: '전년(620만원) 대비 33.9% 감소. 비대면 원격 미팅 체계 정착으로 출장 및 이동 경비가 대폭 절감되었습니다.'
      }
    ]
  };
}

// 로컬 스토리지에 저장된 실제 데이터 가져오기 (없으면 데모 데이터 반환)
function getAnalysisData() {
  const cached = localStorage.getItem('accounting-analysis-cache');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {}
  }
  // 데모 데이터 사용
  const demo = getMockData();
  localStorage.setItem('accounting-analysis-cache', JSON.stringify(demo));
  return demo;
}

// SVG 차트 생성 함수들 (FUN-14 및 공통 재사용)
function createLineChart(series, W = 720, H = 250) {
  const p = { l: 68, r: 18, t: 20, b: 35 };
  const nums = series.flatMap(s => (s.values || []).filter(v => v !== null && v !== undefined && Number.isFinite(Number(v))).map(Number));
  let rawMax = Math.max(1, ...nums);
  let max = Math.ceil(rawMax / 4) * 4 || 4;
  const x = i => p.l + i * (W - p.l - p.r) / 11;
  const y = v => H - p.b - Math.max(0, Number(v) || 0) / max * (H - p.t - p.b);

  let h = `<svg class="svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="월별 추이 그래프">`;
  
  // 가이드라인 및 Y축 레이블
  for (let j = 0; j <= 4; j++) {
    let val = max * j / 4;
    let yy = y(val);
    h += `<line x1="${p.l}" x2="${W - p.r}" y1="${yy}" y2="${yy}" stroke="#e8edf2" stroke-width="1"/>`;
    let label = val >= 100000000 ? (val / 100000000).toFixed(1) + '억' : val >= 10000 ? Math.round(val / 10000) + '만' : Math.round(val);
    h += `<text x="${p.l - 9}" y="${yy + 4}" font-size="11" fill="#8a97a5" text-anchor="end">${label}</text>`;
  }

  // X축 레이블 (1~12월)
  for (let i = 0; i < 12; i++) {
    h += `<text x="${x(i)}" y="${H - 12}" font-size="11" fill="#7e8d9a" text-anchor="middle">${i + 1}월</text>`;
  }

  // 시리즈 라인 및 점
  for (const s of series) {
    let path = '', dots = '';
    (s.values || []).forEach((v, i) => {
      if (v !== null && v !== undefined && Number.isFinite(Number(v))) {
        const cx = x(i), cy = y(v);
        path += (path ? ' L ' : 'M ') + cx + ' ' + cy;
        dots += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${s.color}">
          <title>${esc(s.name)} ${i + 1}월: ${won(v)}</title>
        </circle>`;
      }
    });
    if (path) {
      h += `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.5" ${s.dash ? 'stroke-dasharray="6 4"' : ''}/>`;
    }
    h += dots;
  }

  h += `</svg>`;
  h += `<div class="chart-legend">
    ${series.map(s => `<span><i class="dot" style="background:${s.color}"></i>${esc(s.name)}${s.dash ? ' (예상)' : ''}</span>`).join('')}
  </div>`;
  return h;
}

function createBarChart(rows, W = 720) {
  if (!rows || !rows.length) return '<div style="padding:40px;text-align:center;color:#8a97a5;">표시할 지출 항목이 없습니다.</div>';
  let max = Math.max(1, ...rows.flatMap(r => [Math.abs(Number(r.a) || 0), Math.abs(Number(r.b) || 0)]));
  let l = 100, w = W - l - 24, step = 28, H = Math.max(120, rows.length * step + 24);
  let h = `<svg class="svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="계정과목별 지출 비교 그래프">`;

  rows.forEach((r, i) => {
    let base = 20 + i * step;
    let aa = Math.abs(Number(r.a) || 0) / max * w;
    let bb = Math.abs(Number(r.b) || 0) / max * w;
    const full = r.fullLabel || r.label;
    h += `<text x="${l - 10}" y="${base + 7}" text-anchor="end" font-size="11" fill="#67788c"><title>${esc(full)}</title>${esc(r.label)}</text>`;
    h += `<rect x="${l}" y="${base - 7}" width="${aa}" height="7" rx="2" fill="#94b7d8"><title>${esc(full)} 전년도: ${won(r.a || 0)}</title></rect>`;
    h += `<rect x="${l}" y="${base + 2}" width="${bb}" height="7" rx="2" fill="#205c98"><title>${esc(full)} 기준 연도: ${won(r.b || 0)}</title></rect>`;
  });

  h += `</svg>`;
  h += `<div class="chart-legend">
    <span><i class="dot" style="background:#94b7d8"></i>전년도</span>
    <span><i class="dot" style="background:#205c98"></i>기준 연도</span>
  </div>`;
  return h;
}
