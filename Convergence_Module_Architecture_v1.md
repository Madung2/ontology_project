# Convergence Module: 최종 아키텍처 설계서

> **ERD → Semantic Graph 변환 솔루션**
> v3.0 (Final) | 2026-04-16
> 중심 표현: Semantic IR | SLM: Gemma 4 | 패키지: Python (uv)

---

## 1. 프로젝트 비전

### What

**어떤 RDB든** ERD(DDL/메타데이터)를 입력으로 받아, **SLM(Gemma 4)이 테이블/컬럼의 의미를 분석**하고, 도메인 지식을 참조하여 **의미적으로 풍부한 그래프 스키마**를 생성하는 Convergence Module.

### 핵심 설계 원칙 — 토론 결과 확정

1. **Semantic IR 중심**: OWL이 아닌 자체 JSON IR이 파이프라인의 중심. OWL/Cypher/PGQ는 export 타겟
2. **DB-Agnostic 구조**: SQLAlchemy + 어댑터 패턴. 어떤 RDB든 같은 파이프라인
3. **도메인: 구조는 확장 가능, 콘텐츠는 금융 집중**: 코드에 도메인 하드코딩 없음. 온톨로지 레지스트리로 분리. 단 v1은 금융(FIBO) + Schema.org(폴백) 2개만 탑재
4. **RIGOR 아이디어 차용, 풀 루프는 아님**: iterative context accumulation(순차 처리 + 컨텍스트 누적)은 차용. Judge 자동 검증 루프는 배치 모드 전용, 인터랙티브는 1-shot + Human-in-the-Loop
5. **SLM-First**: Gemma 4 로컬 구동. 외부 API는 opt-in 에스컬레이션
6. **읽기 양방향 v1, 쓰기 양방향은 후순위**: ERD↔Graph 간 트레이서빌리티(이건 어디서 왔는가)는 v1. ALTER TABLE 자동 생성은 나중

### Why: 왜 필요한가

| 기존 접근법 | 한계 |
|-----------|-----|
| Neo4j ETL Tool | FK를 기계적으로 관계로 변환. "HAS_ACCOUNT" 같은 generic 관계만 생성. 비즈니스 의미 없음 |
| 수동 모델링 | 도메인 전문가 + 그래프 모델링 전문가 필요. 시간/비용 막대 |
| R2RML (W3C) | RDB→RDF 매핑 표준이지만 매핑 규칙을 사람이 다 작성해야 함 |
| 현재 프로토타입 | ERD→Graph 기계적 변환은 됨. 의미적 enrichment 없음 |

**Convergence Module은 이 gap을 LLM + 도메인 온톨로지로 메운다.**

---

## 2. 아키텍처 개요: RIGOR-Adaptive 파이프라인

### 2.0 변경된 전제 — v1 → v2 핵심 차이

| 항목 | v1 설계 | v2 설계 (현재) |
|------|---------|--------------|
| DB | Oracle 고정 | 어떤 RDB든 (어댑터 패턴) |
| 도메인 | 은행 고정 (FIBO) | 자동 감지 (은행이 1차 타겟) |
| LLM | GPT-4o / Claude (외부 API) | **Gemma 4 SLM** (로컬 우선) |
| 온톨로지 | FIBO 직접 참조 | **도메인별 온톨로지 레지스트리** |
| 배포 | 클라우드 가능 | **On-premise 우선** (은행 보안) |

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Convergence Module v2                              │
│                                                                          │
│  ┌─────────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │  Phase 0    │──▶│ Phase 1  │──▶│   Phase 2    │──▶│   Phase 3    │  │
│  │  Connect    │   │ Extract  │   │  Ontologize  │   │  Graph Gen   │  │
│  │  & Detect   │   │  & Enrich│   │  (RIGOR)     │   │  & Output    │  │
│  └─────────────┘   └──────────┘   └──────────────┘   └──────────────┘  │
│        │                │                │                  │            │
│  DB 어댑터 선택    IR 정규화       Gemma4 반복생성      스키마 도출      │
│  도메인 자동감지   SLM 테이블분류   도메인온톨로지정렬   멀티타겟 출력    │
│  온톨로지 매칭     컬럼 의미태깅    Judge 검증/병합     시각화 렌더링    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                   Phase 4: Bidirectional Sync                      │  │
│  │   Graph 변경 → ERD 역매핑 | Schema Diff → Delta | 버전 관리       │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
       │               │                  │                    │
  ┌────▼────┐    ┌─────▼──────┐    ┌──────▼──────┐     ┌──────▼──────┐
  │  DB     │    │  SLM       │    │  Ontology   │     │  Output     │
  │ Adapters│    │  Engine    │    │  Registry   │     │  Targets    │
  ├─────────┤    ├────────────┤    ├─────────────┤     ├─────────────┤
  │Oracle   │    │Gemma4 E4B  │    │FIBO (금융)  │     │Neo4j Cypher │
  │Postgres │    │  (기본)    │    │HL7  (의료)  │     │Oracle PGQ   │
  │MySQL    │    │Gemma4 27B  │    │Schema.org   │     │Amazon Nept. │
  │SQL Svr  │    │  (고급)    │    │사내온톨로지 │     │RDF/OWL      │
  │MariaDB  │    │Ollama 서빙 │    │자동감지결과 │     │Mermaid/D3   │
  └─────────┘    └────────────┘    └─────────────┘     └─────────────┘
```

---

## 3. Phase별 상세 설계

### Phase 0: DB 연결 & 도메인 자동 감지 (Connect & Detect)

> **v2 신규** — 솔루션의 범용성을 결정하는 가장 중요한 레이어

#### 3.0.1 DB-Agnostic 어댑터 아키텍처

```
                          ┌─────────────────────┐
                          │   Unified Schema     │
                          │   Extraction API     │
                          │                     │
                          │  extract_tables()    │
                          │  extract_columns()   │
                          │  extract_fks()       │
                          │  extract_indexes()   │
                          │  extract_comments()  │
                          │  sample_data(n=100)  │
                          └──────────┬──────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
            ┌───────▼──────┐ ┌──────▼───────┐ ┌─────▼────────┐
            │  Oracle      │ │  PostgreSQL  │ │  MySQL       │
            │  Adapter     │ │  Adapter     │ │  Adapter     │
            ├──────────────┤ ├──────────────┤ ├──────────────┤
            │ALL_TABLES    │ │information_  │ │information_  │
            │ALL_TAB_COLS  │ │  schema      │ │  schema      │
            │ALL_CONS*     │ │pg_catalog    │ │SHOW CREATE   │
            │DBMS_METADATA │ │pg_description│ │  TABLE       │
            │DBA_COL_COMM* │ │              │ │              │
            └──────────────┘ └──────────────┘ └──────────────┘
                    │                │                │
            ┌───────▼──────┐ ┌──────▼───────┐ ┌─────▼────────┐
            │  SQL Server  │ │  MariaDB     │ │  SQLite      │
            │  Adapter     │ │  Adapter     │ │  Adapter     │
            ├──────────────┤ ├──────────────┤ ├──────────────┤
            │sys.tables    │ │(MySQL 호환)  │ │sqlite_master │
            │sys.columns   │ │+ 고유 확장   │ │pragma_*      │
            │sys.foreign_* │ │              │ │              │
            └──────────────┘ └──────────────┘ └──────────────┘
