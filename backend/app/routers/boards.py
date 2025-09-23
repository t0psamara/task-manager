from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid

from .. import models, schemas
from ..database import get_db
from .auth import get_current_user, get_current_user_optional
from ..services.auth import log_user_action
from ..services.security import board_access, board_owner_access

router = APIRouter(prefix="/boards", tags=["boards"])


@router.post("/")
async def create_board(
    board_data: dict,
    request: Request,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Создание новой доски с автоматическим созданием 6 спринтов"""
    try:
        # Создаем доску
        unique_link = str(uuid.uuid4())
        db_board = models.Board(
            name=board_data.get("name"),
            owner_id=current_user.id,
            unique_link=unique_link
        )
        
        db.add(db_board)
        await db.flush()
        await db.refresh(db_board)
        
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
        
        await db.commit()
        
        # Логируем создание доски
        await log_user_action(
            db=db,
            user=current_user,
            action="create_board",
            entity_type="board",
            entity_id=db_board.id,
            entity_name=db_board.name,
            board_id=db_board.id,
            request=request
        )
        
        return {
            "id": db_board.id,
            "name": db_board.name,
            "unique_link": unique_link,
            "created_at": db_board.created_at.isoformat(),
            "sprints_created": 6
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def get_my_boards(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение досок пользователя"""
    result = await db.execute(
        select(models.Board)
        .where(models.Board.owner_id == current_user.id)
        .order_by(models.Board.created_at.desc())
    )
    boards = result.scalars().all()
    
    return [
        {
            "id": board.id,
            "name": board.name,
            "unique_link": board.unique_link,
            "created_at": board.created_at.isoformat()
        }
        for board in boards
    ]


@router.get("/link/{unique_link}")
async def get_board_by_link(
    unique_link: str,
    request: Request,
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Получение доски по уникальной ссылке"""
    result = await db.execute(
        select(models.Board)
        .options(
            selectinload(models.Board.features).selectinload(models.Feature.tasks),
            selectinload(models.Board.sprints).selectinload(models.Sprint.tasks),
            selectinload(models.Board.owner)
        )
        .where(models.Board.unique_link == unique_link)
    )
    board = result.scalar_one_or_none()
    
    if not board:
        raise HTTPException(status_code=404, detail="Доска не найдена")
    
    # Логируем доступ к доске
    if current_user:
        await log_user_action(
            db=db,
            user=current_user,
            action="access_board",
            entity_type="board",
            entity_id=board.id,
            entity_name=board.name,
            board_id=board.id,
            request=request
        )
    
    return {
        "id": board.id,
        "name": board.name,
        "unique_link": board.unique_link,
        "owner_id": board.owner_id,
        "is_owner": current_user and board.owner_id == current_user.id if current_user else False,
        "created_at": board.created_at.isoformat(),
        "features": [
            {
                "id": f.id,
                "name": f.name,
                "order": f.order,
                "mgmt_link": f.mgmt_link,
                "mgmt_title": f.mgmt_title,
                "epic_link": f.epic_link,
                "epic_title": f.epic_title,
                "project_code": f.project_code,
                "tasks": [
                    {
                        "id": t.id,
                        "name": t.name,
                        "sprint_id": t.sprint_id,
                        "feature_id": t.feature_id,
                        "estimate_ios": t.estimate_ios,
                        "estimate_android": t.estimate_android,
                        "estimate_qa": t.estimate_qa,
                        "estimate_sa": t.estimate_sa,
                        "position_x": t.position_x,
                        "position_y": t.position_y,
                        "color": t.color,
                        "enabler_title": t.enabler_title,
                        "enabler_active": t.enabler_active,
                        "is_collapsed_feature": t.is_collapsed_feature,
                        "original_feature_tasks": t.original_feature_tasks,
                        "created_at": t.created_at.isoformat(),
                        "updated_at": t.updated_at.isoformat() if t.updated_at else None
                    }
                    for t in f.tasks
                ]
            }
            for f in sorted(board.features, key=lambda x: x.order)
        ],
        "sprints": [
            {
                "id": s.id,
                "number": s.number,
                "capacity_ios": s.capacity_ios,
                "capacity_android": s.capacity_android,
                "capacity_qa": s.capacity_qa,
                "capacity_sa": s.capacity_sa,
                "description": s.description,
                "badge1_text": s.badge1_text,
                "badge1_color": s.badge1_color,
                "badge1_tooltip": s.badge1_tooltip,
                "badge2_text": s.badge2_text,
                "badge2_color": s.badge2_color,
                "badge2_tooltip": s.badge2_tooltip,
                "tasks": [
                    {
                        "id": t.id,
                        "name": t.name,
                        "sprint_id": t.sprint_id,
                        "feature_id": t.feature_id,
                        "estimate_ios": t.estimate_ios,
                        "estimate_android": t.estimate_android,
                        "estimate_qa": t.estimate_qa,
                        "estimate_sa": t.estimate_sa,
                        "position_x": t.position_x,
                        "position_y": t.position_y,
                        "color": t.color,
                        "enabler_title": t.enabler_title,
                        "enabler_active": t.enabler_active,
                        "is_collapsed_feature": t.is_collapsed_feature,
                        "original_feature_tasks": t.original_feature_tasks,
                        "created_at": t.created_at.isoformat(),
                        "updated_at": t.updated_at.isoformat() if t.updated_at else None
                    }
                    for t in s.tasks
                ]
            }
            for s in sorted(board.sprints, key=lambda x: x.number)
        ]
    }


@router.get("/{board_id}")
async def get_board(
    board: models.Board = Depends(board_access),
    request: Request,
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Получение доски по ID с проверкой доступа"""
    # Загружаем связанные данные
    await db.refresh(board, ['features', 'sprints', 'owner'])
    for feature in board.features:
        await db.refresh(feature, ['tasks'])
    for sprint in board.sprints:
        await db.refresh(sprint, ['tasks'])
    
    # Логируем доступ к доске
    if current_user:
        await log_user_action(
            db=db,
            user=current_user,
            action="access_board",
            entity_type="board",
            entity_id=board.id,
            entity_name=board.name,
            board_id=board.id,
            request=request
        )
    
    return {
        "id": board.id,
        "name": board.name,
        "unique_link": board.unique_link,
        "owner_id": board.owner_id,
        "is_owner": current_user and board.owner_id == current_user.id if current_user else False,
        "created_at": board.created_at.isoformat(),
        "features": board.features,
        "sprints": board.sprints
    }


@router.put("/{board_id}")
async def update_board(
    board_update: schemas.BoardUpdate,
    request: Request,
    board: models.Board = Depends(board_owner_access),
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновление доски (только владелец)"""
    old_name = board.name
    update_data = board_update.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(board, field, value)
    
    await db.commit()
    await db.refresh(board)
    
    # Логируем обновление доски
    await log_user_action(
        db=db,
        user=current_user,
        action="update_board",
        entity_type="board",
        entity_id=board.id,
        entity_name=board.name,
        board_id=board.id,
        details={"old_name": old_name, "new_name": board.name} if old_name != board.name else None,
        request=request
    )
    
    return {
        "id": board.id,
        "name": board.name,
        "unique_link": board.unique_link,
        "owner_id": board.owner_id,
        "created_at": board.created_at.isoformat()
    }


@router.delete("/{board_id}")
async def delete_board(
    request: Request,
    board: models.Board = Depends(board_owner_access),
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удаление доски (только владелец)"""
    board_name = board.name
    board_id = board.id
    
    await db.delete(board)
    await db.commit()
    
    # Логируем удаление доски
    await log_user_action(
        db=db,
        user=current_user,
        action="delete_board",
        entity_type="board",
        entity_id=board_id,
        entity_name=board_name,
        board_id=board_id,
        request=request
    )
    
    return {"message": "Доска успешно удалена"}


@router.get("/{board_id}/share-link")
async def get_board_share_link(
    board: models.Board = Depends(board_owner_access),
    current_user: models.User = Depends(get_current_user)
):
    """Получение ссылки для доступа к доске (только владелец)"""
    return {
        "unique_link": board.unique_link,
        "share_url": f"/board/{board.unique_link}",
        "board_name": board.name
    }


@router.post("/{board_id}/regenerate-link")
async def regenerate_board_link(
    request: Request,
    board: models.Board = Depends(board_owner_access),
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Перегенерация ссылки для доступа к доске (только владелец)"""
    old_link = board.unique_link
    new_link = str(uuid.uuid4())
    
    board.unique_link = new_link
    await db.commit()
    
    # Логируем перегенерацию ссылки
    await log_user_action(
        db=db,
        user=current_user,
        action="regenerate_board_link",
        entity_type="board",
        entity_id=board.id,
        entity_name=board.name,
        board_id=board.id,
        details={"old_link": old_link, "new_link": new_link},
        request=request
    )
    
    return {
        "unique_link": new_link,
        "share_url": f"/board/{new_link}",
        "message": "Ссылка обновлена"
    }
