-- ==========================================================
-- AccountScope - HeidiSQL / MySQL / MariaDB 호환 테이블 생성 스크립트
-- HeidiSQL 상단 [쿼리] 탭에 붙여넣고 F9(실행)를 누르시면 됩니다.
-- ==========================================================

-- 1. 데이터베이스 생성 (없는 경우)
CREATE DATABASE IF NOT EXISTS `accountscope` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `accountscope`;

-- 2. 데이터셋 관리 테이블
CREATE TABLE IF NOT EXISTS `accounting_datasets` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `year` INT NOT NULL,
    `row_count` INT DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 분개장 거래 전표 원장 테이블
CREATE TABLE IF NOT EXISTS `accounting_journals` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `dataset_id` VARCHAR(64),
    `date` DATE NOT NULL,
    `account` VARCHAR(100) NOT NULL,
    `debit` BIGINT DEFAULT 0,
    `credit` BIGINT DEFAULT 0,
    `client` VARCHAR(255),
    `memo` TEXT,
    `category` VARCHAR(50),
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_journals_date` (`date`),
    KEY `idx_journals_category` (`category`),
    KEY `idx_journals_account` (`account`),
    CONSTRAINT `fk_journals_dataset` FOREIGN KEY (`dataset_id`) REFERENCES `accounting_datasets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. AI 경영 분석 요약 이력 테이블
CREATE TABLE IF NOT EXISTS `accounting_ai_summaries` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `target_year` INT NOT NULL,
    `compare_year` INT DEFAULT NULL,
    `prompt_payload` JSON,
    `ai_summary` TEXT NOT NULL,
    `model_name` VARCHAR(100) DEFAULT 'gpt-4o-mini',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