```

**핵심 설계 결정**:

어댑터 인터페이스 — 모든 DB 어댑터가 구현해야 하는 공통 계약:

```python
# Python pseudocode
class DBAdapter(Protocol):
    """모든 DB 어댑터의 공통 인터페이스"""

    def connect(self, conn_string: str) -> Connection: ...
    def extract_tables(self) -> list[TableMeta]: ...
    def extract_columns(self, table: str) -> list[ColumnMeta]: ...
    def extract_foreign_keys(self) -> list[ForeignKeyMeta]: ...
    def extract_indexes(self, table: str) -> list[IndexMeta]: ...
    def extract_comments(self, table: str) -> dict[str, str]: ...
    def extract_constraints(self, table: str) -> list[ConstraintMeta]: ...
    def sample_data(self, table: str, n: int = 100) -> list[dict]:
        """의미 분석용 샘플. 민감 데이터 마스킹 자동 적용"""
        ...
    def get_dialect(self) -> str:
        """'oracle', 'postgresql', 'mysql' 등 반환"""
        ...
```

**1차 버전 전략**: SQLAlchemy를 래핑해서 시작. SQLAlchemy의 `inspect()` 가 이미 대부분의 DB에서 테이블/컬럼/FK 추출을 지원하므로, 어댑터 레이어를 직접 만들되 내부적으로 SQLAlchemy의 리플렉션을 활용.

```python
# v1 구현 예시
from sqlalchemy import create_engine, inspect

class SQLAlchemyAdapter:
    """v1: SQLAlchemy 기반 범용 어댑터"""

    def __init__(self, connection_url: str):
        self.engine = create_engine(connection_url)
        self.inspector = inspect(self.engine)
        self.dialect = self.engine.dialect.name  # 'oracle', 'postgresql', etc.

    def extract_tables(self) -> list[TableMeta]:
        return self.inspector.get_table_names()

    def extract_columns(self, table: str) -> list[ColumnMeta]:
        return self.inspector.get_columns(table)

    def extract_foreign_keys(self) -> list[ForeignKeyMeta]:
        # 모든 테이블의 FK를 한번에 수집
        fks = []
        for table in self.extract_tables():
            fks.extend(self.inspector.get_foreign_keys(table))
        return fks
```

**DB별 특수 처리가 필요한 부분** (이건 어댑터를 분리해야 하는 이유):

| 항목 | Oracle | PostgreSQL | MySQL |
|------|--------|-----------|-------|
| 테이블 코멘트 | `ALL_TAB_COMMENTS` | `pg_description` + OID | 지원 미약 |
| 컬럼 코멘트 | `ALL_COL_COMMENTS` | `pg_description` | `COLUMN_COMMENT` |
| 파티션 정보 | `ALL_TAB_PARTITIONS` | `pg_partitioned_table` | `PARTITIONS` |
| 통계 정보 | `ALL_TAB_STATISTICS` | `pg_stats` | `information_schema.STATISTICS` |
| 시퀀스/Auto-inc | SEQUENCE + IDENTITY | SERIAL/IDENTITY | AUTO_INCREMENT |

> **고민 포인트**: 코멘트(테이블/컬럼 설명)는 SLM 의미 분석의 **가장 강력한 시그널**이지만, DB마다 저장 방식이 완전히 다름. 코멘트가 없는 DB라면 SLM이 컬럼명만으로 추론해야 함.

#### 3.0.2 도메인 자동 감지 엔진 — 핵심 고민 포인트 (신규)

> **왜 필요한가**: 은행에 납품하면 FIBO를 참조하고, 병원에 납품하면 HL7/FHIR를 참조해야 함. 이걸 사용자가 매번 설정하는 게 아니라, 스키마 문맥에서 자동 감지.

**감지 파이프라인**:

```
[ERD 메타데이터]
      │
      ▼
