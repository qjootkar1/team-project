
function normalizeDate(val) {
  if (typeof val === 'number') {
    const utc = new Date(Math.round((val - 25569) * 86400 * 1000));
    return utc.toISOString().slice(0, 10);
  }
  const s = String(val || '').trim().replace(/\./g, '-').replace(/\//g, '-');
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function extractJournalData(rawRows) {
  if (!Array.isArray(rawRows)) return [];

  return rawRows
    .map((row, index) => {
      const account = String(row['계정과목'] || row['account_name'] || row['account'] || '').trim();
      if (!account) return null; 

      const debit = Number(String(row['차변'] || row['차변(출금)'] || row['debit'] || 0).replace(/,/g, '')) || 0;
      const credit = Number(String(row['대변'] || row['대변(입금)'] || row['credit'] || 0).replace(/,/g, '')) || 0;

      return {
        date: normalizeDate(row['일자'] || row['날짜'] || row['tx_date'] || row['date']),
        number: String(row['번호'] || row['slip_no'] || (index + 1)).padStart(5, '0'),
        type: String(row['구분'] || row['division'] || (debit > 0 ? '차변' : '대변')).trim(),
        account,
        partner: String(row['거래처'] || row['partner'] || '').trim(),
        description: String(row['적요'] || row['description'] || row['memo'] || '').trim(),
        debit,
        credit
      };
    })
    .filter(Boolean);
}