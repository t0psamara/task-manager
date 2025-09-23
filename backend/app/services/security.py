from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import logging

from ..database import get_db
from .. import models
from .auth import get_current_user, verify_board_access

logger = logging.getLogger(__name__)
security = HTTPBearer()


class BoardAccessDependency:
    """Dependency для проверки доступа к доске"""
    
    def __init__(self, require_owner: bool = False):
        self.require_owner = require_owner
    
    async def __call__(
        self,
        board_id: Optional[int] = None,
        unique_link: Optional[str] = None,
        current_user: Optional[models.User] = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ) -> models.Board:
        """Проверка доступа к доске"""
        
        board = await verify_board_access(
            board_id=board_id,
            unique_link=unique_link,
            user=current_user,
            db=db
        )
        
        if not board:
            raise HTTPException(
                status_code=404, 
                detail="Доска не найдена или доступ запрещён"
            )
        
        # Если требуется быть владельцем
        if self.require_owner and board.owner_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Только владелец доски может выполнить это действие"
            )
        
        return board


async def get_user_ip(request: Request) -> Optional[str]:
    """Получение IP адреса пользователя"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def require_board_access(require_owner: bool = False):
    """Фабрика dependency для проверки доступа к доске"""
    return BoardAccessDependency(require_owner=require_owner)


# Готовые dependency
board_access = require_board_access(require_owner=False)  # Доступ по ссылке или владелец
board_owner_access = require_board_access(require_owner=True)  # Только владелец
