from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import uuid


class User(Base):
    """Модель пользователя с OAuth авторизацией"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    avatar_url = Column(Text, default="")
    
    # OAuth поля
    oauth_provider = Column(String(50), nullable=False)  # "google" или "yandex"
    oauth_id = Column(String(255), nullable=False)  # ID от провайдера
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), default=func.now())
    
    # Связи
    boards = relationship("Board", back_populates="owner", cascade="all, delete-orphan")


class Board(Base):
    """Модель доски планирования"""
    __tablename__ = "boards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    
    # Авторизация и доступ
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    unique_link = Column(String(36), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Связи
    owner = relationship("User", back_populates="boards")
    sprints = relationship("Sprint", back_populates="board", cascade="all, delete-orphan")
    features = relationship("Feature", back_populates="board", cascade="all, delete-orphan")
    history = relationship("History", back_populates="board", cascade="all, delete-orphan")


class Sprint(Base):
    """Модель спринта с емкостью по командам и дополнительными полями"""
    __tablename__ = "sprints"

    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(Integer, ForeignKey("boards.id"), nullable=False)
    number = Column(Integer, nullable=False)  # Номер спринта
    capacity_ios = Column(Float, default=0.0)  # Емкость iOS команды
    capacity_android = Column(Float, default=0.0)  # Емкость Android команды  
    capacity_qa = Column(Float, default=0.0)  # Емкость QA команды
    capacity_sa = Column(Float, default=0.0)  # Емкость SA команды
    
    # Дополнительные поля
    description = Column(String(255), default="")  # Описание под названием спринта
    badge1_text = Column(String(50), default="")  # Текст первого бейджа
    badge1_color = Column(String(10), default="blue")  # Цвет первого бейджа (blue/red)
    badge1_tooltip = Column(Text, default="")  # Подсказка первого бейджа (3 строки)
    badge2_text = Column(String(50), default="")  # Текст второго бейджа
    badge2_color = Column(String(10), default="blue")  # Цвет второго бейджа (blue/red)
    badge2_tooltip = Column(Text, default="")  # Подсказка второго бейджа (3 строки)
    
    # Связи
    board = relationship("Board", back_populates="sprints")
    tasks = relationship("Task", back_populates="sprint", cascade="all, delete-orphan")


class Feature(Base):
    """Модель фичи (строка в таблице)"""
    __tablename__ = "features"

    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(Integer, ForeignKey("boards.id"), nullable=False)
    name = Column(String(255), nullable=False)
    order = Column(Integer, default=0)  # Порядок отображения
    
    # Метаданные фичи
    mgmt_link = Column(Text, default="")  # Ссылка на МГМТ
    mgmt_title = Column(String(100), default="МГМТ")  # Название ссылки МГМТ
    epic_link = Column(Text, default="")  # Ссылка на Эпик
    epic_title = Column(String(100), default="Эпик")  # Название ссылки Эпик
    project_code = Column(String(5), default="")  # Код проекта (до 5 символов)
    
    # Связи
    board = relationship("Board", back_populates="features")
    tasks = relationship("Task", back_populates="feature", cascade="all, delete-orphan")


class Task(Base):
    """Модель задачи/стикера"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    feature_id = Column(Integer, ForeignKey("features.id"), nullable=False)
    sprint_id = Column(Integer, ForeignKey("sprints.id"), nullable=True)  # Может быть не назначена
    
    name = Column(String(255), nullable=False)
    
    # Оценки по командам
    estimate_ios = Column(Float, default=0.0)
    estimate_android = Column(Float, default=0.0)
    estimate_qa = Column(Float, default=0.0)
    estimate_sa = Column(Float, default=0.0)
    
    # Позиция в ячейке (для множественных стикеров в одной ячейке)
    position_x = Column(Float, default=0.0)
    position_y = Column(Float, default=0.0)
    
    # Цвет стикера
    color = Column(String(7), default="#ffeb3b")  # Hex цвет
    
    # Дополнительные поля
    enabler_title = Column(String(100), default="")  # Заголовок энейблера
    enabler_active = Column(Boolean, default=True)  # Всегда активен
    is_collapsed_feature = Column(Boolean, default=False)  # Свернутая фича в backlog
    original_feature_tasks = Column(JSON, default=None)  # Оригинальные тикеты фичи (для восстановления)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    feature = relationship("Feature", back_populates="tasks")
    sprint = relationship("Sprint", back_populates="tasks")


class History(Base):
    """Модель истории изменений для отката (undo/redo)"""
    __tablename__ = "history"

    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(Integer, ForeignKey("boards.id"), nullable=False)
    action_type = Column(String(50), nullable=False)  # create, update, delete, move
    data = Column(JSON)  # Данные об изменении в JSON формате
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # Связи
    board = relationship("Board", back_populates="history")


class UserActivityLog(Base):
    """Модель для логирования действий пользователей"""
    __tablename__ = "user_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    board_id = Column(Integer, ForeignKey("boards.id"), nullable=True)  # Может быть не связано с доской
    
    action = Column(String(100), nullable=False)  # Тип действия
    entity_type = Column(String(50), nullable=True)  # board, feature, task, sprint
    entity_id = Column(Integer, nullable=True)  # ID сущности
    entity_name = Column(String(255), nullable=True)  # Название сущности для читаемости
    
    details = Column(JSON, default=None)  # Дополнительные детали действия
    ip_address = Column(String(45), nullable=True)  # IP адрес пользователя
    user_agent = Column(Text, nullable=True)  # User Agent браузера
    
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # Связи
    user = relationship("User")
    board = relationship("Board")
