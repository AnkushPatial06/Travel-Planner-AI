from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Dict
import json

from backend.database.connection import get_db
from backend.database.models import User, ChatRoom, ChatMessage
from backend.auth.utils import get_current_user, decode_access_token
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

# -- Schemas -------------------------------------------------------------------

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str

    class Config:
        from_attributes = True

class ChatRoomOut(BaseModel):
    id: int
    traveler: UserOut
    planner: UserOut
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ChatMessageOut(BaseModel):
    id: int
    room_id: int
    sender_id: int
    content: str
    created_at: datetime
    is_read: bool

    class Config:
        from_attributes = True

# -- WebSocket Manager ---------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        # Maps room_id -> list of active WebSocket connections
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: int):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: int):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast(self, room_id: int, message: dict):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

# -- Endpoints -----------------------------------------------------------------

@router.get("/rooms", response_model=List[ChatRoomOut])
def get_rooms(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all chat rooms for the current user."""
    role = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role == "traveler":
        rooms = db.query(ChatRoom).filter(ChatRoom.traveler_id == current_user.id).all()
    elif role in ["planner", "package_provider", "admin"]:
        rooms = db.query(ChatRoom).filter(
            or_(ChatRoom.planner_id == current_user.id, ChatRoom.traveler_id == current_user.id)
        ).all()
    else:
        rooms = []
    return rooms


@router.post("/rooms/start/{planner_id}", response_model=ChatRoomOut)
def start_or_get_room(planner_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get an existing chat room with a planner, or create one."""
    if current_user.id == planner_id:
        raise HTTPException(status_code=400, detail="Cannot chat with yourself.")
    
    room = db.query(ChatRoom).filter(
        ChatRoom.traveler_id == current_user.id,
        ChatRoom.planner_id == planner_id
    ).first()
    
    if not room:
        room = ChatRoom(traveler_id=current_user.id, planner_id=planner_id)
        db.add(room)
        db.commit()
        db.refresh(room)
        
    return room


@router.get("/rooms/{room_id}/messages", response_model=List[ChatMessageOut])
def get_room_messages(room_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetch all messages for a specific room."""
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found.")
    
    # Ensure current user is part of the room
    if current_user.id not in [room.traveler_id, room.planner_id]:
        raise HTTPException(status_code=403, detail="Not authorized to view this room.")
        
    messages = db.query(ChatMessage).filter(ChatMessage.room_id == room_id).order_by(ChatMessage.created_at.asc()).all()
    return messages


@router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: int, token: str, db: Session = Depends(get_db)):
    """WebSocket for real-time chat."""
    # 1. Authenticate user from query parameter token
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=1008)
            return
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user or not user.is_active:
            await websocket.close(code=1008)
            return
    except Exception:
        await websocket.close(code=1008)
        return

    # 2. Verify room exists and user is part of it
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not room or user.id not in [room.traveler_id, room.planner_id]:
        await websocket.close(code=1008)
        return

    # 3. Connect
    await manager.connect(websocket, room_id)
    
    try:
        while True:
            # 4. Wait for messages from this client
            data = await websocket.receive_text()
            
            # 5. Save message to DB
            new_msg = ChatMessage(
                room_id=room_id,
                sender_id=user.id,
                content=data
            )
            db.add(new_msg)
            
            # Also update rooms updated_at
            room.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(new_msg)
            
            # 6. Broadcast to room
            message_data = {
                "id": new_msg.id,
                "room_id": new_msg.room_id,
                "sender_id": new_msg.sender_id,
                "content": new_msg.content,
                "created_at": new_msg.created_at.isoformat(),
                "is_read": new_msg.is_read
            }
            await manager.broadcast(room_id, message_data)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)

