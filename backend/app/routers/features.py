from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/features", tags=["features"])


@router.post("/")
async def create_feature(
    feature_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Создание новой фичи"""
    try:
        board_id = feature_data.get("board_id")
        if not board_id:
            raise HTTPException(status_code=400, detail="board_id обязателен")
            
        # Проверяем существование доски
        result = await db.execute(
            select(models.Board).where(models.Board.id == board_id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Доска не найдена")
        
        db_feature = models.Feature(
            board_id=board_id,
            name=feature_data.get("name"),
            order=feature_data.get("order", 0)
        )
        db.add(db_feature)
        await db.flush()
        await db.refresh(db_feature)
        
        return {
            "id": db_feature.id,
            "board_id": db_feature.board_id,
            "name": db_feature.name,
            "order": db_feature.order
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def get_features(board_id: int = None, db: AsyncSession = Depends(get_db)):
    """Получение всех фич или фич конкретной доски"""
    query = select(models.Feature)
    if board_id:
        query = query.where(models.Feature.board_id == board_id)
    query = query.order_by(models.Feature.order)
    
    result = await db.execute(query)
    features = result.scalars().all()
    
    return [
        {
            "id": feature.id,
            "board_id": feature.board_id,
            "name": feature.name,
            "order": feature.order
        }
        for feature in features
    ]


@router.get("/{feature_id}", response_model=schemas.Feature)
async def get_feature(feature_id: int, db: AsyncSession = Depends(get_db)):
    """Получение фичи по ID"""
    result = await db.execute(
        select(models.Feature).where(models.Feature.id == feature_id)
    )
    feature = result.scalar_one_or_none()
    if not feature:
        raise HTTPException(status_code=404, detail="Фича не найдена")
    
    # Загружаем связанные задачи
    await db.refresh(feature, ['tasks'])
    return feature


@router.put("/{feature_id}", response_model=schemas.Feature)
async def update_feature(
    feature_id: int,
    feature_update: schemas.FeatureUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Обновление фичи"""
    result = await db.execute(
        select(models.Feature).where(models.Feature.id == feature_id)
    )
    db_feature = result.scalar_one_or_none()
    if not db_feature:
        raise HTTPException(status_code=404, detail="Фича не найдена")
    
    update_data = feature_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_feature, field, value)
    
    await db.flush()
    await db.refresh(db_feature)
    return db_feature


@router.delete("/{feature_id}")
async def delete_feature(feature_id: int, db: AsyncSession = Depends(get_db)):
    """Удаление фичи"""
    result = await db.execute(
        select(models.Feature).where(models.Feature.id == feature_id)
    )
    db_feature = result.scalar_one_or_none()
    if not db_feature:
        raise HTTPException(status_code=404, detail="Фича не найдена")
    
    await db.delete(db_feature)
    await db.flush()
    return {"message": "Фича успешно удалена"}


@router.post("/{feature_id}/reorder")
async def reorder_features(
    feature_id: int,
    new_order: int,
    db: AsyncSession = Depends(get_db)
):
    """Изменение порядка фич"""
    result = await db.execute(
        select(models.Feature).where(models.Feature.id == feature_id)
    )
    db_feature = result.scalar_one_or_none()
    if not db_feature:
        raise HTTPException(status_code=404, detail="Фича не найдена")
    
    old_order = db_feature.order
    db_feature.order = new_order
    
    # Обновляем порядок других фич
    if new_order > old_order:
        # Сдвигаем вниз фичи между старой и новой позицией
        result = await db.execute(
            select(models.Feature).where(
                models.Feature.board_id == db_feature.board_id,
                models.Feature.order > old_order,
                models.Feature.order <= new_order,
                models.Feature.id != feature_id
            )
        )
        features_to_update = result.scalars().all()
        for feature in features_to_update:
            feature.order -= 1
    else:
        # Сдвигаем вверх фичи между новой и старой позицией
        result = await db.execute(
            select(models.Feature).where(
                models.Feature.board_id == db_feature.board_id,
                models.Feature.order >= new_order,
                models.Feature.order < old_order,
                models.Feature.id != feature_id
            )
        )
        features_to_update = result.scalars().all()
        for feature in features_to_update:
            feature.order += 1
    
    await db.flush()
    return {"message": "Порядок фич обновлен"}
