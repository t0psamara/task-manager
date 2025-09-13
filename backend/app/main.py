from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict
import logging
from contextlib import asynccontextmanager

from . import models, schemas
from .database import engine, Base
from .routers import boards, features, sprints, tasks

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Менеджер WebSocket соединений
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, board_id: int):
        await websocket.accept()
        if board_id not in self.active_connections:
            self.active_connections[board_id] = []
        self.active_connections[board_id].append(websocket)
        logger.info(f"WebSocket подключен к доске {board_id}")

    def disconnect(self, websocket: WebSocket, board_id: int):
        if board_id in self.active_connections:
            self.active_connections[board_id].remove(websocket)
            if not self.active_connections[board_id]:
                del self.active_connections[board_id]
        logger.info(f"WebSocket отключен от доски {board_id}")

    async def send_to_board(self, message: str, board_id: int):
        """Отправка сообщения всем подключенным к доске"""
        if board_id in self.active_connections:
            for connection in self.active_connections[board_id]:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logger.error(f"Ошибка отправки сообщения: {e}")


manager = ConnectionManager()


# Создание таблиц при запуске
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Создание таблиц в зависимости от режима
    from .database import DEBUG, create_tables
    
    # Теперь обе БД используют async интерфейс
    await create_tables()
    
    if DEBUG:
        logger.info("🔧 DEBUG: async SQLite база данных инициализирована")
    else:
        logger.info("🚀 PRODUCTION: PostgreSQL база данных инициализирована")
    
    yield
    # Очистка при завершении
    logger.info("Приложение завершает работу")


# Создание FastAPI приложения
app = FastAPI(
    title="Task Manager API",
    description="API для интерактивной доски планирования",
    version="1.0.0",
    lifespan=lifespan
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(boards.router, prefix="/api")
app.include_router(features.router, prefix="/api")
app.include_router(sprints.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")


# Основные endpoints
@app.get("/")
async def root():
    return {"message": "Task Manager API"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/info")
async def get_info():
    """Информация о конфигурации приложения"""
    from .database import DEBUG
    import os
    
    return {
        "app_name": "Task Manager API",
        "version": "1.0.0",
        "debug_mode": DEBUG,
        "database_type": "SQLite (aiosqlite)" if DEBUG else "PostgreSQL (asyncpg)",
        "database_file": "./task_manager_debug.db" if DEBUG else "PostgreSQL connection",
        "env_debug": os.getenv("DEBUG", "False"),
        "features": [
            "Real-time WebSocket",
            "Drag-and-drop планирование", 
            "Автоматический расчет емкости",
            "Undo/Redo функциональность",
            "Копирование/вставка задач"
        ]
    }


@app.get("/test-db")
async def test_database():
    """Тестовый endpoint для проверки БД"""
    try:
        from .database import get_db
        db_gen = get_db()
        db = await db_gen.__anext__()
        
        # Простой тест подключения
        from sqlalchemy import text
        result = await db.execute(text("SELECT 1"))
        row = result.fetchone()
        
        return {"status": "database_ok", "test_result": row[0] if row else None}
    except Exception as e:
        return {"status": "database_error", "error": str(e)}


@app.get("/test-create-board")  
async def test_create_board():
    """Тестовый endpoint для создания доски"""
    try:
        from .database import get_db
        from . import models
        
        db_gen = get_db()
        db = await db_gen.__anext__()
        
        # Создаем доску напрямую
        board = models.Board(name="Test Board")
        db.add(board)
        await db.flush()
        await db.refresh(board)
        
        return {"status": "board_created", "board_id": board.id, "board_name": board.name}
    except Exception as e:
        return {"status": "board_creation_error", "error": str(e)}




# WebSocket endpoint
@app.websocket("/ws/{board_id}")
async def websocket_endpoint(websocket: WebSocket, board_id: int):
    """WebSocket для real-time обновлений"""
    await manager.connect(websocket, board_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Эхо для тестирования соединения
            await websocket.send_text(f"Получено: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket, board_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