┌─────────────────────────────────────────────┐
│  Stage 1: 시그널 수집 (룰 기반, 빠름)        │
│                                             │
│  테이블명 키워드 매칭:                       │
│    account, transaction, loan → 금융 +3점    │
│    patient, diagnosis, prescription → 의료 +3│
│    product, cart, order → 이커머스 +3점       │
│    sensor, device, telemetry → IoT +3점      │
│                                             │
│  컬럼명 키워드 매칭:                         │
│    credit_score, kyc, swift_code → 금융 +2점 │
│    icd_code, dosage, blood_type → 의료 +2점  │
│    sku, shipping_address → 이커머스 +2점     │
│                                             │
│  테이블/컬럼 코멘트 키워드 (있으면):          │
│    도메인 용어 TF-IDF 매칭 → +1~3점          │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Stage 2: SLM 확인 (Gemma4, 애매한 경우)     │
│                                             │
│  시그널 점수 차이가 작으면 (1위-2위 < 5점):   │
│  → Gemma4에 테이블 목록 + 샘플 컬럼 전달     │
│  → "이 DB의 주 도메인은?" 질의               │
│  → 복합 도메인 가능 (금융+보험, 의료+연구)    │
│                                             │
│  시그널 점수 차이가 크면 (1위-2위 >= 5점):    │
│  → SLM 호출 생략 (비용 절약)                 │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Stage 3: 온톨로지 레지스트리 매칭            │
│                                             │
│  감지된 도메인 → 참조할 온톨로지 결정:        │
│                                             │
│  금융 → FIBO + FIB-DM                       │
│  의료 → HL7 FHIR + SNOMED CT               │
│  이커머스 → Schema.org + GoodRelations       │
│  제조 → ISA-95 / OPC UA                     │
│  범용/불명 → Schema.org (최소 공통)           │
│  사내전용 → 사용자 업로드 온톨로지            │
│                                             │
│  ※ 사용자가 수동 override 항상 가능           │
└─────────────────────────────────────────────┘
```

**온톨로지 레지스트리 구조**:

```json
{
  "registry": [
    {
      "domain": "finance",
      "display_name": "금융/은행",
      "ontologies": [
        {
          "name": "FIBO",
          "version": "2024Q4",
          "path": "ontologies/fibo/",
          "format": "OWL",
          "entity_count": 3173,
          "description": "Financial Industry Business Ontology"
        },
        {
          "name": "FIB-DM",
          "version": "2024",
          "path": "ontologies/fib-dm/",
          "format": "OWL",
          "entity_count": 3173
        }
      ],
      "detection_keywords": {
        "table_names": ["account", "transaction", "loan", "deposit", "branch",
                        "customer", "credit", "mortgage", "portfolio", "fund"],
        "column_names": ["credit_score", "kyc_status", "swift_code", "iban",
                         "interest_rate", "maturity_date", "collateral"]
      },
      "seed_mappings": {
        "customers": "fibo-fnd:Party",
        "accounts": "fibo-fbc:Account",
        "transactions": "fibo-fbc:Transaction",
        "loans": "fibo-loan:Loan",
        "branches": "fibo-fnd:OrganizationalUnit"
      }
    },
    {
      "domain": "healthcare",
      "display_name": "의료/헬스케어",
      "ontologies": [
        {"name": "HL7 FHIR", "format": "JSON-LD"},
        {"name": "SNOMED CT", "format": "OWL"}
      ],
      "detection_keywords": {
        "table_names": ["patient", "diagnosis", "prescription", "appointment",
                        "ward", "doctor", "treatment", "lab_result"],
        "column_names": ["icd_code", "dosage", "blood_type", "allergy",
                         "insurance_id", "diagnosis_date"]
      }
    },
    {
      "domain": "ecommerce",
      "display_name": "이커머스/유통",
      "ontologies": [
        {"name": "Schema.org", "format": "JSON-LD"},
        {"name": "GoodRelations", "format": "OWL"}
      ],
      "detection_keywords": {
        "table_names": ["product", "cart", "order", "shipping", "review",
                        "category", "inventory", "wishlist"],
        "column_names": ["sku", "price", "shipping_address", "tracking_number",
                         "quantity", "discount_code"]
      }
    },
    {
      "domain": "generic",
      "display_name": "범용",
      "ontologies": [
        {"name": "Schema.org", "format": "JSON-LD"}
      ],
      "detection_keywords": {},
      "note": "어떤 도메인에도 매칭 안 될 때의 폴백"
    }
  ]
}
```

> **고민 포인트**: 도메인이 복합적인 경우(예: 핀테크 = 금융 + IT, 보험 = 금융 + 보험 특화)에는 온톨로지를 **병합(merge)**해야 함. 이 병합 전략이 Phase 2의 RIGOR 품질에 직결됨.

---

### Phase 1: ERD 메타데이터 추출 & SLM Enrichment (Extract)

**목표**: 어떤 RDB든 구조 정보를 정규화된 중간 표현(IR)으로 변환하고, **SLM으로 의미 태깅**

#### 3.1.1 입력 소스별 처리

```
[입력 소스]
├── DDL 파일 (.sql)
│   └── sqlglot으로 파싱 (dialect 자동감지: Oracle/PG/MySQL/TSQL)
│       sqlglot.transpile(sql, read="auto") → AST → IR
├── DB 라이브 연결
│   └── SQLAlchemy inspect() 기반 통합 어댑터 (Phase 0)
├── ERD 도구 출력 (DrawSQL, ERDPlus, dbdiagram.io)
│   └── 각 도구의 export format(JSON/XML) 파서
├── SchemaCrawler 출력
│   └── JSON/YAML 직접 사용
└── 기타 (CSV 스키마 정의, Prisma schema, Django models.py 등)
    └── 확장 파서 플러그인
```

**sqlglot의 핵심 역할**: DDL 입력 시 SQL 방언을 자동 감지하므로, 사용자가 DB 종류를 명시하지 않아도 `CREATE TABLE` 문법에서 Oracle인지 PostgreSQL인지 MySQL인지 구분 가능.

#### 3.1.2 중간 표현 (Intermediate Representation) 스키마

```json
{
  "schema_name": "banking_core",
  "extraction_date": "2026-04-16",
  "source_db": "Oracle 23ai",
  "tables": [
    {
      "name": "customers",
      "type": "entity",         // entity | junction | lookup | audit
      "columns": [
        {
          "name": "customer_id",
          "data_type": "SERIAL",
          "is_pk": true,
          "is_fk": false,
          "nullable": false,
          "comment": "고객 고유 식별자"
        },
        {
          "name": "credit_score",
          "data_type": "INTEGER",
          "is_pk": false,
          "business_domain": "risk_assessment"
        }
      ],
      "primary_key": ["customer_id"],
      "foreign_keys": [],
      "indexes": [...],
      "row_count_estimate": 1500000,
      "table_comment": "개인/법인 고객 마스터"
    }
  ],
  "foreign_keys": [
    {
      "name": "fk_accounts_customers",
      "from_table": "accounts",
      "from_columns": ["customer_id"],
      "to_table": "customers",
      "to_columns": ["customer_id"],
      "cardinality": "N:1",
      "on_delete": "RESTRICT"
    }
  ],
  "junction_tables": ["customer_branch"]  // M:N 관계 테이블 자동 감지
}
```

#### 3.1.3 Gemma 4 SLM 기반 테이블 의미 분석 — 핵심 엔진

> **왜 Gemma 4인가**: 로컬 구동 가능(E4B는 4B 파라미터 — GPU 1장), 구조화된 JSON 출력 네이티브 지원, 다국어(한국어 테이블 코멘트 이해), function calling 지원. Ollama로 즉시 서빙 가능.

**SLM 역할 범위** — Gemma 4가 하는 일과 하지 않는 일:

```
[Gemma 4가 담당하는 것]
├── 테이블 유형 분류 (entity / junction / lookup / audit)
├── 컬럼 의미 태깅 (이 컬럼이 뭘 의미하는지)
├── 도메인 감지 보조 (Stage 2)
├── FK 관계의 비즈니스 의미 해석
├── 테이블 그룹핑 제안 (어떤 테이블들이 하나의 비즈니스 단위인지)
└── Judge 역할 (온톨로지 프래그먼트 검증)

