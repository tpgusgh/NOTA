from pydantic import BaseModel, Field
from typing import List, Optional


class SessionCreateRequest(BaseModel):
    title: str
    goals: str
    keywords: List[str]
    emphasis: str


class SessionCreateResponse(BaseModel):
    session_id: str


class SessionJoinRequest(BaseModel):
    session_id: str


class SessionJoinResponse(BaseModel):
    session_id: str

class SessionJoinResponse(BaseModel):
    session_id: str
    title: str
    goals: str


class SessionInfoResponse(BaseModel):
    session_id: str
    title: str
    goals: str
    keywords: List[str]
    emphasis: str
    ocr_history: List[str] = Field(default_factory=list)
    stt_history: List[str] = Field(default_factory=list)
    generated_note: Optional[str] = None
    approved_note: Optional[str] = None
    public_note: Optional[str] = None

class OcrAnalyzeRequest(BaseModel):
    image_base64: str
    session_id: str


class OcrAnalyzeResponse(BaseModel):
    text: str


class SttSaveRequest(BaseModel):
    text: str
    session_id: str


class SttSaveResponse(BaseModel):
    saved_text: str


class NoteGenerateRequest(BaseModel):
    session_id: str


class NoteGenerateResponse(BaseModel):
    note: str


class NoteApproveRequest(BaseModel):
    session_id: str
    note: str


class NoteApproveResponse(BaseModel):
    approved: bool


class NoteShareRequest(BaseModel):
    session_id: str


class NoteShareResponse(BaseModel):
    public_note: str


class PublicNoteResponse(BaseModel):
    public_note: str


class FeedbackAnalyzeRequest(BaseModel):
    session_id: str
    student_note: str


class FeedbackAnalyzeResponse(BaseModel):
    missing: str
    suggestions: str
    positives: str
    raw_feedback: str


class FeedbackFollowupRequest(BaseModel):
    session_id: str
    question: str
    student_note: Optional[str] = None


class FeedbackFollowupResponse(BaseModel):
    answer: str


class SessionData(BaseModel):
    session_id: str
    title: str
    goals: str
    keywords: List[str]
    emphasis: str
    ocr_history: List[str] = Field(default_factory=list)
    stt_history: List[str] = Field(default_factory=list)
    generated_note: Optional[str] = None
    approved_note: Optional[str] = None
    public_note: Optional[str] = None
