from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.feedback import router as feedback_router
from routers.note import router as note_router
from routers.ocr import router as ocr_router
from routers.session import router as session_router
from routers.stt import router as stt_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(session_router)
app.include_router(ocr_router)
app.include_router(stt_router)
app.include_router(note_router)
app.include_router(feedback_router)
