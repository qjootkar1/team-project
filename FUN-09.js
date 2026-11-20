
SELECT
    YEAR(일자) AS 연도,
    계정과목,
    SUM(
        CASE
            WHEN 구분 = '차변' THEN 금액
            WHEN 구분 = '대변' THEN -금액
            ELSE 0
        END
    ) AS 지출액
FROM `table`
WHERE 계정과목 IN (
    '급여', '임차료', '광고선전비',
    '수도광열비', '복리후생비', '여비교통비'
)
AND YEAR(일자) IN (2025, 2026)
GROUP BY YEAR(일자), 계정과목
ORDER BY 계정과목, 연도;
