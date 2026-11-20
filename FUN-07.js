
SELECT
    YEAR(일자) AS 연도,
    SUM(
        CASE
            WHEN 구분 = '대변' THEN 금액
            WHEN 구분 = '차변' THEN -금액
            ELSE 0
        END
    ) AS 매출액
FROM `table`
WHERE 계정과목 IN ('상품매출', '제품매출', '용역매출', '매출')
  AND YEAR(일자) IN (2025, 2026)
GROUP BY YEAR(일자)
ORDER BY 연도;
