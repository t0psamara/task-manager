from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
import os
from dotenv import load_dotenv

load_dotenv()

# Флаг отладки
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

# Базовый класс для моделей
Base = declarative_base()

if DEBUG:
    print("🔧 DEBUG MODE: Используется async SQLite база данных")
    
    # Async SQLite для разработки
    SQLITE_DATABASE_URL = "sqlite+aiosqlite:///./task_manager_debug.db"
    
    # Создание асинхронного движка для SQLite
    engine = create_async_engine(
        SQLITE_DATABASE_URL,
        echo=True,
        future=True
    )
    
    # Асинхронная сессия для SQLite
    AsyncSessionLocal = sessionmaker(
        engine, 
        class_=AsyncSession, 
        expire_on_commit=False
    )
    
    # Асинхронная зависимость для получения сессии БД
    async def get_db():
        async with AsyncSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    
    # Асинхронное создание таблиц для SQLite
    async def create_tables():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ SQLite таблицы созданы")
    
    # Для совместимости
    SessionLocal = None
    
else:
    print("🚀 PRODUCTION MODE: Используется PostgreSQL база данных")
    
    # PostgreSQL для продакшена (асинхронная)
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/task_manager")
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    
    # Создание асинхронного движка для PostgreSQL
    engine = create_async_engine(
        ASYNC_DATABASE_URL,
        echo=True,
        future=True
    )
    
    # Асинхронная сессия для PostgreSQL
    AsyncSessionLocal = sessionmaker(
        engine, 
        class_=AsyncSession, 
        expire_on_commit=False
    )
    
    # Асинхронная зависимость для получения сессии БД
    async def get_db():
        async with AsyncSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    
    # Асинхронное создание таблиц
    async def create_tables():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ PostgreSQL таблицы созданы")
    
    # Для совместимости с sync кодом
    SessionLocal = None
