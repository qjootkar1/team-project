-- ==========================================================
-- AccountScope 회계 전표 및 AI 결산 자동화 DB 스키마
-- PostgreSQL 15 호환
-- ==========================================================

-- 1. 데이터셋(업로드 파일 단위) 테이블
CREATE TABLE IF NOT EXISTS accounting_datasets (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    year INT NOT NULL,
    row_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 분개장 거래 전표 원장 테이블
CREATE TABLE IF NOT EXISTS accounting_journals (
    id SERIAL PRIMARY KEY,
    dataset_id VARCHAR(64) REFERENCES accounting_datasets(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    account VARCHAR(100) NOT NULL,
    debit BIGINT DEFAULT 0,
    credit BIGINT DEFAULT 0,
    client VARCHAR(255),
    memo TEXT,
    category VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. AI 경영 분석 요약 이력 테이블
CREATE TABLE IF NOT EXISTS accounting_ai_summaries (
    id SERIAL PRIMARY KEY,
    target_year INT NOT NULL,
    compare_year INT,
    prompt_payload JSONB,
    ai_summary TEXT NOT NULL,
    model_name VARCHAR(100) DEFAULT 'gpt-4o-mini',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_journals_date ON accounting_journals(date);
CREATE INDEX IF NOT EXISTS idx_journals_category ON accounting_journals(category);
CREATE INDEX IF NOT EXISTS idx_journals_account ON accounting_journals(account);
