from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/sprints", tags=["sprints"])


@router.post("/")
async def create_sprint(
    sprint_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Создание нового спринта"""
    try:
        board_id = sprint_data.get("board_id")
        number = sprint_data.get("number")
        
        if not board_id:
            raise HTTPException(status_code=400, detail="board_id обязателен")
        if not number:
            raise HTTPException(status_code=400, detail="number обязателен")
            
        # Проверяем существование доски
        result = await db.execute(
            select(models.Board).where(models.Board.id == board_id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Доска не найдена")
        
        # Проверяем уникальность номера спринта в рамках доски
        result = await db.execute(
            select(models.Sprint).where(
                models.Sprint.board_id == board_id,
                models.Sprint.number == number
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Спринт с таким номером уже существует")
        
        db_sprint = models.Sprint(
            board_id=board_id,
            number=number,
            capacity_ios=float(sprint_data.get("capacity_ios", 0)),
            capacity_android=float(sprint_data.get("capacity_android", 0)),
            capacity_qa=float(sprint_data.get("capacity_qa", 0)),
            capacity_sa=float(sprint_data.get("capacity_sa", 0)),
            description=sprint_data.get("description", ""),
            badge1_text=sprint_data.get("badge1_text", ""),
            badge1_color=sprint_data.get("badge1_color", "blue"),
            badge1_tooltip=sprint_data.get("badge1_tooltip", ""),
            badge2_text=sprint_data.get("badge2_text", ""),
            badge2_color=sprint_data.get("badge2_color", "blue"),
            badge2_tooltip=sprint_data.get("badge2_tooltip", "")
        )
        db.add(db_sprint)
        await db.flush()
        await db.refresh(db_sprint)
        
        return {
            "id": db_sprint.id,
            "board_id": db_sprint.board_id,
            "number": db_sprint.number,
            "capacity_ios": db_sprint.capacity_ios,
            "capacity_android": db_sprint.capacity_android,
            "capacity_qa": db_sprint.capacity_qa,
            "capacity_sa": db_sprint.capacity_sa,
            "description": db_sprint.description,
            "badge1_text": db_sprint.badge1_text,
            "badge1_color": db_sprint.badge1_color,
            "badge1_tooltip": db_sprint.badge1_tooltip,
            "badge2_text": db_sprint.badge2_text,
            "badge2_color": db_sprint.badge2_color,
            "badge2_tooltip": db_sprint.badge2_tooltip
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def get_sprints(board_id: int = None, db: AsyncSession = Depends(get_db)):
    """Получение всех спринтов или спринтов конкретной доски"""
    query = select(models.Sprint)
    if board_id:
        query = query.where(models.Sprint.board_id == board_id)
    query = query.order_by(models.Sprint.number)
    
    result = await db.execute(query)
    sprints = result.scalars().all()
    
    sprint_list = []
    for sprint in sprints:
        sprint_list.append({
            "id": sprint.id,
            "board_id": sprint.board_id,
            "number": sprint.number,
            "capacity_ios": sprint.capacity_ios,
            "capacity_android": sprint.capacity_android,
            "capacity_qa": sprint.capacity_qa,
            "capacity_sa": sprint.capacity_sa,
            "description": sprint.description or "",
            "badge1_text": sprint.badge1_text or "",
            "badge1_color": sprint.badge1_color or "blue",
            "badge1_tooltip": sprint.badge1_tooltip or "",
            "badge2_text": sprint.badge2_text or "",
            "badge2_color": sprint.badge2_color or "blue",
            "badge2_tooltip": sprint.badge2_tooltip or ""
        })
    
    return sprint_list


@router.get("/{sprint_id}", response_model=schemas.Sprint)
async def get_sprint(sprint_id: int, db: AsyncSession = Depends(get_db)):
    """Получение спринта по ID"""
    result = await db.execute(
        select(models.Sprint).where(models.Sprint.id == sprint_id)
    )
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Спринт не найден")
    
    # Загружаем связанные задачи
    await db.refresh(sprint, ['tasks'])
    
    # Рассчитываем использованную емкость
    used_ios = sum(task.estimate_ios for task in sprint.tasks)
    used_android = sum(task.estimate_android for task in sprint.tasks)
    used_qa = sum(task.estimate_qa for task in sprint.tasks)
    used_sa = sum(task.estimate_sa for task in sprint.tasks)
    
    sprint.used_capacity_ios = used_ios
    sprint.used_capacity_android = used_android
    sprint.used_capacity_qa = used_qa
    sprint.used_capacity_sa = used_sa
    
    sprint.available_capacity_ios = sprint.capacity_ios - used_ios
    sprint.available_capacity_android = sprint.capacity_android - used_android
    sprint.available_capacity_qa = sprint.capacity_qa - used_qa
    sprint.available_capacity_sa = sprint.capacity_sa - used_sa
    
    return sprint


@router.put("/{sprint_id}")
async def update_sprint(
    sprint_id: int,
    sprint_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Обновление спринта"""
    try:
        result = await db.execute(
            select(models.Sprint).where(models.Sprint.id == sprint_id)
        )
        db_sprint = result.scalar_one_or_none()
        if not db_sprint:
            raise HTTPException(status_code=404, detail="Спринт не найден")
        
        # Проверяем уникальность номера спринта если он изменяется
        if 'number' in sprint_data and sprint_data['number'] != db_sprint.number:
            result = await db.execute(
                select(models.Sprint).where(
                    models.Sprint.board_id == db_sprint.board_id,
                    models.Sprint.number == sprint_data['number'],
                    models.Sprint.id != sprint_id
                )
            )
            if result.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Спринт с таким номером уже существует")
        
        # Обновляем поля спринта
        if 'capacity_ios' in sprint_data:
            db_sprint.capacity_ios = float(sprint_data['capacity_ios'])
        if 'capacity_android' in sprint_data:
            db_sprint.capacity_android = float(sprint_data['capacity_android'])
        if 'capacity_qa' in sprint_data:
            db_sprint.capacity_qa = float(sprint_data['capacity_qa'])
        if 'capacity_sa' in sprint_data:
            db_sprint.capacity_sa = float(sprint_data['capacity_sa'])
        if 'description' in sprint_data:
            db_sprint.description = sprint_data['description']
        if 'badge1_text' in sprint_data:
            db_sprint.badge1_text = sprint_data['badge1_text']
        if 'badge1_color' in sprint_data:
            db_sprint.badge1_color = sprint_data['badge1_color']
        if 'badge1_tooltip' in sprint_data:
            db_sprint.badge1_tooltip = sprint_data['badge1_tooltip']
        if 'badge2_text' in sprint_data:
            db_sprint.badge2_text = sprint_data['badge2_text']
        if 'badge2_color' in sprint_data:
            db_sprint.badge2_color = sprint_data['badge2_color']
        if 'badge2_tooltip' in sprint_data:
            db_sprint.badge2_tooltip = sprint_data['badge2_tooltip']
        
        await db.flush()
        await db.refresh(db_sprint)
        
        return {
            "id": db_sprint.id,
            "board_id": db_sprint.board_id,
            "number": db_sprint.number,
            "capacity_ios": db_sprint.capacity_ios,
            "capacity_android": db_sprint.capacity_android,
            "capacity_qa": db_sprint.capacity_qa,
            "capacity_sa": db_sprint.capacity_sa,
            "description": db_sprint.description or "",
            "badge1_text": db_sprint.badge1_text or "",
            "badge1_color": db_sprint.badge1_color or "blue",
            "badge1_tooltip": db_sprint.badge1_tooltip or "",
            "badge2_text": db_sprint.badge2_text or "",
            "badge2_color": db_sprint.badge2_color or "blue",
            "badge2_tooltip": db_sprint.badge2_tooltip or ""
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{sprint_id}")
async def delete_sprint(sprint_id: int, db: AsyncSession = Depends(get_db)):
    """Удаление спринта"""
    result = await db.execute(
        select(models.Sprint).where(models.Sprint.id == sprint_id)
    )
    db_sprint = result.scalar_one_or_none()
    if not db_sprint:
        raise HTTPException(status_code=404, detail="Спринт не найден")
    
    # Проверяем есть ли задачи в спринте
    await db.refresh(db_sprint, ['tasks'])
    if db_sprint.tasks:
        raise HTTPException(
            status_code=400, 
            detail=f"Нельзя удалить спринт с задачами. Количество задач: {len(db_sprint.tasks)}"
        )
    
    await db.delete(db_sprint)
    await db.flush()
    return {"message": "Спринт успешно удален"}


@router.get("/{sprint_id}/capacity")
async def get_sprint_capacity(sprint_id: int, db: AsyncSession = Depends(get_db)):
    """Получение информации о емкости спринта"""
    result = await db.execute(
        select(models.Sprint).where(models.Sprint.id == sprint_id)
    )
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Спринт не найден")
    
    # Получаем агрегированные данные по задачам
    result = await db.execute(
        select(
            func.sum(models.Task.estimate_ios).label('used_ios'),
            func.sum(models.Task.estimate_android).label('used_android'),
            func.sum(models.Task.estimate_qa).label('used_qa'),
            func.sum(models.Task.estimate_sa).label('used_sa'),
            func.count(models.Task.id).label('task_count')
        ).where(models.Task.sprint_id == sprint_id)
    )
    
    capacity_data = result.first()
    
    return {
        "sprint_id": sprint_id,
        "sprint_number": sprint.number,
        "capacity": {
            "ios": sprint.capacity_ios,
            "android": sprint.capacity_android,
            "qa": sprint.capacity_qa,
            "sa": sprint.capacity_sa
        },
        "used": {
            "ios": capacity_data.used_ios or 0.0,
            "android": capacity_data.used_android or 0.0,
            "qa": capacity_data.used_qa or 0.0,
            "sa": capacity_data.used_sa or 0.0
        },
        "available": {
            "ios": sprint.capacity_ios - (capacity_data.used_ios or 0.0),
            "android": sprint.capacity_android - (capacity_data.used_android or 0.0),
            "qa": sprint.capacity_qa - (capacity_data.used_qa or 0.0),
            "sa": sprint.capacity_sa - (capacity_data.used_sa or 0.0)
        },
        "task_count": capacity_data.task_count or 0,
        "status": {
            "ios": "overload" if (capacity_data.used_ios or 0.0) > sprint.capacity_ios 
                   else "available" if sprint.capacity_ios > (capacity_data.used_ios or 0.0) 
                   else "full",
            "android": "overload" if (capacity_data.used_android or 0.0) > sprint.capacity_android 
                      else "available" if sprint.capacity_android > (capacity_data.used_android or 0.0) 
                      else "full",
            "qa": "overload" if (capacity_data.used_qa or 0.0) > sprint.capacity_qa 
                 else "available" if sprint.capacity_qa > (capacity_data.used_qa or 0.0) 
                 else "full",
            "sa": "overload" if (capacity_data.used_sa or 0.0) > sprint.capacity_sa 
                 else "available" if sprint.capacity_sa > (capacity_data.used_sa or 0.0) 
                 else "full"
        }
    }
