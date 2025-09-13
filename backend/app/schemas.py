from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


# Базовые схемы для Task (стикер)
class TaskBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    estimate_ios: float = Field(default=0.0, ge=0)
    estimate_android: float = Field(default=0.0, ge=0)
    estimate_qa: float = Field(default=0.0, ge=0)
    estimate_sa: float = Field(default=0.0, ge=0)
    position_x: float = Field(default=0.0)
    position_y: float = Field(default=0.0)
    color: str = Field(default="#ffeb3b", pattern=r"^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$")
    enabler_title: str = Field(default="", max_length=100)
    enabler_active: bool = Field(default=False)
    link_url: str = Field(default="", max_length=500)
    link_title: str = Field(default="", max_length=100)


class TaskCreate(TaskBase):
    feature_id: int
    sprint_id: Optional[int] = None


class TaskUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    estimate_ios: Optional[float] = Field(None, ge=0)
    estimate_android: Optional[float] = Field(None, ge=0)
    estimate_qa: Optional[float] = Field(None, ge=0)
    estimate_sa: Optional[float] = Field(None, ge=0)
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    color: Optional[str] = Field(None, pattern=r"^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$")
    sprint_id: Optional[int] = None
    feature_id: Optional[int] = None
    enabler_title: Optional[str] = Field(None, max_length=100)
    enabler_active: Optional[bool] = None
    link_url: Optional[str] = Field(None, max_length=500)
    link_title: Optional[str] = Field(None, max_length=100)


class Task(TaskBase):
    id: int
    feature_id: int
    sprint_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# Базовые схемы для Feature (фича/строка)
class FeatureBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    order: int = Field(default=0)
    mgmt_link: str = Field(default="", max_length=500)
    mgmt_title: str = Field(default="МГМТ", max_length=100)
    epic_link: str = Field(default="", max_length=500)
    epic_title: str = Field(default="Эпик", max_length=100)
    project_code: str = Field(default="", max_length=5)


class FeatureCreate(FeatureBase):
    board_id: int


class FeatureUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    order: Optional[int] = None
    mgmt_link: Optional[str] = Field(None, max_length=500)
    mgmt_title: Optional[str] = Field(None, max_length=100)
    epic_link: Optional[str] = Field(None, max_length=500)
    epic_title: Optional[str] = Field(None, max_length=100)
    project_code: Optional[str] = Field(None, max_length=5)


class Feature(FeatureBase):
    id: int
    board_id: int
    tasks: List[Task] = []

    model_config = {"from_attributes": True}


# Базовые схемы для Sprint
class SprintBase(BaseModel):
    number: int = Field(..., ge=1)
    capacity_ios: float = Field(default=0.0, ge=0)
    capacity_android: float = Field(default=0.0, ge=0)
    capacity_qa: float = Field(default=0.0, ge=0)
    capacity_sa: float = Field(default=0.0, ge=0)
    description: str = Field(default="", max_length=255)
    badge1_text: str = Field(default="", max_length=50)
    badge1_color: str = Field(default="blue", pattern=r"^(blue|red)$")
    badge1_tooltip: str = Field(default="", max_length=500)
    badge2_text: str = Field(default="", max_length=50)
    badge2_color: str = Field(default="blue", pattern=r"^(blue|red)$")
    badge2_tooltip: str = Field(default="", max_length=500)


class SprintCreate(SprintBase):
    board_id: int


class SprintUpdate(BaseModel):
    number: Optional[int] = Field(None, ge=1)
    capacity_ios: Optional[float] = Field(None, ge=0)
    capacity_android: Optional[float] = Field(None, ge=0)
    capacity_qa: Optional[float] = Field(None, ge=0)
    capacity_sa: Optional[float] = Field(None, ge=0)
    description: Optional[str] = Field(None, max_length=255)
    badge1_text: Optional[str] = Field(None, max_length=50)
    badge1_color: Optional[str] = Field(None, pattern=r"^(blue|red)$")
    badge1_tooltip: Optional[str] = Field(None, max_length=500)
    badge2_text: Optional[str] = Field(None, max_length=50)
    badge2_color: Optional[str] = Field(None, pattern=r"^(blue|red)$")
    badge2_tooltip: Optional[str] = Field(None, max_length=500)


class Sprint(SprintBase):
    id: int
    board_id: int
    tasks: List[Task] = []
    
    # Расчетные поля (будут вычисляться)
    used_capacity_ios: Optional[float] = None
    used_capacity_android: Optional[float] = None
    used_capacity_qa: Optional[float] = None
    used_capacity_sa: Optional[float] = None
    
    available_capacity_ios: Optional[float] = None
    available_capacity_android: Optional[float] = None
    available_capacity_qa: Optional[float] = None
    available_capacity_sa: Optional[float] = None

    model_config = {"from_attributes": True}


# Базовые схемы для Board
class BoardBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class BoardCreate(BoardBase):
    pass


class BoardUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)


class Board(BoardBase):
    id: int
    created_at: datetime
    features: List[Feature] = []
    sprints: List[Sprint] = []

    model_config = {"from_attributes": True}


# Схема для истории изменений
class HistoryBase(BaseModel):
    action_type: str
    data: Dict[str, Any]


class HistoryCreate(HistoryBase):
    board_id: int


class History(HistoryBase):
    id: int
    board_id: int
    timestamp: datetime

    model_config = {"from_attributes": True}


# WebSocket сообщения
class WSMessage(BaseModel):
    type: str
    data: Dict[str, Any]
    board_id: int


# Схемы для перемещения задач
class TaskMove(BaseModel):
    task_id: int
    new_sprint_id: Optional[int] = None
    new_feature_id: Optional[int] = None
    new_position_x: float = 0.0
    new_position_y: float = 0.0
