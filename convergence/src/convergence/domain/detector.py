"""Domain auto-detection."""

from dataclasses import dataclass, field
from convergence.core.schema_ir import SchemaIR


@dataclass
class DomainProfile:
    """Profile for a domain with keywords and ontology reference."""
    name: str
    ontology_ref: str
    table_keywords: list[str] = field(default_factory=list)
    column_keywords: list[str] = field(default_factory=list)
    seed_mappings: dict = field(default_factory=dict)


class DomainDetector:
    """Auto-detect domain from schema."""

    PROFILES = {
        "finance": DomainProfile(
            name="finance",
            ontology_ref="FIBO",
            table_keywords=[
                "account", "customer", "transaction", "loan", "branch",
                "payment", "deposit", "credit", "debit", "ledger",
                "portfolio", "fund", "securities", "insurance", "mortgage",
                "interest", "balance", "currency", "exchange", "transfer"
            ],
            column_keywords=[
                "balance", "amount", "currency", "interest_rate",
                "account_number", "routing_number", "swift_code", "iban",
                "credit_limit", "loan_amount", "maturity_date", "premium",
                "dividend", "yield", "nav"
            ],
            seed_mappings={
                "customers": "FIBO:Customer",
                "accounts": "FIBO:Account",
                "transactions": "FIBO:FinancialTransaction",
                "loans": "FIBO:Loan",
                "branches": "FIBO:Branch",
            }
        ),
        "healthcare": DomainProfile(
            name="healthcare",
            ontology_ref="HL7_FHIR",
            table_keywords=[
                "patient", "diagnosis", "prescription", "doctor",
                "appointment", "ward", "medication", "lab_result",
                "procedure", "insurance_claim"
            ],
            column_keywords=[
                "diagnosis_code", "icd_code", "npi", "dob",
                "blood_type", "dosage"
            ],
            seed_mappings={}
        ),
        "ecommerce": DomainProfile(
            name="ecommerce",
            ontology_ref="Schema.org",
            table_keywords=[
                "product", "order", "cart", "customer", "category",
                "review", "shipping", "payment", "inventory", "wishlist"
            ],
            column_keywords=[
                "price", "sku", "quantity", "discount",
                "shipping_cost", "rating"
            ],
            seed_mappings={}
        ),
        "generic": DomainProfile(
            name="generic",
            ontology_ref="Schema.org",
            table_keywords=[],
            column_keywords=[],
            seed_mappings={}
        ),
    }

    def detect(self, schema_ir: SchemaIR) -> tuple[str, float, dict]:
        """
        Detect domain from schema.

        Returns:
            (domain_name, confidence_0_to_1, signals_dict)
        """
        scores = {}
        signals = {}

        # Collect all table and column names
        table_names = [t.name.lower() for t in schema_ir.tables]
        column_names = []
        for table in schema_ir.tables:
            for col in table.columns:
                column_names.append(col.name.lower())

        # Score each profile
        for profile_name, profile in self.PROFILES.items():
            score = 0
            table_hits = []
            column_hits = []

            # Score table keyword hits (3 points each)
            for keyword in profile.table_keywords:
                for table_name in table_names:
                    if keyword.lower() in table_name:
                        score += 3
                        table_hits.append(table_name)
                        break

            # Score column keyword hits (2 points each)
            for keyword in profile.column_keywords:
                for col_name in column_names:
                    if keyword.lower() in col_name:
                        score += 2
                        column_hits.append(col_name)
                        break

            scores[profile_name] = score
            signals[profile_name] = {
                "table_hits": table_hits,
                "column_hits": column_hits,
                "score": score,
            }

        # Find top domain
        sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        top_domain, top_score = sorted_scores[0]
        second_score = sorted_scores[1][1] if len(sorted_scores) > 1 else 0

        # Check if we need SLM confirmation
        if top_score > 0:
            confidence = min(top_score / 30.0, 1.0)  # Normalize to 0-1
        else:
            confidence = 0.0
            top_domain = "generic"

        # Flag if top two scores are close
        if top_score - second_score < 5:
            signals["needs_slm_confirmation"] = True

        return top_domain, confidence, signals
