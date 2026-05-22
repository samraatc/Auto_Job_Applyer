from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from auth.auth_handler import get_current_user_id
import asyncio
import os

router = APIRouter(prefix="/ws", tags=["websockets"])

@router.websocket("/logs")
async def websocket_logs(websocket: WebSocket):
    await websocket.accept()
    # For a real implementation, you might pass token in query params or headers
    # user_id = await get_current_user_id(...)
    # For now, we will just expect the first message to be authentication
    try:
        auth_msg = await websocket.receive_json()
        token = auth_msg.get("token")
        if not token:
            await websocket.close(code=1008)
            return
            
        from auth.auth_handler import settings, jwt, JWTError
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
            user_id = payload.get("sub")
            if not user_id:
                raise ValueError("Invalid token")
        except (JWTError, ValueError):
            await websocket.close(code=1008)
            return

        # Authenticated. Subscribe to redis pub/sub
        import redis.asyncio as redis
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        r = redis.from_url(redis_url)
        pubsub = r.pubsub()
        # Listen to bot and feed logs
        await pubsub.subscribe(f"logs:{user_id}:bot", f"logs:{user_id}:feed")
        
        async def reader(channel):
            async for message in channel.listen():
                if message["type"] == "message":
                    data = message["data"].decode("utf-8")
                    channel_name = message["channel"].decode("utf-8")
                    await websocket.send_json({"channel": channel_name, "log": data})

        task = asyncio.create_task(reader(pubsub))
        
        try:
            while True:
                # Keep connection alive, wait for client disconnect
                await websocket.receive_text()
        except WebSocketDisconnect:
            task.cancel()
            await pubsub.unsubscribe()
            await r.aclose()
            
    except Exception as e:
        await websocket.close()
