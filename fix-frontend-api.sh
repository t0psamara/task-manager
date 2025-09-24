#!/bin/bash

# Исправление API подключения во frontend

echo "🔧 ИСПРАВЛЕНИЕ FRONTEND API ПОДКЛЮЧЕНИЯ"
echo "======================================="

# 1. Проверяем текущие API настройки
echo "1️⃣  ДИАГНОСТИКА API НАСТРОЕК"
cd /var/www/html/taskmanager/js

echo "Текущие настройки в api.js:"
grep -n "localhost\|8000\|baseUrl\|apiUrl" api.js | head -5

echo ""
echo "Текущие настройки в websocket.js:"
grep -n "localhost\|8000\|ws://" websocket.js | head -3

# 2. Исправляем api.js для работы с относительными путями
echo ""
echo "2️⃣  ИСПРАВЛЕНИЕ API.JS"

# Создаем backup
cp api.js api.js.backup.$(date +%s)

# Исправляем API класс
cat > api.js << 'EOF'
// Task Manager API Client - исправленная версия
class TaskManagerAPI {
    constructor(baseUrl = '') {
        // Используем относительные пути
        this.baseUrl = baseUrl;
        this.apiUrl = '/api';
        this.timeout = 10000;
    }

    async request(endpoint, options = {}) {
        const url = `${this.apiUrl}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            timeout: this.timeout,
        };

        const finalOptions = { ...defaultOptions, ...options };
        
        // Добавляем CORS заголовки
        if (finalOptions.headers) {
            finalOptions.headers['Access-Control-Allow-Origin'] = '*';
        }

        try {
            console.log('API Request:', url, finalOptions);
            const response = await fetch(url, finalOptions);
            
            if (!response.ok) {
                console.error('API Error:', response.status, response.statusText);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('API Response:', data);
            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Boards API
    async getBoards() {
        return this.request('/boards');
    }

    async createBoard(boardData) {
        return this.request('/boards', {
            method: 'POST',
            body: JSON.stringify(boardData)
        });
    }

    async updateBoard(boardId, boardData) {
        return this.request(`/boards/${boardId}`, {
            method: 'PUT',
            body: JSON.stringify(boardData)
        });
    }

    async deleteBoard(boardId) {
        return this.request(`/boards/${boardId}`, {
            method: 'DELETE'
        });
    }

    // Features API
    async getFeatures(boardId) {
        return this.request(`/boards/${boardId}/features`);
    }

    async createFeature(boardId, featureData) {
        return this.request(`/boards/${boardId}/features`, {
            method: 'POST',
            body: JSON.stringify(featureData)
        });
    }

    async updateFeature(featureId, featureData) {
        return this.request(`/features/${featureId}`, {
            method: 'PUT',
            body: JSON.stringify(featureData)
        });
    }

    async deleteFeature(featureId) {
        return this.request(`/features/${featureId}`, {
            method: 'DELETE'
        });
    }

    // Sprints API
    async getSprints(boardId) {
        return this.request(`/boards/${boardId}/sprints`);
    }

    async createSprint(boardId, sprintData) {
        return this.request(`/boards/${boardId}/sprints`, {
            method: 'POST',
            body: JSON.stringify(sprintData)
        });
    }

    async updateSprint(sprintId, sprintData) {
        return this.request(`/sprints/${sprintId}`, {
            method: 'PUT',
            body: JSON.stringify(sprintData)
        });
    }

    async deleteSprint(sprintId) {
        return this.request(`/sprints/${sprintId}`, {
            method: 'DELETE'
        });
    }

    // Tasks API
    async getTasks(sprintId) {
        return this.request(`/sprints/${sprintId}/tasks`);
    }

    async createTask(sprintId, taskData) {
        return this.request(`/sprints/${sprintId}/tasks`, {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
    }

    async updateTask(taskId, taskData) {
        return this.request(`/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(taskData)
        });
    }

    async deleteTask(taskId) {
        return this.request(`/tasks/${taskId}`, {
            method: 'DELETE'
        });
    }

    async updateTaskPosition(taskId, positionData) {
        return this.request(`/tasks/${taskId}/position`, {
            method: 'PUT',
            body: JSON.stringify(positionData)
        });
    }

    // Excel Import API
    async validateExcelFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/excel-import/validate', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    }

    async uploadExcelFile(file, mapping) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('mapping', JSON.stringify(mapping));
        
        const response = await fetch('/api/excel-import/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    }

    // Health check
    async healthCheck() {
        try {
            const response = await fetch('/health');
            return response.ok;
        } catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }
}

// Глобальный экземпляр API
window.api = new TaskManagerAPI();

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskManagerAPI;
}
EOF

echo "✅ api.js исправлен"

# 3. Исправляем websocket.js
echo ""
echo "3️⃣  ИСПРАВЛЕНИЕ WEBSOCKET.JS"

