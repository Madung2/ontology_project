// Sample ERD schema for Banking domain
export const SAMPLE_BANKING_SCHEMA = {
  tables: [
    {
      name: "customers",
      classification: "entity",
      confidence: 0.95,
      source: "heuristic",
      graphRole: "Node",
      columns: [
        { name: "customer_id", type: "INT", pk: true, fk: false },
        { name: "first_name", type: "VARCHAR(100)", pk: false, fk: false },
        { name: "last_name", type: "VARCHAR(100)", pk: false, fk: false },
        { name: "email", type: "VARCHAR(255)", pk: false, fk: false },
        { name: "phone", type: "VARCHAR(20)", pk: false, fk: false },
        { name: "created_at", type: "TIMESTAMP", pk: false, fk: false },
      ],
    },
    {
      name: "accounts",
      classification: "entity",
      confidence: 0.92,
      source: "heuristic",
      graphRole: "Node",
      columns: [
        { name: "account_id", type: "INT", pk: true, fk: false },
        { name: "customer_id", type: "INT", pk: false, fk: true, ref: "customers.customer_id" },
        { name: "account_type_id", type: "INT", pk: false, fk: true, ref: "account_types.type_id" },
        { name: "balance", type: "DECIMAL(15,2)", pk: false, fk: false },
        { name: "currency", type: "VARCHAR(3)", pk: false, fk: false },
        { name: "opened_date", type: "DATE", pk: false, fk: false },
        { name: "status", type: "VARCHAR(20)", pk: false, fk: false },
      ],
    },
    {
      name: "transactions",
      classification: "entity",
      confidence: 0.88,
      source: "slm",
      graphRole: "Node",
      columns: [
        { name: "txn_id", type: "BIGINT", pk: true, fk: false },
        { name: "from_account_id", type: "INT", pk: false, fk: true, ref: "accounts.account_id" },
        { name: "to_account_id", type: "INT", pk: false, fk: true, ref: "accounts.account_id" },
        { name: "amount", type: "DECIMAL(15,2)", pk: false, fk: false },
        { name: "txn_type", type: "VARCHAR(50)", pk: false, fk: false },
        { name: "txn_date", type: "TIMESTAMP", pk: false, fk: false },
        { name: "description", type: "TEXT", pk: false, fk: false },
      ],
    },
    {
      name: "account_types",
      classification: "lookup",
      confidence: 0.97,
      source: "heuristic",
      graphRole: "Skip",
      columns: [
        { name: "type_id", type: "INT", pk: true, fk: false },
        { name: "type_name", type: "VARCHAR(50)", pk: false, fk: false },
        { name: "description", type: "TEXT", pk: false, fk: false },
      ],
    },
    {
      name: "customer_accounts",
      classification: "junction",
      confidence: 0.85,
      source: "slm",
      graphRole: "Edge",
      columns: [
        { name: "id", type: "INT", pk: true, fk: false },
        { name: "customer_id", type: "INT", pk: false, fk: true, ref: "customers.customer_id" },
        { name: "account_id", type: "INT", pk: false, fk: true, ref: "accounts.account_id" },
        { name: "role", type: "VARCHAR(30)", pk: false, fk: false },
        { name: "added_date", type: "DATE", pk: false, fk: false },
      ],
    },
    {
      name: "audit_log",
      classification: "audit",
      confidence: 0.93,
      source: "heuristic",
      graphRole: "Skip",
      columns: [
        { name: "log_id", type: "BIGINT", pk: true, fk: false },
        { name: "table_name", type: "VARCHAR(100)", pk: false, fk: false },
        { name: "action", type: "VARCHAR(20)", pk: false, fk: false },
        { name: "old_value", type: "JSON", pk: false, fk: false },
        { name: "new_value", type: "JSON", pk: false, fk: false },
        { name: "changed_by", type: "INT", pk: false, fk: true, ref: "customers.customer_id" },
        { name: "changed_at", type: "TIMESTAMP", pk: false, fk: false },
      ],
    },
    {
      name: "branches",
      classification: "entity",
      confidence: 0.91,
      source: "heuristic",
      graphRole: "Node",
      columns: [
        { name: "branch_id", type: "INT", pk: true, fk: false },
        { name: "branch_name", type: "VARCHAR(100)", pk: false, fk: false },
        { name: "address", type: "TEXT", pk: false, fk: false },
        { name: "city", type: "VARCHAR(50)", pk: false, fk: false },
        { name: "manager_id", type: "INT", pk: false, fk: true, ref: "customers.customer_id" },
      ],
    },
    {
      name: "loans",
      classification: "entity",
      confidence: 0.90,
      source: "slm",
      graphRole: "Node",
      columns: [
        { name: "loan_id", type: "INT", pk: true, fk: false },
        { name: "customer_id", type: "INT", pk: false, fk: true, ref: "customers.customer_id" },
        { name: "amount", type: "DECIMAL(15,2)", pk: false, fk: false },
        { name: "interest_rate", type: "DECIMAL(5,2)", pk: false, fk: false },
        { name: "start_date", type: "DATE", pk: false, fk: false },
        { name: "end_date", type: "DATE", pk: false, fk: false },
        { name: "status", type: "VARCHAR(20)", pk: false, fk: false },
      ],
    },
  ],
};

