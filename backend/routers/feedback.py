from fastapi import APIRouter

from models.session_models import (
    FeedbackAnalyzeRequest,
    FeedbackAnalyzeResponse,
    FeedbackFollowupRequest,
    FeedbackFollowupResponse,
    FeedbackWithImageRequest,
)
from services.feedback_service import analyze_feedback, analyze_feedback_with_image, analyze_followup

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

@router.post("/analyze", response_model=FeedbackAnalyzeResponse)
def analyze_feedback_endpoint(request: FeedbackAnalyzeRequest):
    return analyze_feedback(request)


@router.post("/analyze-image", response_model=FeedbackAnalyzeResponse)
def analyze_feedback_with_image_endpoint(request: FeedbackWithImageRequest):
    return analyze_feedback_with_image(request)


@router.post("/followup", response_model=FeedbackFollowupResponse)
def followup_feedback_endpoint(request: FeedbackFollowupRequest):
    return analyze_followup(request)
