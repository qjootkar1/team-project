function aggregateSalesAndExpenses(classifiedList) {
  const result = {};

  classifiedList.forEach(item => {
    const year = item.date.slice(0, 4);
    const monthIndex = Number(item.date.slice(5, 7)) - 1; 

    if (!result[year]) {
      result[year] = {
        year,
        annualSales: 0,                  
        annualExpense: 0,                
        monthlySales: Array(12).fill(0), 
        monthlyExpense: Array(12).fill(0), 
        expenseByAccount: {}             
      };
    }

    if (item.category === '매출') {
      
      const salesAmount = Number(item.credit || 0) - Number(item.debit || 0);
      result[year].annualSales += salesAmount;
      if (monthIndex >= 0 && monthIndex < 12) {
        result[year].monthlySales[monthIndex] += salesAmount;
      }
    } else if (item.category === '지출') {
      
      const expenseAmount = Number(item.debit || 0) - Number(item.credit || 0);
      result[year].annualExpense += expenseAmount;
      if (monthIndex >= 0 && monthIndex < 12) {
        result[year].monthlyExpense[monthIndex] += expenseAmount;
      }
      result[year].expenseByAccount[item.account] =
        (result[year].expenseByAccount[item.account] || 0) + expenseAmount;
    }
  });

  return result;
}