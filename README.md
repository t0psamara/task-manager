# Task Manager - Интерактивная доска планирования

Система для планирования задач с поддержкой drag-and-drop, real-time синхронизации и расчета емкости по командам.

## 🚀 Функциональность

- ✅ Интерактивная доска с фичами и спринтами
- ✅ Drag-and-drop стикеров между ячейками  
- ✅ Автоматический расчет емкости по командам (iOS, Android, QA, SA)
- ✅ Real-time обновления через WebSocket
- ✅ Цветовая индикация загруженности спринтов
- ⏳ Undo/Redo функциональность (планируется)
- ⏳ Экспорт данных (планируется)

## 🏗️ Архитектура

**Backend:**
- FastAPI (Python) - REST API + WebSocket
- PostgreSQL - база данных
- SQLAlchemy ORM - для работы с БД
- Pydantic - валидация данных

**Frontend:** (в разработке)
- Vanilla JS + HTML/CSS
- SortableJS для drag-and-drop
- WebSocket клиент

## 📦 Установка и запуск

### Через Docker (рекомендуется)

```bash
# Клонировать репозиторий
git clone <repository-url>
cd task-manager

# Создать .env файл
cp backend/.env.example backend/.env
# Отредактировать переменные окружения при необходимости

# Запустить через Docker Compose
docker-compose up
```

### Локально

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # На Windows: venv\\Scripts\\activate
pip install -r requirements.txt

# Создать .env файл с переменными:
echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/task_manager" > .env

# Запустить PostgreSQL (например, через Docker)
docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15

# Запустить сервер
uvicorn app.main:app --reload
```

## 🔗 API Endpoints

API доступно по адресу: `http://localhost:8000`

### Основные эндпоинты:

**Доски:**
- `GET /api/boards/` - получить все доски
- `POST /api/boards/` - создать доску
- `GET /api/boards/{id}` - получить доску с данными

**Фичи:**
- `GET /api/features/?board_id=1` - получить фичи доски
- `POST /api/features/` - создать фичу

**Спринты:**
- `GET /api/sprints/?board_id=1` - получить спринты доски  
- `POST /api/sprints/` - создать спринт
- `GET /api/sprints/{id}/capacity` - получить информацию о емкости

**Задачи:**
- `GET /api/tasks/?board_id=1` - получить задачи
- `POST /api/tasks/` - создать задачу
- `PUT /api/tasks/{id}` - обновить задачу
- `POST /api/tasks/move` - переместить задачу

**WebSocket:**
- `ws://localhost:8000/ws/{board_id}` - real-time обновления

### Документация API
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🗄️ Структура базы данных

```sql
boards (id, name, created_at)
├── features (id, board_id, name, order)
│   └── tasks (id, feature_id, sprint_id, name, estimates, position, color)
├── sprints (id, board_id, number, capacity_ios, capacity_android, capacity_qa, capacity_sa)  
└── history (id, board_id, action_type, data, timestamp)
```

## 📋 Примеры использования

### Создание доски:
```bash
curl -X POST "http://localhost:8000/api/boards/" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Моя доска планирования"}'
```

### Создание спринта:
```bash  
curl -X POST "http://localhost:8000/api/sprints/" \\
  -H "Content-Type: application/json" \\
  -d '{
    "board_id": 1,
    "number": 1,
    "capacity_ios": 10.0,
    "capacity_android": 8.0,
    "capacity_qa": 5.0,
    "capacity_sa": 3.0
  }'
```

### Создание фичи:
```bash
curl -X POST "http://localhost:8000/api/features/" \\
  -H "Content-Type: application/json" \\
  -d '{"board_id": 1, "name": "Авторизация пользователей", "order": 1}'
```

### Создание задачи:
```bash
curl -X POST "http://localhost:8000/api/tasks/" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Реализовать логин",
    "feature_id": 1,
    "sprint_id": 1,
    "estimate_ios": 2.0,
    "estimate_android": 3.0,
    "estimate_qa": 1.0,
    "color": "#ffeb3b"
  }'
```

## 🎯 Следующие этапы

1. **Frontend разработка** - создание интерактивного UI
2. **WebSocket интеграция** - real-time обновления  
3. **Drag-and-drop** - перемещение стикеров
4. **Undo/Redo** - история изменений
5. **Экспорт данных** - выгрузка в различных форматах

## 🔧 Разработка

```bash
# Запуск тестов
cd backend
pytest

# Форматирование кода
black app/
isort app/

# Проверка типов
mypy app/
```

## 📝 Модель данных

Каждая **задача** содержит оценки по командам:
- `estimate_ios` - оценка для iOS разработки
- `estimate_android` - оценка для Android разработки  
- `estimate_qa` - оценка для QA тестирования
- `estimate_sa` - оценка для системного анализа

**Спринт** имеет емкость по каждой команде, система автоматически:
- ✅ Рассчитывает использованную емкость
- ✅ Показывает доступную емкость  
- ✅ Индикацию перегрузки (красный/зеленый)
