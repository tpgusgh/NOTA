from pydantic import BaseModel, Field
from typing import List, Optional


class SectionData(BaseModel):
    index: int
    started_at: str
    ended_at: str
    name: Optional[str] = None
    lesson_plan: Optional[str] = None
    ocr_history: List[str] = Field(default_factory=list)
    stt_history: List[str] = Field(default_factory=list)
    board_snapshot: Optional[str] = None
    generated_note: Optional[str] = None


class SectionListItem(BaseModel):
    index: int
    started_at: str
    ended_at: str
    name: Optional[str] = None
    lesson_plan: Optional[str] = None
    has_summary: bool
    ocr_count: int
    stt_count: int


class StartClassRequest(BaseModel):
    lesson_plan: Optional[str] = None


class StopClassRequest(BaseModel):
    section_name: Optional[str] = None


class SectionSummaryRequest(BaseModel):
    session_id: str
    section_index: int


class FeedbackWithImageRequest(BaseModel):
    session_id: str
    student_note: str
    image_base64: Optional[str] = None
    section_index: Optional[int] = None


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
    title: str
    goals: str


class SessionInfoResponse(BaseModel):
    session_id: str
    title: str
    goals: str
    keywords: List[str]
    emphasis: str
    is_class_active: bool = False
    class_started_at: Optional[str] = None
    is_board_shared: bool = False
    board_data_url: Optional[str] = None
    board_updated_at: Optional[str] = None
    latest_ocr_text: Optional[str] = None
    ocr_history: List[str] = Field(default_factory=list)
    stt_history: List[str] = Field(default_factory=list)
    generated_note: Optional[str] = None
    approved_note: Optional[str] = None
    public_note: Optional[str] = None
    sections: List[SectionListItem] = Field(default_factory=list)

class OcrAnalyzeRequest(BaseModel):
    image_base64: str
    session_id: str


class OcrExtractRequest(BaseModel):
    image_base64: str


class OcrAnalyzeResponse(BaseModel):
    text: str


class SttSaveRequest(BaseModel):
    text: str
    session_id: str


class SttSaveResponse(BaseModel):
    saved_text: str


class BoardUpdateRequest(BaseModel):
    session_id: str
    board_data_url: str


class BoardUpdateResponse(BaseModel):
    board_data_url: Optional[str] = None
    board_updated_at: Optional[str] = None


class BoardStateResponse(BaseModel):
    board_data_url: Optional[str] = None
    board_updated_at: Optional[str] = None
    latest_ocr_text: Optional[str] = None


class ClassStateResponse(BaseModel):
    is_class_active: bool
    class_started_at: Optional[str] = None


class ShareStateResponse(BaseModel):
    is_board_shared: bool


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
    section_index: Optional[int] = None


class FeedbackFollowupResponse(BaseModel):
    answer: str


class SessionData(BaseModel):
    session_id: str
    title: str
    goals: str
    keywords: List[str]
    emphasis: str
    is_class_active: bool = False
    class_started_at: Optional[str] = None
    is_board_shared: bool = False
    board_data_url: Optional[str] = None
    board_updated_at: Optional[str] = None
    latest_ocr_text: Optional[str] = None
    last_ocr_image_hash: Optional[str] = None
    ocr_history: List[str] = Field(default_factory=list)
    stt_history: List[str] = Field(default_factory=list)
    generated_note: Optional[str] = None
    approved_note: Optional[str] = None
    public_note: Optional[str] = None
    sections: List[SectionData] = Field(default_factory=list)
    current_section_ocr_start: int = 0
    current_section_stt_start: int = 0
    current_lesson_plan: Optional[str] = None
