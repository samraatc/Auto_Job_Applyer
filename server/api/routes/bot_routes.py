from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from auth.legacy_admin_auth import require_admin
from bot.controller import (
    start_bot, stop_bot, get_status, log_generator,
)

router = APIRouter(prefix="/bot", tags=["bot"])

@router.post("/start")
def start_bot_endpoint(user: str = Depends(require_admin)):
    return start_bot()

@router.post("/stop")
def stop_bot_endpoint(user: str = Depends(require_admin)):
    return stop_bot()

@router.get("/status")
def status_endpoint():
    return get_status()

@router.get("/logs")
async def logs_endpoint(user: str = Depends(require_admin)):
    return StreamingResponse(log_generator(), media_type="text/event-stream")

