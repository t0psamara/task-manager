from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import logging
import json
from datetime import datetime

from .. import models

logger = logging.getLogger(__name__)


class ActivityLogger:
    """Сервис для логирования действий пользователей"""
    
    @staticmethod
    async def log_activity(
        db: AsyncSession,
        user: models.User,
        action: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        entity_name: Optional[str] = None,
        board_id: Optional[int] = None,
        details: Optional[dict] = None,
        request: Optional[Request] = None
    ):
        """Логирование действия пользователя"""
        
        # Получаем IP и User Agent
        ip_address = None
        user_agent = None
        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")
        
        # Создаем запись в БД
        log_entry = models.UserActivityLog(
            user_id=user.id,
            board_id=board_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        db.add(log_entry)
        await db.commit()
        
        # Логируем в файл для читаемости
        await ActivityLogger._log_to_file(
            user=user,
            action=action,
            entity_type=entity_type,
            entity_name=entity_name,
            board_id=board_id,
            details=details,
            ip_address=ip_address
        )
    
    @staticmethod
    async def _log_to_file(
        user: models.User,
        action: str,
        entity_type: Optional[str] = None,
        entity_name: Optional[str] = None,
        board_id: Optional[int] = None,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None
    ):
        """Запись читаемого лога в файл"""
        
        log_file_path = "logs/user_activity.log"
        
        # Создаем директорию logs если её нет
        import os
        os.makedirs(os.path.dirname(log_file_path), exist_ok=True)
        
        # Формируем читаемую запись
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_message = f"[{timestamp}] {user.name} ({user.email})"
        
        if board_id:
            log_message += f" в доске #{board_id}"
        
        log_message += f" - {action}"
        
        if entity_type and entity_name:
            log_message += f" {entity_type}: '{entity_name}'"
        elif entity_type and not entity_name:
            log_message += f" {entity_type}"
        
        if details:
            # Форматируем детали для читаемости
            details_str = ""
            if "old_name" in details and "new_name" in details:
                details_str = f" ('{details['old_name']}' → '{details['new_name']}')"
            elif "moved_from" in details and "moved_to" in details:
                details_str = f" (из спринта {details['moved_from']} в спринт {details['moved_to']})"
            elif "estimates" in details:
                est = details["estimates"]
                details_str = f" (iOS: {est.get('ios', 0)}, Android: {est.get('android', 0)}, QA: {est.get('qa', 0)}, SA: {est.get('sa', 0)})"
            
            log_message += details_str
        
        if ip_address:
            log_message += f" [IP: {ip_address}]"
        
        log_message += "\n"
        
        # Записываем в файл
        try:
            with open(log_file_path, "a", encoding="utf-8") as f:
                f.write(log_message)
        except Exception as e:
            logger.error(f"Ошибка записи в файл логов: {e}")


async def verify_board_access(
    board_id: Optional[int] = None,
    unique_link: Optional[str] = None,
    user: Optional[models.User] = None,
    db: AsyncSession = None
) -> Optional[models.Board]:
    """Проверка доступа к доске"""
    
    if not board_id and not unique_link:
        return None
    
    query = select(models.Board).options(selectinload(models.Board.owner))
    
    if unique_link:
        query = query.where(models.Board.unique_link == unique_link)
    else:
        query = query.where(models.Board.id == board_id)
    
    result = await db.execute(query)
    board = result.scalar_one_or_none()
    
    if not board:
        return None
    
    # Доступ есть если:
    # 1. Пользователь - владелец доски
    # 2. Или передана правильная уникальная ссылка
    if user and board.owner_id == user.id:
        return board
    
    if unique_link and board.unique_link == unique_link:
        return board
    
    return None


def get_user_display_name(user: models.User) -> str:
    """Получение отображаемого имени пользователя"""
    return user.name if user.name else user.email


# Словарь для перевода действий на русский
ACTION_TRANSLATIONS = {
    "login": "вошёл в систему",
    "logout": "вышел из системы",
    "create_board": "создал доску",
    "update_board": "обновил доску",
    "delete_board": "удалил доску",
    "access_board": "открыл доску",
    "create_feature": "создал фичу",
    "update_feature": "обновил фичу",
    "delete_feature": "удалил фичу",
    "reorder_features": "изменил порядок фич",
    "create_task": "создал задачу",
    "update_task": "обновил задачу",
    "delete_task": "удалил задачу",
    "move_task": "переместил задачу",
    "copy_task": "скопировал задачу",
    "paste_task": "вставил задачу",
    "update_sprint": "обновил спринт",
    "collapse_feature": "свернул фичу",
    "expand_feature": "развернул фичу"
}


async def log_user_action(
    db: AsyncSession,
    user: models.User,
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    entity_name: Optional[str] = None,
    board_id: Optional[int] = None,
    details: Optional[dict] = None,
    request: Optional[Request] = None
):
    """Хелпер для логирования действий с переводом"""
    
    # Переводим действие на русский
    action_ru = ACTION_TRANSLATIONS.get(action, action)
    
    await ActivityLogger.log_activity(
        db=db,
        user=user,
        action=action_ru,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        board_id=board_id,
        details=details,
        request=request
    )
