from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("/")
async def create_task(
    task_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Создание новой задачи"""
    try:
        feature_id = task_data.get("feature_id")
        if not feature_id:
            raise HTTPException(status_code=400, detail="feature_id обязателен")
            
        # Проверяем существование фичи
        result = await db.execute(
            select(models.Feature).where(models.Feature.id == feature_id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Фича не найдена")
        
        # Проверяем существование спринта если указан
        sprint_id = task_data.get("sprint_id")
        if sprint_id:
            result = await db.execute(
                select(models.Sprint).where(models.Sprint.id == sprint_id)
            )
            if not result.scalar_one_or_none():
                raise HTTPException(status_code=404, detail="Спринт не найден")
        
        db_task = models.Task(
            feature_id=feature_id,
            sprint_id=sprint_id,
            name=task_data.get("name"),
            estimate_ios=float(task_data.get("estimate_ios", 0)),
            estimate_android=float(task_data.get("estimate_android", 0)),
            estimate_qa=float(task_data.get("estimate_qa", 0)),
            estimate_sa=float(task_data.get("estimate_sa", 0)),
            position_x=float(task_data.get("position_x", 0)),
            position_y=float(task_data.get("position_y", 0)),
            color=task_data.get("color", "#ffeb3b"),
            enabler_title=task_data.get("enabler_title", ""),
            enabler_active=True  # Всегда активен
        )
        db.add(db_task)
        await db.flush()
        await db.refresh(db_task)
        
        return {
            "id": db_task.id,
            "feature_id": db_task.feature_id,
            "sprint_id": db_task.sprint_id,
            "name": db_task.name,
            "estimate_ios": db_task.estimate_ios,
            "estimate_android": db_task.estimate_android,
            "estimate_qa": db_task.estimate_qa,
            "estimate_sa": db_task.estimate_sa,
            "position_x": db_task.position_x,
            "position_y": db_task.position_y,
            "color": db_task.color,
            "enabler_title": db_task.enabler_title or "",
            "enabler_active": True,  # Всегда активен
            "created_at": db_task.created_at.isoformat(),
            "updated_at": db_task.updated_at.isoformat() if db_task.updated_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def get_tasks(
    feature_id: int = None, 
    sprint_id: int = None,
    board_id: int = None,
    db: AsyncSession = Depends(get_db)
):
    """Получение задач с фильтрацией"""
    query = select(models.Task)
    
    if feature_id:
        query = query.where(models.Task.feature_id == feature_id)
    
    if sprint_id:
        query = query.where(models.Task.sprint_id == sprint_id)
    
    if board_id:
        # Получаем задачи через фичи доски
        query = query.join(models.Feature).where(models.Feature.board_id == board_id)
    
    query = query.order_by(models.Task.created_at)
    result = await db.execute(query)
    tasks = result.scalars().all()
    
    return [
        {
            "id": task.id,
            "feature_id": task.feature_id,
            "sprint_id": task.sprint_id,
            "name": task.name,
            "estimate_ios": task.estimate_ios,
            "estimate_android": task.estimate_android,
            "estimate_qa": task.estimate_qa,
            "estimate_sa": task.estimate_sa,
            "position_x": task.position_x,
            "position_y": task.position_y,
            "color": task.color,
            "enabler_title": task.enabler_title or "",
            "enabler_active": True,  # Всегда активен
            "created_at": task.created_at.isoformat(),
            "updated_at": task.updated_at.isoformat() if task.updated_at else None
        }
        for task in tasks
    ]


@router.get("/{task_id}", response_model=schemas.Task)
async def get_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """Получение задачи по ID"""
    result = await db.execute(
        select(models.Task).where(models.Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    return task


@router.put("/{task_id}", response_model=schemas.Task)
async def update_task(
    task_id: int,
    task_update: schemas.TaskUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Обновление задачи"""
    result = await db.execute(
        select(models.Task).where(models.Task.id == task_id)
    )
    db_task = result.scalar_one_or_none()
    if not db_task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    update_data = task_update.model_dump(exclude_unset=True)
    
    # Проверяем существование новой фичи если изменяется
    if 'feature_id' in update_data:
        result = await db.execute(
            select(models.Feature).where(models.Feature.id == update_data['feature_id'])
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Фича не найдена")
    
    # Проверяем существование нового спринта если изменяется
    if 'sprint_id' in update_data and update_data['sprint_id'] is not None:
        result = await db.execute(
            select(models.Sprint).where(models.Sprint.id == update_data['sprint_id'])
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Спринт не найден")
    
    for field, value in update_data.items():
        setattr(db_task, field, value)
    
    await db.flush()
    await db.refresh(db_task)
    return db_task


@router.delete("/{task_id}")
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """Удаление задачи"""
    result = await db.execute(
        select(models.Task).where(models.Task.id == task_id)
    )
    db_task = result.scalar_one_or_none()
    if not db_task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    await db.delete(db_task)
    await db.flush()
    return {"message": "Задача успешно удалена"}


@router.post("/move", response_model=schemas.Task)
async def move_task(
    task_move: schemas.TaskMove,
    db: AsyncSession = Depends(get_db)
):
    """Перемещение задачи в другой спринт/фичу с изменением позиции"""
    result = await db.execute(
        select(models.Task).where(models.Task.id == task_move.task_id)
    )
    db_task = result.scalar_one_or_none()
    if not db_task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    # Проверяем новую фичу если указана
    if task_move.new_feature_id:
        result = await db.execute(
            select(models.Feature).where(models.Feature.id == task_move.new_feature_id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Фича не найдена")
        db_task.feature_id = task_move.new_feature_id
    
    # Проверяем новый спринт если указан
    if task_move.new_sprint_id:
        result = await db.execute(
            select(models.Sprint).where(models.Sprint.id == task_move.new_sprint_id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Спринт не найден")
        db_task.sprint_id = task_move.new_sprint_id
    elif task_move.new_sprint_id is None:
        # Явно убираем из спринта (перемещение в backlog)
        db_task.sprint_id = None
    
    # Обновляем позицию
    db_task.position_x = task_move.new_position_x
    db_task.position_y = task_move.new_position_y
    
    await db.flush()
    await db.refresh(db_task)
    return db_task


@router.post("/{task_id}/clone", response_model=schemas.Task)
async def clone_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """Клонирование задачи"""
    result = await db.execute(
        select(models.Task).where(models.Task.id == task_id)
    )
    original_task = result.scalar_one_or_none()
    if not original_task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    # Создаем копию задачи
    task_data = {
        "name": f"{original_task.name} (копия)",
        "feature_id": original_task.feature_id,
        "sprint_id": None,  # Клон создается без спринта
        "estimate_ios": original_task.estimate_ios,
        "estimate_android": original_task.estimate_android,
        "estimate_qa": original_task.estimate_qa,
        "estimate_sa": original_task.estimate_sa,
        "position_x": original_task.position_x + 10,  # Смещаем позицию
        "position_y": original_task.position_y + 10,
        "color": original_task.color
    }
    
    db_task = models.Task(**task_data)
    db.add(db_task)
    await db.flush()
    await db.refresh(db_task)
    return db_task


@router.get("/unassigned/", response_model=List[schemas.Task])
async def get_unassigned_tasks(board_id: int, db: AsyncSession = Depends(get_db)):
    """Получение неназначенных задач (backlog) для доски"""
    query = (
        select(models.Task)
        .join(models.Feature)
        .where(
            models.Feature.board_id == board_id,
            models.Task.sprint_id.is_(None)
        )
        .order_by(models.Task.created_at)
    )
    
    result = await db.execute(query)
    tasks = result.scalars().all()
    return tasks