export const SAMPLE_GRAPH_DATA = {
  nodes: [
    { id: "Customer", label: "Customer", x: 150, y: 200, source_table: "customers", properties: ["first_name", "last_name", "email", "phone"], domain_mapping: "FIBO:Customer" },
    { id: "Account", label: "Account", x: 450, y: 150, source_table: "accounts", properties: ["balance", "currency", "opened_date", "status"], domain_mapping: "FIBO:Account" },
    { id: "Transaction", label: "Transaction", x: 450, y: 350, source_table: "transactions", properties: ["amount", "txn_type", "txn_date", "description"], domain_mapping: "FIBO:FinancialTransaction" },
    { id: "Branch", label: "Branch", x: 150, y: 450, source_table: "branches", properties: ["branch_name", "address", "city"], domain_mapping: null },
    { id: "Loan", label: "Loan", x: 700, y: 280, source_table: "loans", properties: ["amount", "interest_rate", "start_date", "end_date", "status"], domain_mapping: "FIBO:Loan" },
  ],
  edges: [
    { id: "e1", from: "Customer", to: "Account", type: "OWNS", cardinality: "1:N", source_fk: "accounts.customer_id", properties: ["role", "added_date"] },
    { id: "e2", from: "Account", to: "Transaction", type: "HAS_TRANSACTION", cardinality: "1:N", source_fk: "transactions.from_account_id", properties: [] },
    { id: "e3", from: "Transaction", to: "Account", type: "CREDITS", cardinality: "N:1", source_fk: "transactions.to_account_id", properties: [] },
    { id: "e4", from: "Customer", to: "Branch", type: "MANAGES", cardinality: "1:1", source_fk: "branches.manager_id", properties: [] },
    { id: "e5", from: "Customer", to: "Loan", type: "HAS_LOAN", cardinality: "1:N", source_fk: "loans.customer_id", properties: [] },
  ],
};

export const SAMPLE_DOMAIN_DETECTION = {
  primary: { name: "Finance / Banking", confidence: 87, standard: "FIBO" },
  alternatives: [
    { name: "Insurance", confidence: 34, standard: "ACORD" },
    { name: "General Enterprise", confidence: 22, standard: "Schema.org" },
  ],
  signals: {
    table_hits: ["accounts", "transactions", "loans", "branches"],
    column_hits: ["balance", "currency", "interest_rate", "txn_type", "account_type_id"],
  },
  seed_mappings: [
    { erd: "customers", ontology: "FIBO:Customer", confidence: 0.92 },
    { erd: "accounts", ontology: "FIBO:Account", confidence: 0.95 },
    { erd: "transactions", ontology: "FIBO:FinancialTransaction", confidence: 0.88 },
    { erd: "loans", ontology: "FIBO:Loan", confidence: 0.91 },
  ],
};

export const SAMPLE_SEMANTIC_IR = {
  nodes: [
    {
      id: "Customer",
      label: "Customer",
      source_table: "customers",
      properties: [
        { name: "first_name", type: "string", source_column: "first_name" },
        { name: "last_name", type: "string", source_column: "last_name" },
        { name: "email", type: "string", source_column: "email" },
        { name: "phone", type: "string", source_column: "phone" },
      ],
      domain_mapping: { standard: "FIBO", concept: "Customer", confidence: 0.92 },
    },
    {
      id: "Account",
      label: "Account",
      source_table: "accounts",
      properties: [
        { name: "balance", type: "decimal", source_column: "balance" },
        { name: "currency", type: "string", source_column: "currency" },
        { name: "opened_date", type: "date", source_column: "opened_date" },
        { name: "status", type: "string", source_column: "status" },
      ],
      domain_mapping: { standard: "FIBO", concept: "Account", confidence: 0.95 },
    },
    {
      id: "Transaction",
      label: "Transaction",
      source_table: "transactions",
      properties: [
        { name: "amount", type: "decimal", source_column: "amount" },
        { name: "txn_type", type: "string", source_column: "txn_type" },
        { name: "txn_date", type: "datetime", source_column: "txn_date" },
        { name: "description", type: "string", source_column: "description" },
      ],
      domain_mapping: { standard: "FIBO", concept: "FinancialTransaction", confidence: 0.88 },
    },
    {
      id: "Branch",
      label: "Branch",
      source_table: "branches",
      properties: [
        { name: "branch_name", type: "string", source_column: "branch_name" },
        { name: "address", type: "string", source_column: "address" },
        { name: "city", type: "string", source_column: "city" },
      ],
      domain_mapping: null,
    },
    {
      id: "Loan",
      label: "Loan",
      source_table: "loans",
      properties: [
        { name: "amount", type: "decimal", source_column: "amount" },
        { name: "interest_rate", type: "decimal", source_column: "interest_rate" },
        { name: "start_date", type: "date", source_column: "start_date" },
        { name: "end_date", type: "date", source_column: "end_date" },
        { name: "status", type: "string", source_column: "status" },
      ],
      domain_mapping: { standard: "FIBO", concept: "Loan", confidence: 0.91 },
    },
  ],
  edges: [
    { id: "e1", type: "OWNS", from: "Customer", to: "Account", cardinality: "1:N", source_fk: "accounts.customer_id", properties: [{ name: "role", type: "string" }, { name: "added_date", type: "date" }] },
    { id: "e2", type: "HAS_TRANSACTION", from: "Account", to: "Transaction", cardinality: "1:N", source_fk: "transactions.from_account_id", properties: [] },
    { id: "e3", type: "CREDITS", from: "Transaction", to: "Account", cardinality: "N:1", source_fk: "transactions.to_account_id", properties: [] },
    { id: "e4", type: "MANAGES", from: "Customer", to: "Branch", cardinality: "1:1", source_fk: "branches.manager_id", properties: [] },
    { id: "e5", type: "HAS_LOAN", from: "Customer", to: "Loan", cardinality: "1:N", source_fk: "loans.customer_id", properties: [] },
  ],
  statistics: { nodes: 5, edges: 5, properties: 22, domain_mappings: 4 },
};

