from fastapi import APIRouter

from models.session_models import (
    FeedbackAnalyzeRequest,
    FeedbackAnalyzeResponse,
    FeedbackFollowupRequest,
    FeedbackFollowupResponse,
)
from services.feedback_service import analyze_feedback, analyze_followup

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

@router.post("/analyze", response_model=FeedbackAnalyzeResponse)
def analyze_feedback_endpoint(request: FeedbackAnalyzeRequest):
    return analyze_feedback(request)


@router.post("/followup", response_model=FeedbackFollowupResponse)
def followup_feedback_endpoint(request: FeedbackFollowupRequest):
    return analyze_followup(request)