[Gemma 4가 담당하지 않는 것]
├── 메타데이터 추출 (이건 DB 어댑터가 함)
├── 그래프 스키마 최종 결정 (사용자 확인 필수)
├── 실제 데이터 접근 (보안상 스키마+샘플만)
└── OWL 추론 (이건 HermiT/Owlready2가 함)
```

**테이블 유형 분류 — 2단계 파이프라인**:

```
Stage 1: 휴리스틱 (빠름, 무료, 확정적)
─────────────────────────────────────
| 패턴                              | 분류      | 신뢰도 |
|----------------------------------|----------|--------|
| PK 단일 자체ID, FK 0~1개          | entity   | 0.9    |
| PK = 복합키(FK 2개로 구성)         | junction | 0.95   |
| 컬럼 2~3개, *_code/*_type 패턴    | lookup   | 0.85   |
| *_log, *_hist, *_audit 접미사     | audit    | 0.9    |
| created_at + updated_at + 원본FK  | history  | 0.8    |

Stage 2: Gemma 4 (신뢰도 < 0.8인 테이블만)
──────────────────────────────────────────
프롬프트:
```

```
[Gemma 4 테이블 분류 프롬프트]

<system>
You are a database schema analyst. Classify the table type
based on its structure. Return JSON only.
</system>

<user>
Table: {table_name}
Columns: {columns_json}
Primary Key: {pk_columns}
Foreign Keys: {fk_list}
Comment: {table_comment_if_exists}
Detected domain: {domain_from_phase0}

Classify as one of:
- "entity": Independent business object (becomes a Graph Node)
- "junction": M:N relationship bridge (becomes a Graph Edge)
- "lookup": Reference/code table (becomes Node property or Enum)
- "audit": Historical/log table (becomes temporal versioning layer)
- "hybrid": Multiple roles (explain in reasoning)

Return:
{
  "classification": "entity|junction|lookup|audit|hybrid",
  "confidence": 0.0-1.0,
  "reasoning": "why this classification",
  "graph_suggestion": "node|edge|property|temporal",
  "semantic_label": "suggested human-readable name for graph"
}
</user>
```

**컬럼 의미 태깅** — SLM이 각 컬럼에 의미 태그를 부여:

```json
// Gemma 4 출력 예시 — "accounts" 테이블
{
  "table": "accounts",
  "column_semantics": [
    {
      "column": "account_id",
      "semantic_tag": "identifier",
      "graph_role": "node_id",
      "description": "계좌 고유 식별자"
    },
    {
      "column": "account_type",
      "semantic_tag": "discriminator",
      "graph_role": "relationship_differentiator",
      "description": "계좌 유형 — 이 값에 따라 그래프 관계 분화 가능",
      "distinct_values_hint": ["savings", "checking", "investment"]
    },
    {
      "column": "customer_id",
      "semantic_tag": "foreign_reference",
      "graph_role": "relationship_source",
      "relationship_meaning": "소유(holds) 또는 공동소유(co-holds)",
      "description": "계좌 소유 고객"
    },
    {
      "column": "balance",
      "semantic_tag": "measure",
      "graph_role": "node_property",
      "description": "현재 잔액 — 시계열 추적 대상"
    },
    {
      "column": "created_at",
      "semantic_tag": "temporal_marker",
      "graph_role": "temporal_property",
      "description": "계좌 개설일"
    }
  ]
}
```

> **핵심**: 이 의미 태깅 결과가 Phase 2(RIGOR)의 Generator에 직접 전달됨. SLM이 한번 분석한 결과를 온톨로지 생성에 재활용하므로, **Phase 1의 SLM 투자가 Phase 2의 품질과 속도를 모두 높임**.

**Gemma 4 서빙 아키텍처**:

```
┌──────────────────────────────────────────────────┐
│  Convergence Module Backend (FastAPI)             │
│                                                  │
│  ┌──────────┐    ┌─────────────────────────────┐ │
│  │ Request  │───▶│  Ollama (localhost:11434)    │ │
│  │ Queue    │    │                             │ │
│  │          │    │  gemma4:4b  (기본, 빠름)     │ │
│  │  배치    │    │  gemma4:27b (고급, 복잡 분석)│ │
│  │  처리    │    │                             │ │
│  └──────────┘    │  GPU: RTX 4090 1장이면 충분  │ │
│                  │  (E4B 기준)                  │ │
│                  └─────────────────────────────┘ │
└──────────────────────────────────────────────────┘

모델 선택 전략:
- 테이블 분류, 컬럼 태깅 → gemma4:4b (빠르고 충분)
- 복합 도메인 감지, 관계 의미 해석 → gemma4:27b (정확도 필요)
- Judge 역할 → gemma4:27b (검증은 신중하게)
```

**도메인 무관 작동 보장 — 핵심 고민 포인트 (신규)**:

SLM 프롬프트에 도메인 특화 용어를 하드코딩하면 안 됨. 대신:

```
[나쁜 예 — 금융에만 작동]
"이 테이블이 FIBO의 Account에 매핑되는지 분석하세요"

[좋은 예 — 도메인 무관]
"이 테이블의 비즈니스 역할을 분석하세요.
 감지된 도메인: {detected_domain}
 참조 온톨로지: {ontology_name}
 관련 클래스 후보: {ontology_classes_subset}"
```

프롬프트 템플릿은 고정이되, **변수로 주입되는 도메인 컨텍스트**가 달라지는 구조. 이렇게 하면 같은 코드로 은행DB든 병원DB든 처리 가능.

---

### Phase 2: RIGOR 스타일 온톨로지 생성 (Ontologize)

**목표**: Phase 1의 IR을 입력으로, LLM이 반복적으로 OWL 온톨로지 프래그먼트를 생성하고, 이를 검증/병합하여 도메인 온톨로지를 구축

#### 3.2.1 RIGOR 핵심 메커니즘 차용 — Gemma 4 적응형

```
RIGOR 원본 파이프라인:
  for each table (FK 의존성 순서):
    1. Context Assembly (스키마 + DB 문서 + 기존 온톨로지 + 도메인 온톨로지)
    2. Generator-SLM이 delta ontology fragment 생성
    3. Judge-SLM이 fragment 검증
    4. 통과 시 Core Ontology에 병합
    5. 실패 시 피드백 → Generator에 재시도

Convergence 적응형 (v2):
  - Generator: Gemma4 27B (복잡한 온톨로지 생성)
  - Judge: Gemma4 4B (빠른 형식 검증) + 27B (의미 검증)
  - Reference Ontology: Phase 0에서 감지된 도메인 온톨로지
    - 은행 → FIBO
    - 의료 → HL7 FHIR
    - 이커머스 → Schema.org
    - 범용 → Schema.org (폴백)
  - Phase 1의 SLM 의미 태깅 결과를 Context에 포함 (중복 분석 방지)
  - FK 순서 + Phase 1 그룹핑 결과를 결합한 처리 순서
```

#### 3.2.2 Generator 프롬프트 설계 — 도메인 무관 템플릿

```
[System]
You are an ontology engineer. Analyze the RDB table below and
generate an OWL 2 DL ontology fragment.

Reference the domain ontology provided to align classes and properties.
Do NOT hallucinate classes that don't exist in the reference.
If no match found, create a new class with rdfs:comment explaining why.

[Context]
Current table: {table_ir_json}
SLM semantic analysis from Phase 1: {slm_enrichment_json}
Existing Core Ontology: {current_ontology_owl}
Detected domain: {detected_domain}
Reference ontology excerpt: {domain_ontology_relevant_subset}
FK relationships: {fk_relationships}

[Task]
Generate a delta ontology fragment in OWL Turtle format including:
1. Class definition (rdfs:subClassOf aligned with reference ontology)
2. Object properties — use BUSINESS-MEANINGFUL names
   BAD:  "HAS_ACCOUNT"
   GOOD: "holdsAccount" (finance), "hasDiagnosis" (healthcare)
3. Data properties (from SLM column semantics)
4. Cardinality constraints
5. Reference ontology mapping (owl:equivalentClass or rdfs:seeAlso)
6. Labels: rdfs:label@en, rdfs:label@ko (if Korean comments exist)

[Output Format — structured JSON for parsing]
{
  "turtle": "...",
  "provenance": {
    "source_table": "...",
    "reference_ontology_used": "...",
    "alignment_confidence": 0.0-1.0,
    "unmapped_columns": [...]
  }
}
```

> **도메인 무관 작동의 핵심**: 프롬프트 템플릿은 하나, 변수(`{detected_domain}`, `{domain_ontology_relevant_subset}`)가 도메인에 따라 바뀜. 은행DB를 넣으면 FIBO가 주입되고, 병원DB를 넣으면 FHIR가 주입됨.

#### 3.2.3 Judge-LLM 검증 기준 — 핵심 고민 포인트 #3

| 검증 항목 | 기준 | 실패 시 처리 |
|----------|------|------------|
| **논리적 일관성** | OWL 2 DL 프로파일 준수, 순환 참조 없음 | 재생성 요청 |
| **FIBO 정합성** | 클래스/프로퍼티가 FIBO와 충돌 않음 | FIBO 매핑 재조정 |
| **도메인 정확성** | 은행 비즈니스 규칙과 부합 | 도메인 전문가 리뷰 큐 |
| **명명 일관성** | camelCase, 기존 네이밍 패턴 준수 | 자동 수정 후 재검증 |
| **커버리지** | 모든 FK 관계가 온톨로지에 반영됨 | 누락 관계 보충 요청 |
| **과잉 생성** | 불필요한 중간 클래스 없음 | 단순화 요청 |

#### 3.2.4 반복 수렴 판단

```python
# 수렴 조건 (Convergence Criteria)
def is_converged(iteration_result):
    return (
        iteration_result.judge_score >= 4.0 / 5.0  # RIGOR 기준
        and iteration_result.fibo_alignment_ratio >= 0.7
        and iteration_result.uncovered_fk_count == 0
        and iteration_result.owl_consistency_check == True
    )
```

---

### Phase 3: 그래프 스키마 생성 (Graph Schema Generation)

**목표**: OWL 온톨로지 → 타겟 그래프 DB 스키마(Neo4j Cypher / Oracle SQL/PGQ)

#### 3.3.1 온톨로지 → 그래프 매핑 규칙

```
OWL 온톨로지               →    그래프 DB 스키마
─────────────────────────────────────────────────
owl:Class                 →    Node Label
owl:ObjectProperty        →    Relationship Type
owl:DatatypeProperty      →    Node/Edge Property
owl:equivalentClass       →    FIBO 매핑 메타데이터
rdfs:subClassOf           →    :SUBTYPE_OF 관계 (선택적)
owl:cardinality           →    제약조건 주석
```

#### 3.3.2 은행 도메인 특화 변환 — 핵심 고민 포인트 #4

**단순 변환 vs. 의미적 변환 비교:**

```
[단순 변환 — 현재 프로토타입 수준]
customers --FK--> accounts  →  (Customer)-[:HAS_ACCOUNT]->(Account)

[의미적 변환 — RIGOR 온톨로지 기반]
customers --FK--> accounts  →  (Customer)-[:HOLDS {since: date, role: 'primary'}]->(Account)
                                (Customer)-[:CO_HOLDS {role: 'joint'}]->(Account)

accounts --FK--> transactions  →  (Account)-[:DEBITED_BY]->(Transaction)
                                   (Account)-[:CREDITED_BY]->(Transaction)
                                   ※ transaction_type에 따라 관계 분화

accounts --FK--> loans  →  (Account)-[:COLLATERAL_FOR]->(Loan)
                            (Customer)-[:BORROWED]->(Loan)
                            (Loan)-[:DISBURSED_TO]->(Account)
                            ※ 하나의 FK가 여러 의미적 관계로 확장
```

#### 3.3.3 출력 포맷

```
[코드 출력 탭]
├── Cypher (Neo4j)
│   ├── 스키마 생성 (CREATE CONSTRAINT, CREATE INDEX)
│   ├── 데이터 마이그레이션 (LOAD CSV / APOC)
│   └── 검증 쿼리
├── SQL/PGQ (Oracle 23ai)
│   ├── PROPERTY GRAPH 생성
│   ├── VERTEX/EDGE 테이블 매핑
│   └── GRAPH_TABLE 쿼리 예시
├── OWL Turtle (온톨로지 원본)
└── Mermaid / D3.js (시각화용)
```

---

### Phase 4: 양방향 동기화 (Bidirectional Sync)

#### 3.4.1 Graph → ERD 역매핑

```
사용자가 그래프 스키마에서 관계를 추가/수정하면:
1. 새 관계가 기존 ERD의 어떤 FK에 대응되는지 역추적
2. 대응 FK가 없으면 → 새 junction 테이블 또는 FK 추가 제안
3. ALTER TABLE DDL 자동 생성
4. 변경 영향도 분석 (영향받는 뷰, SP, 인덱스 목록)
```

#### 3.4.2 Schema Diff & Temporal Versioning

논문(De Martim)의 CTV(Component Temporal Version) 패턴 차용:

```
[스키마 버전 관리]
Schema_v1 (2026-01-01) ──변경──▶ Schema_v2 (2026-04-01)
    │                                 │
    ▼                                 ▼
Ontology_v1 ──delta──▶ Ontology_v2
    │                                 │
    ▼                                 ▼
GraphSchema_v1 ──diff──▶ GraphSchema_v2

각 변경에 Action 노드 생성:
  (:SchemaAction {
    date: "2026-04-01",
    type: "ADD_COLUMN",
    target: "accounts.interest_rate",
    reason: "바젤IV 규제 대응",
    approved_by: "DBA팀"
  })
```

---

## 4. 기획 단계 핵심 고민 포인트 정리

### 고민 #1: 테이블 분류 정확도

**문제**: entity vs. junction vs. lookup 자동 분류의 정확도가 전체 품질을 결정함

**현실적 어려움**:
- 은행 DB는 역사가 길어서 네이밍 규칙이 일관되지 않음
- 같은 패턴이라도 비즈니스 맥락에 따라 분류가 달라짐
  (예: `account_service` — junction? 아니면 독립 entity?)
- 레거시 테이블 중 원래 목적과 다르게 쓰이는 경우 존재

**제안 전략**:
1. 휴리스틱 1차 분류 → 신뢰도 점수 부여
2. 신뢰도 낮은 테이블만 LLM 2차 분류
3. 최종적으로 사용자 확인(UI에서 드래그&드롭으로 재분류)
4. 분류 결과를 학습 데이터로 축적 (조직별 패턴 학습)

---

### 고민 #2: LLM 프롬프트 설계의 일관성

**문제**: 같은 스키마를 넣어도 LLM이 매번 다른 온톨로지를 생성할 수 있음

**현실적 어려움**:
- Temperature, 프롬프트 미세 변경에 따른 출력 편차
- 테이블 처리 순서에 따라 결과가 달라짐
- FIBO 참조 범위를 어디까지 줄 것인가 (전체 3,173 엔티티? subset?)

**제안 전략**:
1. **Seed Ontology**: 은행 핵심 엔티티(Customer, Account, Transaction, Branch, Loan, Card)의 기본 매핑을 고정 seed로 제공
2. **Temperature 0에 가까운 설정** + deterministic sampling
3. **FIBO subset 자동 선택**: 테이블 컬럼명/코멘트와 FIBO 클래스의 임베딩 유사도로 관련 FIBO subset 동적 필터링
4. **캐싱**: 동일 스키마 입력에 대한 온톨로지 결과 캐싱
5. **Human-in-the-Loop**: Judge 단계에서 사용자 개입 옵션

---

### 고민 #3: FIBO 정합성의 깊이 수준

**문제**: FIBO를 얼마나 깊이 적용할 것인가

**현실적 어려움**:
- FIBO는 매우 방대하고 추상적 (상위 온톨로지 성격)
- 한국 은행 실무와 FIBO 사이의 갭 존재 (용어, 규제 체계 차이)
- 너무 깊이 적용하면 실용성 저하, 너무 얕으면 의미 없음

**제안 전략**: 3단계 레벨 제공

| 레벨 | FIBO 적용 깊이 | 적합한 상황 |
|------|--------------|-----------|
| **Lite** | 최상위 클래스만 매핑 (Account, Party, Instrument) | 빠른 PoC, 내부 프로젝트 |
| **Standard** | 2~3 depth 매핑 + 주요 프로퍼티 정렬 | 일반적 프로덕션 |
| **Full** | 전체 FIBO 정렬 + OWL 추론 규칙 | 규제 보고, 글로벌 표준 준수 |

---

### 고민 #4: 의미적 관계 분화의 기준

**문제**: 하나의 FK를 여러 의미적 관계로 분화할 때의 기준

**현실적 어려움**:
- `accounts.customer_id → customers.customer_id` 하나가
  "소유(holds)", "공동소유(co-holds)", "위임관리(manages)" 등 여러 의미가 될 수 있음
- 이 구분은 ERD만으로는 불가능. 데이터 패턴을 봐야 함
- 과도한 분화 → 그래프 복잡도 폭발

**제안 전략**:
1. **기본 모드**: 1 FK = 1 Relationship (안전한 기본값)
2. **분석 모드**: 실제 데이터 샘플링하여 패턴 탐지
   - `SELECT DISTINCT type FROM accounts WHERE customer_id IS NOT NULL`
   - 타입별 분포를 LLM에 제공하여 관계 분화 제안
3. **사용자 결정**: UI에서 "이 FK를 분화하시겠습니까?" 제안 + 미리보기
4. **점진적 분화**: 처음엔 단순하게 시작, 운영 중 쿼리 패턴 분석하여 분화 제안

---

### 고민 #5: SLM 성능 한계와 대응 전략

**문제**: Gemma 4 E4B/27B가 GPT-4o 급 온톨로지를 생성할 수 있는가?

**현실적 어려움**:
- SLM은 LLM보다 복잡한 추론에서 품질이 떨어질 수 있음
- OWL Turtle 문법을 정확히 생성하지 못할 가능성
- 긴 스키마(100+ 컬럼 테이블)에서 컨텍스트 윈도우 부족

**제안 전략**:
1. **Task 분해**: 복잡한 작업을 SLM이 잘하는 작은 단위로 분해
   - "전체 온톨로지 생성" ❌ → "테이블 1개의 클래스 정의" + "관계 1개 정의" ✅
2. **구조화된 출력 강제**: Gemma 4의 `response_format` (JSON schema constraint) 활용. 자유 텍스트 대신 JSON → 후처리로 OWL Turtle 변환
3. **템플릿 기반 생성**: SLM에게 OWL을 처음부터 쓰라고 하지 않고, 파라미터만 채우게 함:
   ```
   "class_name": "Account",
   "parent_class": "fibo-fbc:Account",
   "properties": [{"name": "balance", "type": "xsd:decimal"}]
   → 코드에서 OWL Turtle로 조립
   ```
4. **하이브리드 에스컬레이션**: 기본은 SLM, Judge가 2회 연속 실패하면 외부 LLM API로 에스컬레이션 (opt-in)
5. **로컬 Fine-tuning**: 고객사 스키마 패턴으로 LoRA fine-tuning → 도메인 특화 SLM
6. **벤치마크 기준선**: RIGOR 논문의 CQ score 4.5/5 를 목표로 자체 평가셋 구축

### 고민 #5-1: SLM 한 대로 솔루션이 가능한가?

**테이블 수 vs. 처리 시간 추정 (Gemma4 E4B, RTX 4090 기준)**:

| 테이블 수 | Phase 1 (분류+태깅) | Phase 2 (RIGOR x3회) | 총 소요 시간 |
|----------|--------------------|--------------------|------------|
| 10개 | ~2분 | ~10분 | ~12분 |
| 50개 | ~10분 | ~50분 | ~1시간 |
| 200개 | ~40분 | ~3시간 | ~4시간 |
| 500개 | ~1.5시간 | ~8시간 | ~10시간 |

> 500테이블이면 하루짜리 배치 작업. 하지만 **incremental 모드(변경분만 재처리)**면 일상적으로는 수분 내.
> 최초 1회 풀스캔 → 이후 DDL diff 기반 delta 처리.

### 고민 #5-2: 어떤 DB든 적용 — 실제 어디서 깨지는가?

**DB별 예상 난이도와 함정**:

| DB | 난이도 | 주요 함정 |
|----|--------|----------|
| **PostgreSQL** | 쉬움 | information_schema 표준적. 단 커스텀 타입(ENUM, composite)은 별도 처리 |
| **MySQL/MariaDB** | 쉬움 | SHOW CREATE TABLE이 가장 확실. information_schema 일부 미비 |
| **Oracle** | 보통 | 고유 딕셔너리 뷰(ALL_*). 시노님, 패키지 등 Oracle 전용 개념 많음 |
| **SQL Server** | 보통 | sys.* 뷰. 스키마(dbo 등)가 네임스페이스 역할 → 그래프에서 어떻게 표현? |
| **SQLite** | 쉬움 | pragma로 다 나옴. 하지만 FK enforcement가 꺼져있는 경우 많음 → FK 정보 불완전 |
| **레거시 DB** | 어려움 | FK 없이 JOIN을 컨벤션으로만 쓰는 경우 → SLM이 컬럼명으로 FK 추론해야 |

**FK 없는 DB(레거시) 대응 — 핵심 차별점이 될 수 있음**:

```
[FK가 명시적으로 없는 경우의 관계 추론]

1. 컬럼명 패턴 매칭:
   orders.customer_id → customers.id  (패턴: {table}_id → {table}.id)

2. 데이터 샘플링 검증:
   SELECT DISTINCT o.customer_id FROM orders o
   WHERE o.customer_id NOT IN (SELECT id FROM customers)
   → 0건이면 FK 관계 확실

3. SLM 확인:
   "orders.customer_id와 customers.id는 FK 관계인가?"
   → JSON 결과: {"is_fk": true, "confidence": 0.95}

이 기능이 있으면 "FK를 안 쓰는 레거시 시스템"에서도 작동
→ 솔루션의 적용 범위가 크게 넓어짐
```

---

### 고민 #6: 보안 및 컴플라이언스

**문제**: 은행 스키마 정보가 외부로 유출되면 안 됨

**필수 고려사항**:
- 테이블/컬럼명 자체가 비즈니스 로직을 노출
- 실제 데이터 샘플은 절대 외부 전송 불가
- 규제: 전자금융감독규정, 개인정보보호법, 신용정보법

**제안 전략**:
1. **On-premise 배포 필수 옵션**: 전체 파이프라인 로컬 실행
2. **스키마 난독화 모드**: 외부 LLM 사용 시 컬럼명을 해시/익명화하고, 매핑 테이블을 로컬에서만 관리
3. **데이터 미접촉 보장**: 메타데이터(스키마)만 처리, 실제 row 데이터는 절대 LLM에 전송하지 않음
4. **감사 로그**: 모든 LLM 호출의 입출력 로깅 (어떤 스키마 정보가 전송되었는지 추적)

---

### 고민 #7: 기존 시스템과의 통합

**문제**: 은행은 이미 운영 중인 시스템이 매우 많음

**통합 대상**:
- 기존 데이터 거버넌스 도구 (Collibra, Alation 등)
- 메타데이터 관리 시스템
- CI/CD 파이프라인 (Flyway, Liquibase 등 DB 마이그레이션)
- 기존 BI/리포팅 도구

**제안 전략**:
1. **플러그인 아키텍처**: 각 외부 시스템과의 연동은 어댑터 패턴으로
2. **표준 포맷 지원**: OpenAPI spec, GraphQL schema, OWL/RDF 표준 출력
3. **Git 연동**: 생성된 온톨로지/그래프 스키마를 Git으로 버전 관리
4. **Webhook**: 스키마 변경 감지 시 자동 파이프라인 트리거

---

## 5. 기술 스택 제안 (v2 — SLM-First, DB-Agnostic)

| 계층 | 기술 | 선택 이유 |
|------|------|----------|
| **DB 연결** | SQLAlchemy 2.0 + DB별 드라이버 | 통합 리플렉션 API, 다중 DB 지원 |
| **DDL 파싱** | sqlglot | 방언 자동 감지, Oracle/PG/MySQL/TSQL 모두 지원 |
| **메타 추출** | SchemaCrawler (보조) | JDBC 기반 상세 메타모델 (코멘트, 트리거 등) |
| **SLM 엔진** | **Gemma 4** (E4B / 27B) | 로컬 구동, JSON 출력, 다국어, function calling |
| **SLM 서빙** | **Ollama** | 원커맨드 설치, 모델 스위칭, REST API |
| **온톨로지 엔진** | Owlready2 (Python) | OWL 2 DL 조작, HermiT 추론기 내장 |
| **온톨로지 참조** | RDFLib + SPARQL | 도메인 온톨로지를 로컬 트리플스토어에 로드 |
| **임베딩** | Qwen3-Embedding (256d) | 다국어 강점, self-hosted, 온톨로지 매칭용 |
| **그래프 DB 출력** | 어댑터 패턴 (Neo4j/Oracle/Neptune/...) | 고객 환경 맞춤 |
| **UI** | React + D3.js/Cytoscape.js | 현재 프로토타입 확장 |
| **백엔드** | FastAPI (Python) | 온톨로지 + SLM 라이브러리 생태계 |
| **버전 관리** | Git + DVC | 스키마 + 온톨로지 파일 추적 |

### Gemma 4 모델 선택 가이드

| 작업 | 모델 | VRAM | 속도 | 정확도 |
|------|------|------|------|--------|
| 테이블 분류 | gemma4:4b (E4B) | ~4GB | 빠름 | 충분 |
| 컬럼 의미 태깅 | gemma4:4b | ~4GB | 빠름 | 충분 |
| 도메인 감지 (Stage 2) | gemma4:4b | ~4GB | 빠름 | 충분 |
| 온톨로지 Generator | **gemma4:27b** | ~18GB | 보통 | 높음 |
| Judge 형식 검증 | gemma4:4b | ~4GB | 빠름 | 충분 |
| Judge 의미 검증 | **gemma4:27b** | ~18GB | 보통 | 높음 |
| 관계 의미 분화 | **gemma4:27b** | ~18GB | 보통 | 높음 |

> **최소 HW**: RTX 4060 (8GB) — E4B만 사용 시
> **권장 HW**: RTX 4090 (24GB) — 27B까지 사용 시
> **서버급**: A100 40GB — 모든 모델 + 배치 처리

---

## 6. MVP 로드맵 제안 (v2)

### Milestone 0: 현재 상태 (프로토타입) ✅
- [x] ERD 입력 UI (8 테이블 데모)
- [x] 기계적 변환 (테이블→노드, FK→엣지)
- [x] Graph 시각화 (Cytoscape.js 추정)
- [x] 양방향 변환 UI 탭 (ERD→Graph, Graph→ERD, Bidirectional)
- [x] 샘플 로드 기능

### Milestone 1: Gemma 4 + DB 어댑터 기반 (3~4주)
> 목표: "기계적 변환"을 "SLM 의미 변환"으로 업그레이드

- [ ] Ollama + Gemma4 E4B 로컬 셋업
- [ ] SQLAlchemy 기반 DB 어댑터 (PostgreSQL 1차)
- [ ] DDL import (sqlglot, 방언 자동감지)
- [ ] 테이블 유형 분류 (휴리스틱 + Gemma4 보조)
- [ ] 컬럼 의미 태깅 (Gemma4 JSON 출력)
- [ ] IR(중간 표현) 정규화
- [ ] **데모**: PostgreSQL 은행 샘플DB → 의미 태깅된 그래프 스키마

### Milestone 2: 도메인 자동 감지 + RIGOR Lite (3~4주)
> 목표: 은행이 아닌 DB를 넣어도 작동하는 것을 증명

- [ ] 도메인 감지 엔진 (룰 Stage 1 + SLM Stage 2)
- [ ] 온톨로지 레지스트리 (FIBO, Schema.org 2종 먼저)
- [ ] RIGOR Generator 프롬프트 v1 (도메인 무관 템플릿)
- [ ] RIGOR Judge 프롬프트 v1
- [ ] 반복 루프 (max 3회, 수렴 판단)
- [ ] 온톨로지 결과 캐싱
- [ ] **데모**: 이커머스 샘플DB → Schema.org 기반 그래프 스키마 자동 생성

### Milestone 3: 다중 DB + 출력 다변화 (2~3주)
> 목표: Oracle, MySQL 어댑터 추가 + Neo4j/Cypher 외 출력 지원

- [ ] Oracle 어댑터 (ALL_* 딕셔너리 뷰)
- [ ] MySQL 어댑터
- [ ] FK 없는 레거시 DB의 관계 추론 (컬럼명 패턴 + 샘플링)
- [ ] Cypher / SQL-PGQ / RDF 출력 생성
- [ ] 관계 분화 제안 UI (SLM 제안 → 사용자 확인)
- [ ] **데모**: Oracle 은행DB + MySQL 이커머스DB → 각각 적절한 그래프 스키마

### Milestone 4: 양방향 Sync + 버전 관리 (3~4주)
- [ ] Graph → ERD 역매핑
- [ ] Schema Diff 엔진 (DDL 변경 감지)
- [ ] Temporal Versioning (Action 노드 패턴)
- [ ] 변경 이력 시각화 타임라인

### Milestone 5: 솔루션 패키징 (4~6주)
- [ ] Docker Compose 원클릭 배포 (FastAPI + Ollama + UI)
- [ ] On-premise 설치 가이드
- [ ] 스키마 난독화 모드 (외부 LLM 에스컬레이션 시)
- [ ] 감사 로그 (SLM 입출력 전체 기록)
- [ ] 고객사 온톨로지 업로드 기능
- [ ] 대규모 스키마 배치 처리 (500+ 테이블, incremental)

---

## 7. 추가 탐색할 키워드 & 논문

### 직접 관련 논문/도구
| 이름 | 설명 | 키워드 |
|------|------|--------|
| **RIGOR** (arXiv:2506.01232) | RDB → OWL 자동 생성의 SOTA | `RIGOR ontology RDB` |
| **Rel2Graph** (ResearchGate) | RDB → Neo4j 자동 구축 | `Rel2Graph relational Neo4j` |
| **OG-RAG** | 온톨로지 기반 RAG | `OG-RAG ontology grounded` |
| **FIB-DM** | FIBO 기반 데이터 모델 (3,173 엔티티) | `FIB-DM financial data model` |

### 확장 가능한 검색 키워드
- `"schema matching" LLM automatic alignment 2025`
- `"ontology alignment" FIBO banking Korean regulations`
- `"property graph" SQL/PGQ Oracle 23ai tutorial`
- `"knowledge graph" "anti-money laundering" graph database`
- `"graph schema evolution" temporal versioning`
- `"LLM-based ETL" relational to graph migration`
- `"데이터 리니지" "지식그래프" 금융`
- `"금융 온톨로지" FIBO 한국어 매핑`
- `"바젤IV" 데이터 모델 그래프`

---

## 8. 참고 자료 링크

- FIBO 공식: https://spec.edmcouncil.org/fibo/
- RIGOR 논문: https://arxiv.org/abs/2506.01232
- Neo4j RDB→Graph 가이드: https://neo4j.com/docs/getting-started/data-modeling/relational-to-graph-modeling/
- Oracle SQL/PGQ 문서: https://docs.oracle.com/en/database/oracle/property-graph/
- Owlready2 (Python OWL): https://owlready2.readthedocs.io/
- De Martim 논문 (Graph RAG for Legal Norms): arXiv:2505.00039