export const SAMPLE_TRACE_MAP = [
  { erd_table: "customers", semantic_ir: "Customer (Node)", graph_element: ":Customer", conversion_type: "direct" },
  { erd_table: "accounts", semantic_ir: "Account (Node)", graph_element: ":Account", conversion_type: "direct" },
  { erd_table: "transactions", semantic_ir: "Transaction (Node)", graph_element: ":Transaction", conversion_type: "slm_enriched" },
  { erd_table: "customer_accounts", semantic_ir: "OWNS (Edge)", graph_element: "[:OWNS]", conversion_type: "junction_merge" },
  { erd_table: "account_types", semantic_ir: "— (Skipped)", graph_element: "— (Lookup)", conversion_type: "direct" },
  { erd_table: "audit_log", semantic_ir: "— (Skipped)", graph_element: "— (Audit)", conversion_type: "direct" },
  { erd_table: "branches", semantic_ir: "Branch (Node)", graph_element: ":Branch", conversion_type: "direct" },
  { erd_table: "loans", semantic_ir: "Loan (Node)", graph_element: ":Loan", conversion_type: "slm_enriched" },
];

export const SAMPLE_CYPHER = `// Node creation
CREATE (:Customer {first_name: $first_name, last_name: $last_name, email: $email, phone: $phone});
CREATE (:Account {balance: $balance, currency: $currency, opened_date: $opened_date, status: $status});
CREATE (:Transaction {amount: $amount, txn_type: $txn_type, txn_date: $txn_date, description: $description});
CREATE (:Branch {branch_name: $branch_name, address: $address, city: $city});
CREATE (:Loan {amount: $amount, interest_rate: $interest_rate, start_date: $start_date, end_date: $end_date, status: $status});

// Relationship creation
MATCH (c:Customer), (a:Account) WHERE c.customer_id = a.customer_id
CREATE (c)-[:OWNS {role: $role, added_date: $added_date}]->(a);

MATCH (a:Account), (t:Transaction) WHERE a.account_id = t.from_account_id
CREATE (a)-[:HAS_TRANSACTION]->(t);

MATCH (t:Transaction), (a:Account) WHERE t.to_account_id = a.account_id
CREATE (t)-[:CREDITS]->(a);

MATCH (c:Customer), (b:Branch) WHERE c.customer_id = b.manager_id
CREATE (c)-[:MANAGES]->(b);

MATCH (c:Customer), (l:Loan) WHERE c.customer_id = l.customer_id
CREATE (c)-[:HAS_LOAN]->(l);

// Index creation
CREATE INDEX customer_email_idx FOR (c:Customer) ON (c.email);
CREATE INDEX account_status_idx FOR (a:Account) ON (a.status);
CREATE INDEX txn_date_idx FOR (t:Transaction) ON (t.txn_date);`;

export const SAMPLE_PROJECTS = [
  { id: "p1", name: "Banking Core Schema", db_source: "postgresql", domain: "Finance / Banking", domain_confidence: 87, table_count: 8, node_count: 5, edge_count: 5, status: "converted", updated: "2026-04-15" },
  { id: "p2", name: "Healthcare EHR", db_source: "oracle", domain: "Healthcare", domain_confidence: 91, table_count: 14, node_count: 9, edge_count: 12, status: "analyzing", updated: "2026-04-14" },
  { id: "p3", name: "E-Commerce Platform", db_source: "mysql", domain: "Retail / E-Commerce", domain_confidence: 78, table_count: 22, node_count: 15, edge_count: 18, status: "draft", updated: "2026-04-10" },
];