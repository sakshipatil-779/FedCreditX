"""
Pydantic Schemas for FedCreditX API.
Adheres to STEP 3, STEP 4, STEP 6, and STEP 7 requirements.
Supports Decision Tree risk scoring, human review, and model override logging.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    python_version: str
    partitions_found: Dict[str, bool]
    model_artifact_present: bool
    active_scoring_engine: str = "DecisionTreeClassifier"


class FeatureVectorSchema(BaseModel):
    monthly_income_band_value: float = Field(..., ge=1000.0, le=50000.0)
    debt_to_income_ratio: float = Field(..., ge=0.01, le=1.50)
    late_payment_count_12m: int = Field(..., ge=0, le=12)
    credit_utilization_ratio: float = Field(..., ge=0.0, le=1.50)
    income_variability: float = Field(..., ge=0.0, le=1.0)
    loan_amount_to_income: float = Field(..., ge=0.10, le=15.0)
    account_history_months: int = Field(..., ge=1, le=360)
    utility_payment_consistency: float = Field(..., ge=0.0, le=1.0)


class DemoCaseSummary(BaseModel):
    case_id: str
    lender_id: str
    features: Dict[str, float]
    ground_truth_default: Optional[int] = None
    expected_risk_level: Optional[str] = None
    notes: Optional[str] = None


class ReasonDetail(BaseModel):
    feature: str
    feature_label: str
    direction: str  # "increases_risk" or "decreases_risk"
    value: float
    threshold: Optional[float] = 0.0
    impact_delta: Optional[float] = 0.0
    shap_value: Optional[float] = None
    impact: str
    condition: str
    readable_reason: str


class ScoringResponse(BaseModel):
    case_id: str
    lender_id: str
    model_type: str = "FL + DP Logistic Regression (Primary)"
    model_version: str
    default_probability_estimate: float
    percentage_display: str
    risk_level: str  # "Low", "Medium", "High"
    demo_risk_band: str = ""
    risk_band_description: str = ""
    badge_color: str  # "green", "amber", "red"
    system_recommendation: str  # "Auto-approve recommendation", "Send to human review", "Flag high risk"
    required_handling: str = "Standard handling"
    review_status: Optional[str] = "Pending Review"
    final_decision: Optional[str] = None
    top_reasons: List[ReasonDetail]
    attributions: List[Dict[str, Any]] = []
    baseline_comparison: Optional[Dict[str, Any]] = None
    features: Dict[str, float]
    timestamp: str
    calibration_caveat: str


class ApprovalSubmissionRequest(BaseModel):
    case_id: str
    lender_id: str
    applicant_name: Optional[str] = None
    risk_score: float
    risk_band: str
    submitted_by: str
    officer_notes: Optional[str] = None
    override_reason: Optional[str] = None


class SeniorDecisionRequest(BaseModel):
    action: str  # "approve" or "reject"
    senior_officer_id: str
    senior_comments: Optional[str] = None


class OfficerDecisionRequest(BaseModel):
    officer_action: str  # "approve", "reject", "send_to_review"
    officer_id: str = "officer_demo"
    override_reason: Optional[str] = None
    notes: Optional[str] = None


class OfficerDecisionResponse(BaseModel):
    audit_event_id: str
    case_id: str
    lender_id: str
    officer_id: str
    action: str
    system_recommendation: str
    final_decision: str
    is_override: bool
    override_reason: Optional[str] = None
    review_status: str
    timestamp: str
    status: str
    message: str


# Backward-compatible ReviewRequest
class ReviewRequest(BaseModel):
    review_status: str  # "reviewed", "need_more_information", "escalate_human_review", "approved", "rejected"
    reviewer_label: str = "demo_risk_analyst"
    note_code: str = "STD_REVIEW_ACK"
    override_reason: Optional[str] = None


class ReviewResponse(BaseModel):
    audit_event_id: str
    case_id: str
    review_status: str
    timestamp: str
    message: str


class AuditEvent(BaseModel):
    id: str
    timestamp: str
    event_type: str
    actor_type: str
    entity_id: str
    status: str
    safe_metadata: Dict[str, Any]


class RoleSelectionRequest(BaseModel):
    id_token: str
    requested_role: str


class RoleSelectionResponse(BaseModel):
    status: str
    session_token: str
    email: str
    role: str
    expires_at: str

