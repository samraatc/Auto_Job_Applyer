"""
API router — aggregates all route modules.
Add new route modules here.
"""
from fastapi import APIRouter
from api.routes.auth_routes import router as auth_router
from api.routes.settings_routes import router as settings_router
from api.routes.bot_routes import router as bot_router
from api.routes.websocket_routes import router as ws_router
from api.routes.logs_routes import router as logs_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(settings_router)
api_router.include_router(bot_router)
api_router.include_router(ws_router)
api_router.include_router(logs_router)
