from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from jose import JWTError, jwt
from typing import Optional
import os
import logging

from httpx_oauth.clients.google import GoogleOAuth2
from httpx_oauth.clients.yandex import YandexOAuth2

from ..database import get_db
from .. import models, schemas

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])

# Настройки JWT
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 дней

# OAuth клиенты
google_oauth = GoogleOAuth2(
    client_id=os.getenv("GOOGLE_CLIENT_ID", ""),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET", "")
)

yandex_oauth = YandexOAuth2(
    client_id=os.getenv("YANDEX_CLIENT_ID", ""),
    client_secret=os.getenv("YANDEX_CLIENT_SECRET", "")
)

security = HTTPBearer()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Создание JWT токена"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> models.User:
    """Получение текущего пользователя из JWT токена"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Недействительный токен")
    except JWTError:
        raise HTTPException(status_code=401, detail="Недействительный токен")
    
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    
    return user


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Optional[models.User]:
    """Получение текущего пользователя (опционально)"""
    try:
        auth_header = request.headers.get("authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
            
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        
        if user_id is None:
            return None
            
        result = await db.execute(select(models.User).where(models.User.id == user_id))
        return result.scalar_one_or_none()
    except:
        return None


@router.get("/auth/google")
async def google_auth():
    """Редирект на Google OAuth"""
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
    authorization_url = await google_oauth.get_authorization_url(
        redirect_uri,
        scope=["openid", "email", "profile"]
    )
    return {"authorization_url": authorization_url}


@router.get("/auth/google/callback")
async def google_callback(code: str, db: AsyncSession = Depends(get_db)):
    """Обработка callback от Google"""
    try:
        redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
        token = await google_oauth.get_access_token(code, redirect_uri)
        user_info = await google_oauth.get_id_email(token["access_token"])
        
        # Создание или получение пользователя
        user = await get_or_create_user(
            db=db,
            email=user_info[1],  # email
            name=user_info[0].get("name", user_info[1]),  # name или email
            oauth_provider="google",
            oauth_id=user_info[0].get("sub"),
            avatar_url=user_info[0].get("picture", "")
        )
        
        # Создание JWT токена
        access_token = create_access_token(data={"sub": user.id})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "avatar_url": user.avatar_url
            }
        }
    except Exception as e:
        logger.error(f"Ошибка Google OAuth: {e}")
        raise HTTPException(status_code=400, detail="Ошибка авторизации через Google")


@router.get("/auth/yandex")
async def yandex_auth():
    """Редирект на Yandex OAuth"""
    redirect_uri = os.getenv("YANDEX_REDIRECT_URI", "http://localhost:8000/api/auth/yandex/callback")
    authorization_url = await yandex_oauth.get_authorization_url(
        redirect_uri,
        scope=["login:email", "login:info"]
    )
    return {"authorization_url": authorization_url}


@router.get("/auth/yandex/callback")
async def yandex_callback(code: str, db: AsyncSession = Depends(get_db)):
    """Обработка callback от Yandex"""
    try:
        redirect_uri = os.getenv("YANDEX_REDIRECT_URI", "http://localhost:8000/api/auth/yandex/callback")
        token = await yandex_oauth.get_access_token(code, redirect_uri)
        user_info = await yandex_oauth.get_id_email(token["access_token"])
        
        # Создание или получение пользователя
        user = await get_or_create_user(
            db=db,
            email=user_info[1],  # email
            name=user_info[0].get("display_name", user_info[1]),  # name или email
            oauth_provider="yandex",
            oauth_id=user_info[0].get("id"),
            avatar_url=user_info[0].get("default_avatar_id", "")
        )
        
        # Создание JWT токена
        access_token = create_access_token(data={"sub": user.id})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "avatar_url": user.avatar_url
            }
        }
    except Exception as e:
        logger.error(f"Ошибка Yandex OAuth: {e}")
        raise HTTPException(status_code=400, detail="Ошибка авторизации через Yandex")


async def get_or_create_user(
    db: AsyncSession,
    email: str,
    name: str,
    oauth_provider: str,
    oauth_id: str,
    avatar_url: str = ""
) -> models.User:
    """Создание или получение пользователя по OAuth данным"""
    
    # Поиск по email
    result = await db.execute(
        select(models.User).where(models.User.email == email)
    )
    user = result.scalar_one_or_none()
    
    if user:
        # Обновляем последний вход и OAuth данные
        user.last_login = datetime.utcnow()
        user.oauth_provider = oauth_provider
        user.oauth_id = oauth_id
        if avatar_url:
            user.avatar_url = avatar_url
    else:
        # Создаем нового пользователя
        user = models.User(
            email=email,
            name=name,
            oauth_provider=oauth_provider,
            oauth_id=oauth_id,
            avatar_url=avatar_url
        )
        db.add(user)
    
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/auth/me")
async def get_current_user_info(current_user: models.User = Depends(get_current_user)):
    """Получение информации о текущем пользователе"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "avatar_url": current_user.avatar_url,
        "oauth_provider": current_user.oauth_provider,
        "created_at": current_user.created_at,
        "last_login": current_user.last_login
    }


@router.post("/auth/logout")
async def logout():
    """Выход из системы (на клиенте нужно удалить токен)"""
    return {"message": "Успешный выход из системы"}
