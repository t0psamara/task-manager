/**
 * WebSocket клиент для real-time обновлений
 */
class WebSocketClient {
    constructor(baseUrl = null) {
        // Автоматически определяем базовый URL на основе текущего хоста
        if (!baseUrl) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname;
            const port = '8000'; // Порт API сервера
            baseUrl = `${protocol}//${host}:${port}`;
        }
        this.baseUrl = baseUrl;
        this.socket = null;
        this.boardId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // начальная задержка в мс
        this.isConnected = false;
        this.messageHandlers = new Map();
        this.statusElement = document.getElementById('wsStatus');
        
        this.setupEventHandlers();
    }

    /**
     * Подключиться к WebSocket для конкретной доски
     */
    connect(boardId) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.disconnect();
        }

        this.boardId = boardId;
        const url = `${this.baseUrl}/ws/${boardId}`;
        
        try {
            this.socket = new WebSocket(url);
            this.setupSocketEventHandlers();
            this.updateStatus('connecting');
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.updateStatus('error');
        }
    }

    /**
     * Отключиться от WebSocket
     */
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.isConnected = false;
        this.boardId = null;
        this.updateStatus('disconnected');
    }

    /**
     * Настроить обработчики событий WebSocket
     */
    setupSocketEventHandlers() {
        if (!this.socket) return;

        this.socket.onopen = (event) => {
            console.log('WebSocket connected:', event);
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.updateStatus('connected');
            
            // Уведомляем о подключении
            this.handleMessage({
                type: 'connection',
                data: { status: 'connected', boardId: this.boardId }
            });
        };

        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('WebSocket message received:', message);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error, event.data);
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateStatus('error');
        };

        this.socket.onclose = (event) => {
            console.log('WebSocket closed:', event);
            this.isConnected = false;
            this.updateStatus('disconnected');
            
            // Автоматическое переподключение если соединение было закрыто неожиданно
            if (event.code !== 1000 && this.boardId) { // 1000 = нормальное закрытие
                this.scheduleReconnect();
            }
        };
    }

    /**
     * Запланировать переподключение
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Максимальное количество попыток переподключения достигнуто');
            this.updateStatus('failed');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // экспоненциальная задержка
        
        console.log(`Переподключение через ${delay}ms (попытка ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.updateStatus('reconnecting');
        
        setTimeout(() => {
            if (this.boardId) {
                this.connect(this.boardId);
            }
        }, delay);
    }

    /**
     * Отправить сообщение через WebSocket
     */
    send(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            try {
                const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
                this.socket.send(messageStr);
                return true;
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
                return false;
            }
        } else {
            console.warn('WebSocket не подключен. Сообщение не отправлено:', message);
            return false;
        }
    }

    /**
     * Обработать входящее сообщение
     */
    handleMessage(message) {
        const { type, data, board_id } = message;
        
        // Проверяем что сообщение для текущей доски
        if (board_id && board_id !== this.boardId) {
            return;
        }

        // Вызываем зарегистрированные обработчики
        if (this.messageHandlers.has(type)) {
            const handlers = this.messageHandlers.get(type);
            handlers.forEach(handler => {
                try {
                    handler(data, message);
                } catch (error) {
                    console.error(`Error in message handler for type '${type}':`, error);
                }
            });
        }

        // Обработчики по умолчанию
        switch (type) {
            case 'task_created':
                this.handleTaskCreated(data);
                break;
            case 'task_updated':
                this.handleTaskUpdated(data);
                break;
            case 'task_deleted':
                this.handleTaskDeleted(data);
                break;
            case 'task_moved':
                this.handleTaskMoved(data);
                break;
            case 'feature_created':
                this.handleFeatureCreated(data);
                break;
            case 'feature_updated':
                this.handleFeatureUpdated(data);
                break;
            case 'sprint_created':
                this.handleSprintCreated(data);
                break;
            case 'sprint_updated':
                this.handleSprintUpdated(data);
                break;
            case 'user_joined':
                this.handleUserJoined(data);
                break;
            case 'user_left':
                this.handleUserLeft(data);
                break;
        }
    }

    /**
     * Зарегистрировать обработчик сообщений
     */
    on(messageType, handler) {
        if (!this.messageHandlers.has(messageType)) {
            this.messageHandlers.set(messageType, []);
        }
        this.messageHandlers.get(messageType).push(handler);
    }

    /**
     * Удалить обработчик сообщений
     */
    off(messageType, handler) {
        if (this.messageHandlers.has(messageType)) {
            const handlers = this.messageHandlers.get(messageType);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Обновить статус подключения в UI
     */
    updateStatus(status) {
        if (!this.statusElement) return;

        let indicator = '⚫';
        let text = 'WebSocket: Неизвестно';
        let className = 'status-indicator';

        switch (status) {
            case 'connecting':
                indicator = '🟡';
                text = 'WebSocket: Подключение...';
                className = 'status-indicator connecting';
                break;
            case 'connected':
                indicator = '🟢';
                text = 'WebSocket: Подключен';
                className = 'status-indicator online';
                break;
            case 'disconnected':
                indicator = '⚫';
                text = 'WebSocket: Отключен';
                className = 'status-indicator offline';
                break;
            case 'reconnecting':
                indicator = '🟡';
                text = `WebSocket: Переподключение... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
                className = 'status-indicator reconnecting';
                break;
            case 'error':
                indicator = '🔴';
                text = 'WebSocket: Ошибка';
                className = 'status-indicator error';
                break;
            case 'failed':
                indicator = '🔴';
                text = 'WebSocket: Не удалось подключиться';
                className = 'status-indicator failed';
                break;
        }

        this.statusElement.innerHTML = text;
        this.statusElement.className = className;
    }

    /**
     * Настроить обработчики для интеграции с BoardManager
     */
    setupEventHandlers() {
        // Эти методы будут переопределены в board.js
        this.handleTaskCreated = (data) => {
            console.log('Task created:', data);
        };

        this.handleTaskUpdated = (data) => {
            console.log('Task updated:', data);
        };

        this.handleTaskDeleted = (data) => {
            console.log('Task deleted:', data);
        };

        this.handleTaskMoved = (data) => {
            console.log('Task moved:', data);
        };

        this.handleFeatureCreated = (data) => {
            console.log('Feature created:', data);
        };

        this.handleFeatureUpdated = (data) => {
            console.log('Feature updated:', data);
        };

        this.handleSprintCreated = (data) => {
            console.log('Sprint created:', data);
        };

        this.handleSprintUpdated = (data) => {
            console.log('Sprint updated:', data);
        };

        this.handleUserJoined = (data) => {
            console.log('User joined:', data);
        };

        this.handleUserLeft = (data) => {
            console.log('User left:', data);
        };
    }

    /**
     * Проверить статус подключения
     */
    isReady() {
        return this.socket && this.socket.readyState === WebSocket.OPEN && this.isConnected;
    }

    /**
     * Получить информацию о подключении
     */
    getConnectionInfo() {
        return {
            isConnected: this.isConnected,
            boardId: this.boardId,
            reconnectAttempts: this.reconnectAttempts,
            readyState: this.socket ? this.socket.readyState : null
        };
    }
}

// Создаем глобальный экземпляр WebSocket клиента
window.wsClient = new WebSocketClient();

// Утилиты для работы с WebSocket
window.WebSocketUtils = {
    /**
     * Подключиться к доске
     */
    connectToBoard(boardId) {
        if (!boardId) {
            console.warn('Board ID не указан для WebSocket подключения');
            return false;
        }
        
        window.wsClient.connect(boardId);
        return true;
    },

    /**
     * Отключиться от текущей доски
     */
    disconnect() {
        window.wsClient.disconnect();
    },

    /**
     * Отправить сообщение о начале редактирования задачи
     */
    sendTaskEditStart(taskId) {
        return window.wsClient.send({
            type: 'task_edit_start',
            data: { task_id: taskId },
            board_id: window.wsClient.boardId
        });
    },

    /**
     * Отправить сообщение об окончании редактирования задачи
     */
    sendTaskEditEnd(taskId) {
        return window.wsClient.send({
            type: 'task_edit_end',
            data: { task_id: taskId },
            board_id: window.wsClient.boardId
        });
    },

    /**
     * Отправить ping для поддержания соединения
     */
    sendPing() {
        return window.wsClient.send({
            type: 'ping',
            timestamp: Date.now()
        });
    }
};

// Периодический ping для поддержания соединения
setInterval(() => {
    if (window.wsClient.isReady()) {
        window.WebSocketUtils.sendPing();
    }
}, 30000); // каждые 30 секунд