# Создаем backup
cp websocket.js websocket.js.backup.$(date +%s)

# Исправляем WebSocket подключение
cat > websocket.js << 'EOF'
// WebSocket Manager для Task Manager - исправленная версия
class WebSocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.callbacks = {};
        
        // Используем относительный путь для WebSocket
        this.wsUrl = this.getWebSocketUrl();
        console.log('WebSocket URL:', this.wsUrl);
    }
    
    getWebSocketUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}/ws/1`; // board_id = 1 по умолчанию
    }
    
    connect(boardId = 1) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            console.log('WebSocket уже подключен');
            return;
        }
        
        const wsUrl = this.getWebSocketUrl().replace('/ws/1', `/ws/${boardId}`);
        console.log('Подключение к WebSocket:', wsUrl);
        
        try {
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = (event) => {
                console.log('WebSocket подключен:', event);
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
                this.triggerCallback('open', event);
            };
            
            this.socket.onmessage = (event) => {
                console.log('WebSocket сообщение:', event.data);
                try {
                    const data = JSON.parse(event.data);
                    this.triggerCallback('message', data);
                } catch (error) {
                    console.error('Ошибка парсинга WebSocket сообщения:', error);
                }
            };
            
            this.socket.onclose = (event) => {
                console.log('WebSocket отключен:', event);
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.triggerCallback('close', event);
                
                // Автоматическое переподключение
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    setTimeout(() => {
                        this.reconnectAttempts++;
                        console.log(`Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                        this.connect(boardId);
                    }, this.reconnectDelay * this.reconnectAttempts);
                }
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket ошибка:', error);
                this.updateConnectionStatus(false);
                this.triggerCallback('error', error);
            };
            
        } catch (error) {
            console.error('Ошибка создания WebSocket:', error);
            this.updateConnectionStatus(false);
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.isConnected = false;
        this.updateConnectionStatus(false);
    }
    
    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const message = JSON.stringify(data);
            console.log('Отправка WebSocket сообщения:', message);
            this.socket.send(message);
        } else {
            console.warn('WebSocket не подключен, не могу отправить:', data);
        }
    }
    
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }
    
    off(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
        }
    }
    
    triggerCallback(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Ошибка в WebSocket callback для события ${event}:`, error);
                }
            });
        }
    }
    
    updateConnectionStatus(connected) {
        const statusElement = document.querySelector('#websocket-status, .websocket-status, [data-status="websocket"]');
        if (statusElement) {
            statusElement.textContent = connected ? 'Подключен' : 'Отключен';
            statusElement.className = connected ? 'status-connected' : 'status-disconnected';
            statusElement.style.color = connected ? '#28a745' : '#dc3545';
        }
        
        // Обновляем глобальный статус
        window.websocketConnected = connected;
    }
}

// Глобальный экземпляр WebSocket
window.wsManager = new WebSocketManager();

// Автоматическое подключение при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('Инициализация WebSocket...');
    
    // Подключаемся через небольшую задержку, чтобы дать время API проверке
    setTimeout(() => {
        window.wsManager.connect();
    }, 1000);
});

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketManager;
}
EOF

echo "✅ websocket.js исправлен"

# 4. Проверяем и исправляем app.js для правильной работы с API
echo ""
echo "4️⃣  ПРОВЕРКА APP.JS"

# Ищем проблемные места в app.js
echo "Поиск API вызовов в app.js:"
grep -n "localhost\|8000\|fetch\|api\." app.js | head -5

# 5. Создаем простую страницу для тестирования API
echo ""
echo "5️⃣  СОЗДАНИЕ ТЕСТОВОЙ СТРАНИЦЫ API"

cat > /var/www/html/taskmanager/test-api-simple.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>API Test - Simple</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .connected { background: #d4edda; color: #155724; }
        .disconnected { background: #f8d7da; color: #721c24; }
        button { padding: 8px 16px; margin: 5px; cursor: pointer; }
        #log { background: #f8f9fa; padding: 10px; border: 1px solid #dee2e6; border-radius: 5px; max-height: 300px; overflow-y: auto; }
    </style>
</head>
<body>
    <h1>🧪 Task Manager API Test</h1>
    
    <div class="status disconnected" id="api-status">API: Не проверен</div>
    <div class="status disconnected" id="ws-status">WebSocket: Не подключен</div>
    
    <div>
        <button onclick="testAPI()">Test API</button>
        <button onclick="testWebSocket()">Test WebSocket</button>
        <button onclick="testCreateBoard()">Test Create Board</button>
        <button onclick="clearLog()">Clear Log</button>
    </div>
    
    <h3>Log:</h3>
    <div id="log"></div>
    
    <script src="js/api.js"></script>
    <script src="js/websocket.js"></script>
    
    <script>
        function log(message) {
            const logDiv = document.getElementById('log');
            const timestamp = new Date().toLocaleTimeString();
            logDiv.innerHTML += `<div>[${timestamp}] ${message}</div>`;
            logDiv.scrollTop = logDiv.scrollHeight;
        }
        
        function clearLog() {
            document.getElementById('log').innerHTML = '';
        }
        
        async function testAPI() {
            log('🔍 Тестирование API...');
            
            try {
                // Test 1: Health check
                const isHealthy = await window.api.healthCheck();
                log(`Health check: ${isHealthy ? '✅ OK' : '❌ Failed'}`);
                
                if (isHealthy) {
                    document.getElementById('api-status').textContent = 'API: Подключен';
                    document.getElementById('api-status').className = 'status connected';
                }
                
                // Test 2: Get boards
                const boards = await window.api.getBoards();
                log(`Boards: ${boards.length} найдено`);
                
                // Test 3: API info
                const response = await fetch('/info');
                const info = await response.json();
                log(`API Info: ${info.app_name} v${info.version}`);
                
            } catch (error) {
                log(`❌ API Error: ${error.message}`);
                document.getElementById('api-status').textContent = 'API: Ошибка';
                document.getElementById('api-status').className = 'status disconnected';
            }
        }
        
        function testWebSocket() {
            log('🔌 Тестирование WebSocket...');
            
            // Обновляем статус
            function updateWSStatus() {
                const connected = window.wsManager && window.wsManager.isConnected;
                document.getElementById('ws-status').textContent = `WebSocket: ${connected ? 'Подключен' : 'Отключен'}`;
                document.getElementById('ws-status').className = connected ? 'status connected' : 'status disconnected';
            }
            
            // Слушаем события WebSocket
            window.wsManager.on('open', () => {
                log('✅ WebSocket подключен');
                updateWSStatus();
            });
            
            window.wsManager.on('close', () => {
                log('❌ WebSocket отключен');
                updateWSStatus();
            });
            
            window.wsManager.on('error', (error) => {
                log(`❌ WebSocket ошибка: ${error}`);
                updateWSStatus();
            });
            
            // Переподключаемся
            window.wsManager.connect();
            updateWSStatus();
        }
        
        async function testCreateBoard() {
            log('📋 Тестирование создания доски...');
            
            try {
                const boardData = {
                    name: `Test Board ${Date.now()}`,
                    description: 'Test board created from API test page'
                };
                
                const newBoard = await window.api.createBoard(boardData);
                log(`✅ Доска создана: ID ${newBoard.id}, Name: ${newBoard.name}`);
                
                // Обновляем список досок
                const boards = await window.api.getBoards();
                log(`📊 Всего досок: ${boards.length}`);
                
            } catch (error) {
                log(`❌ Ошибка создания доски: ${error.message}`);
            }
        }
        
        // Автоматический тест при загрузке
        document.addEventListener('DOMContentLoaded', async () => {
            log('🚀 Страница загружена, запуск автотестов...');
            
            // Ждем загрузки API
            setTimeout(async () => {
                await testAPI();
                setTimeout(testWebSocket, 1000);
            }, 500);
        });
    </script>
</body>
</html>
EOF

chown www-data:www-data /var/www/html/taskmanager/test-api-simple.html

echo "✅ Тестовая страница создана"

# 6. Установка правильных прав доступа
echo ""
echo "6️⃣  УСТАНОВКА ПРАВ ДОСТУПА"
chown -R www-data:www-data /var/www/html/taskmanager/
chmod -R 644 /var/www/html/taskmanager/js/*
chmod 755 /var/www/html/taskmanager/js/

echo "✅ Права доступа установлены"

# 7. Тест API подключения
echo ""
echo "7️⃣  ТЕСТ API ПОДКЛЮЧЕНИЯ"

echo "Backend health:"
curl -s http://localhost:8000/health

echo ""
echo "API через nginx:"
curl -s http://localhost/health

echo ""
echo "API boards через nginx:"
curl -s http://localhost/api/boards

echo ""
echo "🎯 ЗАВЕРШЕНО!"
echo "============="
echo ""
echo "📍 Откройте для тестирования:"
echo "   🧪 Test Page: http://194.87.118.34/test-api-simple.html"
echo "   🌐 Main App:  http://194.87.118.34"
echo ""
echo "🔍 Если проблемы остались:"
echo "   1. Откройте F12 -> Console в браузере"
echo "   2. Посмотрите ошибки JavaScript"
echo "   3. Проверьте Network tab на заблокированные запросы"
echo ""
echo "📊 Исправленные файлы:"
echo "   ✅ /var/www/html/taskmanager/js/api.js"
echo "   ✅ /var/www/html/taskmanager/js/websocket.js"
echo "   ✅ Создана тестовая страница"
