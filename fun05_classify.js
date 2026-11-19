function classifyAccountName(accountName) {
  const acc = String(accountName || '').trim();
  if (!acc) return '기타';

  if (acc.includes('매출') && !acc.includes('외상') && !acc.includes('원가') && !acc.includes('채권')) {
    return '매출';
  }

  
  const expenseKeywords = [
    '급여', '복리후생', '소모품', '임차료', '원재료', '광고', '접대',
    '통신', '수도', '세금', '수수료', '여비', '감가상각', '연구개발',
    '이자비용', '운반비', '차량유지비', '보험료', '교육훈련비', '지급'
  ];
  if (expenseKeywords.some(keyword => acc.includes(keyword))) {
    return '지출';
  }

  
  return '자산/부채';
}


function classifyJournalList(extractedList) {
  return extractedList.map(item => ({
    ...item,
    category: classifyAccountName(item.account)
  }));
}