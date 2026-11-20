# AccountScope · n8n 자동화 & DB & AI API 연동 가이드

기존 로컬 회계 시스템에 **n8n 워크플로우**, **PostgreSQL 데이터베이스**, 그리고 **AI(OpenAI / Gemini) 실시간 요약 API**를 손쉽게 연동하는 원클릭 세팅 가이드입니다.

---

## 🚀 1분 초간단 실행 방법 (Windows)

### 1단계: 원클릭 서비스 실행
1. [Docker Desktop](https://www.docker.com/products/docker-desktop/)이 켜져 있는지 확인합니다.
2. 폴더 내 **`start_n8n_db.bat`** 파일을 더블 클릭합니다.
   - 자동으로 **PostgreSQL 15 데이터베이스**(포트: 5432)와 **n8n**(포트: 5678)이 백그라운드로 실행됩니다.
   - 초기 데이터베이스 테이블(`accounting_journals`, `accounting_ai_summaries` 등)이 자동으로 생성됩니다.
   - 브라우저에 n8n 화면(`http://localhost:5678`)이 자동으로 열립니다.

---

### 2단계: AI 워크플로우 템플릿 불러오기 (Import)
1. 열린 n8n 화면에서 우측 상단 **[Add workflow]** 클릭
2. 우측 상단 점 세 개(`...`) 메뉴 클릭 → **[Import from File]** 선택
3. 프로젝트 폴더의 **`n8n_accounting_ai_workflow.json`** 파일을 선택합니다.
4. **전표 수신(Webhook) → 데이터 정규화 → OpenAI/Gemini LLM 요약 → DB 자동 저장** 5단계 노드가 즉시 로드됩니다.

---

### 3단계: 본인의 AI API Key 입력 후 활성화
1. 캔버스에서 **`OpenAI Chat Model`** 노드를 더블 클릭합니다.
2. **Credential** 항목에서 본인의 OpenAI API Key (`sk-...`) 또는 Gemini API Key를 입력하고 저장합니다.
3. 우측 상단의 토글 스위치를 **`Active`**로 켜고 **[Save]**를 누르면 끝입니다!

---

## 🛡️ 무중단 안전 연동 구조 (Progressive Enhancement)
- **n8n이 켜져 있을 때:** `forecast.html`(차기년도 예측) 및 `report.html`(결산 보고서)에서 실제 AI(GPT/Gemini)가 분석한 실시간 경영 요약 브리핑이 화면에 표시됩니다.
- **n8n이 꺼져 있거나 API 키가 없을 때:** 0.001초 만에 기존의 내장 통계 엔진(`generateAIOpinion`)으로 자동 폴백되므로, 화면이 멈추거나 깨지는 일이 일체 없습니다.
