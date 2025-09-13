from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/boards", tags=["boards"])


@router.post("/")
async def create_board(
    board_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Создание новой доски с автоматическим созданием 6 спринтов"""
    try:
        print(f"Raw request data: {board_data}")
        
        # Создаем доску
        db_board = models.Board(name=board_data.get("name"))
        print(f"Created board model: {db_board}")
        
        db.add(db_board)
        await db.flush()
        await db.refresh(db_board)
        
        print(f"Board saved with ID: {db_board.id}")
        
        # Автоматически создаем 6 спринтов для новой доски
        for sprint_number in range(1, 7):
            db_sprint = models.Sprint(
                board_id=db_board.id,
                number=sprint_number,
                capacity_ios=0.0,
                capacity_android=0.0,
                capacity_qa=0.0,
                capacity_sa=0.0,
                description="",
                badge1_text="",
                badge1_color="blue",
                badge1_tooltip="",
                badge2_text="",
                badge2_color="blue", 
                badge2_tooltip=""
            )
            db.add(db_sprint)
        
        await db.flush()
        print(f"Created 6 sprints for board {db_board.id}")
        
        return {
            "id": db_board.id,
            "name": db_board.name,
            "created_at": db_board.created_at.isoformat(),
            "sprints_created": 6
        }
    except Exception as e:
        print(f"Error in create_board: {e}")
        import traceback
        traceback.print_exc()
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def get_boards(db: AsyncSession = Depends(get_db)):
    """Получение всех досок"""
    result = await db.execute(select(models.Board))
    boards = result.scalars().all()
    
    return [
        {
            "id": board.id,
            "name": board.name,
            "created_at": board.created_at.isoformat()
        }
        for board in boards
    ]


@router.get("/{board_id}", response_model=schemas.Board)
async def get_board(board_id: int, db: AsyncSession = Depends(get_db)):
    """Получение доски по ID с полной информацией"""
    result = await db.execute(
        select(models.Board)
        .where(models.Board.id == board_id)
    )
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Доска не найдена")
    
    # Загружаем связанные данные
    await db.refresh(board, ['features', 'sprints'])
    for feature in board.features:
        await db.refresh(feature, ['tasks'])
    for sprint in board.sprints:
        await db.refresh(sprint, ['tasks'])
    
    return board


@router.put("/{board_id}", response_model=schemas.Board)
async def update_board(
    board_id: int,
    board_update: schemas.BoardUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Обновление доски"""
    result = await db.execute(
        select(models.Board).where(models.Board.id == board_id)
    )
    db_board = result.scalar_one_or_none()
    if not db_board:
        raise HTTPException(status_code=404, detail="Доска не найдена")
    
    update_data = board_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_board, field, value)
    
    await db.flush()
    await db.refresh(db_board)
    return db_board


@router.delete("/{board_id}")
async def delete_board(board_id: int, db: AsyncSession = Depends(get_db)):
    """Удаление доски"""
    result = await db.execute(
        select(models.Board).where(models.Board.id == board_id)
    )
    db_board = result.scalar_one_or_none()
    if not db_board:
        raise HTTPException(status_code=404, detail="Доска не найдена")
    
    await db.delete(db_board)
    await db.flush()
    return {"message": "Доска успешно удалена"}
