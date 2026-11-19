const fields = {
  date: ['date', '날짜', '일자', '거래일자', '전표일자'],
  account: ['account', '계정과목', '계정'],
  debit: ['debit', '차변', '차변금액'],
  credit: ['credit', '대변', '대변금액'],
  id: ['id', '식별자'],
};

function readCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  let closed = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
        closed = true;
      } else {
        value += character;
      }
      continue;
    }
    if (character === ',' || character === '\n' || character === '\r') {
      row.push(value);
      value = '';
      closed = false;
      if (character !== ',') {
        rows.push(row);
        row = [];
        if (character === '\r' && text[index + 1] === '\n') index++;
      }
    } else if (character === '"' && !value && !closed) {
      quoted = true;
    } else if (closed || character === '"') {
      throw Error('CSV의 따옴표 형식을 확인하세요.');
    } else {
      value += character;
    }
  }
  if (quoted) throw Error('CSV에서 닫히지 않은 따옴표를 발견했습니다.');
  rows.push([...row, value]);
  return rows.filter(columns => columns.some(column => column.trim()));
}

function parseCsv(text) {
  const [header, ...rows] = readCsv(text);
  if (!header) return [];
  const names = header.map(name => name.trim().toLowerCase().replace(/\s+/g, ''));
  const column = Object.fromEntries(Object.entries(fields).map(([name, aliases]) => [
    name, names.findIndex(value => aliases.includes(value)),
  ]));
  if (Object.entries(column).some(([name, index]) => index < 0 && name !== 'id')) {
    throw Error('CSV 첫 줄에 날짜, 계정과목, 차변, 대변 열을 넣으세요.');
  }
  return rows.map((row, index) => {
    if (row.length !== header.length) throw Error('CSV 자료 ' + (index + 1) + '행의 열 개수를 확인하세요.');
    return Object.fromEntries(Object.entries(column).map(([name, position]) => [name, row[position]]));
  });
}

function normalizeAmount(value) {
  if (typeof value === 'number') return value;
  if (value == null || (typeof value === 'string' && !value.trim())) return 0;
  if (typeof value !== 'string') return NaN;
  const amount = value.trim();
  return /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(amount) ? Number(amount.replace(/,/g, '')) : NaN;
}

function normalizeDate(value) {
  if (typeof value !== 'string') return value;
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\.?$/.exec(value.trim());
  if (!match) return value;
  return [match[1], match[2].padStart(2, '0'), match[3].padStart(2, '0')].join('-');
}

export function parseJournal(contents, filename) {
  const text = contents.replace(/^\uFEFF/, '');
  let rows;
  if (/\.csv$/i.test(filename)) {
    rows = parseCsv(text);
  } else {
    const payload = JSON.parse(text);
    rows = Array.isArray(payload) ? payload : payload?.entries;
  }
  if (!Array.isArray(rows) || !rows.length) throw Error('분개장에 전표가 없습니다.');
  const reserved = new Set(rows.map(row => row?.id).filter(id => id != null && String(id).trim()).map(String));
  return rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw Error('분개장 ' + (index + 1) + '행의 형식을 확인하세요.');
    }
    const { id, date, account, debit, credit } = row;
    let rowId = id == null ? '' : String(id).trim();
    if (!rowId) {
      rowId = 'row-' + (index + 1);
      while (reserved.has(rowId)) rowId += '-';
    }
    return { id: rowId, date: normalizeDate(date), account, debit: normalizeAmount(debit), credit: normalizeAmount(credit) };
  });
}
