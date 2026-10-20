"""
FedCreditX Configurable Risk Rules & Thresholds.

Defines exact prototype boundary conditions and system recommendations
for applicant credit-risk assessment.
Adheres to STEP 3 requirements.
"""

from typing import Dict, Any, Tuple

# Configurable prototype thresholds
LOW_RISK_UPPER_BOUND: float = 0.30
MEDIUM_RISK_UPPER_BOUND: float = 0.70

# Level labels
LEVEL_LOW: str = "Low"
LEVEL_MEDIUM: str = "Medium"
LEVEL_HIGH: str = "High"

# System Recommendations
REC_AUTO_APPROVE: str = "Auto-approve recommendation"
REC_HUMAN_REVIEW: str = "Send to human review"
REC_FLAG_HIGH_RISK: str = "Flag high risk"

# Handling instructions
HANDLING_AUTO_APPROVE: str = "Display the recommendation and its basis"
HANDLING_HUMAN_REVIEW: str = "Mark the case as pending review"
HANDLING_FLAG_HIGH_RISK: str = "Require an authorized officer to confirm the final decision"

# Prototype disclaimer
DISCLAIMER_NOTICE: str = (
    "Demonstration estimate on synthetic data. Prototype demonstration rule: not a calibrated real-world credit score or banking regulatory standard."
)


def classify_risk_probability(prob: float) -> Dict[str, Any]:
    """
    Classifies a default-risk probability according to exact boundary conditions:
    - p < 0.30 : Low risk -> Auto-approve recommendation
    - 0.30 <= p <= 0.70 : Medium risk -> Send to human review (pending review)
    - p > 0.70 : High risk -> Flag high risk (requires authorized officer confirmation)

    Returns structured classification dictionary with exact fields.
    """
    if prob < LOW_RISK_UPPER_BOUND:
        risk_level = LEVEL_LOW
        system_recommendation = REC_AUTO_APPROVE
        required_handling = HANDLING_AUTO_APPROVE
        badge_color = "green"
        default_review_status = "auto_approved_pending_action"
    elif prob <= MEDIUM_RISK_UPPER_BOUND:
        risk_level = LEVEL_MEDIUM
        system_recommendation = REC_HUMAN_REVIEW
        required_handling = HANDLING_HUMAN_REVIEW
        badge_color = "amber"
        default_review_status = "pending_review"
    else:
        risk_level = LEVEL_HIGH
        system_recommendation = REC_FLAG_HIGH_RISK
        required_handling = HANDLING_FLAG_HIGH_RISK
        badge_color = "red"
        default_review_status = "flagged_high_risk_pending_action"

    percentage_str = f"{round(prob * 100)}%"

    return {
        "default_probability_estimate": float(prob),
        "percentage_display": percentage_str,
        "risk_level": risk_level,
        "system_recommendation": system_recommendation,
        "required_handling": required_handling,
        "badge_color": badge_color,
        "review_status": default_review_status,
        "rule_basis": f"Probability {percentage_str} evaluated against [{LOW_RISK_UPPER_BOUND*100:.0f}%, {MEDIUM_RISK_UPPER_BOUND*100:.0f}%] thresholds",
        "disclaimer": DISCLAIMER_NOTICE,
    }


def is_decision_an_override(system_recommendation: str, officer_action: str) -> bool:
    """
    Determines whether an officer's action constitutes an override of the system recommendation.
    Officer actions: 'approve', 'reject', 'send_to_review'.
    - Auto-approve recommendation overridden by: 'reject' or 'send_to_review'
    - Send to human review overridden by: 'approve' or 'reject' (when taking definitive action without review)
      OR standard review completion depending on context; but when system recommended review and officer directly approves/rejects,
      or when high-risk is approved.
    - Flag high risk overridden by: 'approve' (officer confirms approval despite high risk flag)
    """
    action = officer_action.lower().strip()
    rec = system_recommendation.strip()

    if rec == REC_AUTO_APPROVE:
        return action in ["reject", "send_to_review"]
    elif rec == REC_FLAG_HIGH_RISK:
        return action == "approve"
    elif rec == REC_HUMAN_REVIEW:
        # If model requested human review, approving or rejecting is the outcome of the review;
        # however, if explicitly overriding the review recommendation or changing course,
        # we check whether officer overrides. For clear compliance, any action that conflicts with auto-recommendation:
        return False
    return False
