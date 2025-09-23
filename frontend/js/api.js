/**
 * API клиент для взаимодействия с backend
 */
class ApiClient {
    constructor(baseUrl = 'http://localhost:8000') {
        this.baseUrl = baseUrl;
        this.apiUrl = `${baseUrl}/api`;
    }

    /**
     * Выполнить HTTP запрос
     */
    async request(endpoint, options = {}) {
        const url = `${this.apiUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }

            // Проверяем есть ли контент для парсинга
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return null;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    /**
     * GET запрос
     */
    async get(endpoint, params = {}) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                searchParams.append(key, value);
            }
        });
        
        const queryString = searchParams.toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        return this.request(url, { method: 'GET' });
    }

    /**
     * POST запрос
     */
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT запрос
     */
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE запрос
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // ============ Доски ============
    
    async getBoards() {
        return this.get('/boards/');
    }

    async getBoard(boardId) {
        return this.get(`/boards/${boardId}`);
    }

    async createBoard(boardData) {
        return this.post('/boards/', boardData);
    }

    async updateBoard(boardId, boardData) {
        return this.put(`/boards/${boardId}`, boardData);
    }

    async deleteBoard(boardId) {
        return this.delete(`/boards/${boardId}`);
    }

    // ============ Фичи ============
    
    async getFeatures(boardId = null) {
        const params = boardId ? { board_id: boardId } : {};
        return this.get('/features/', params);
    }

    async getFeature(featureId) {
        return this.get(`/features/${featureId}`);
    }

    async createFeature(featureData) {
        return this.post('/features/', featureData);
    }

    async updateFeature(featureId, featureData) {
        return this.put(`/features/${featureId}`, featureData);
    }

    async deleteFeature(featureId) {
        return this.delete(`/features/${featureId}`);
    }

    async reorderFeatures(featureId, newOrder) {
        return this.post(`/features/${featureId}/reorder`, { new_order: newOrder });
    }

    // ============ Спринты ============
    
    async getSprints(boardId = null) {
        const params = boardId ? { board_id: boardId } : {};
        return this.get('/sprints/', params);
    }

    async getSprint(sprintId) {
        return this.get(`/sprints/${sprintId}`);
    }

    async createSprint(sprintData) {
        return this.post('/sprints/', sprintData);
    }

    async updateSprint(sprintId, sprintData) {
        return this.put(`/sprints/${sprintId}`, sprintData);
    }

    async deleteSprint(sprintId) {
        return this.delete(`/sprints/${sprintId}`);
    }

    async getSprintCapacity(sprintId) {
        return this.get(`/sprints/${sprintId}/capacity`);
    }

    // ============ Задачи ============
    
    async getTasks(filters = {}) {
        return this.get('/tasks/', filters);
    }

    async getTask(taskId) {
        return this.get(`/tasks/${taskId}`);
    }

    async createTask(taskData) {
        return this.post('/tasks/', taskData);
    }

    async updateTask(taskId, taskData) {
        return this.put(`/tasks/${taskId}`, taskData);
    }

    async deleteTask(taskId) {
        return this.delete(`/tasks/${taskId}`);
    }

    async moveTask(moveData) {
        return this.post('/tasks/move', moveData);
    }

    async cloneTask(taskId) {
        return this.post(`/tasks/${taskId}/clone`, {});
    }

    async getUnassignedTasks(boardId) {
        return this.get('/tasks/unassigned/', { board_id: boardId });
    }

    // ============ Утилиты ============

    /**
     * Проверить подключение к API
     */
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            return response.ok;
        } catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }

    /**
     * Получить информацию о корне API
     */
    async getRoot() {
        try {
            const response = await fetch(`${this.baseUrl}/`);
            return response.ok ? await response.json() : null;
        } catch (error) {
            console.error('Root check failed:', error);
            return null;
        }
    }

    /**
     * Валидация Excel файла
     */
    async validateExcelFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${this.apiUrl}/excel-import/validate`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }

    /**
     * Импорт фич и задач из Excel файла
     */
    async importExcelFile(file, boardId, sprintId) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('board_id', boardId.toString());
        formData.append('sprint_id', sprintId.toString());
        
        const response = await fetch(`${this.apiUrl}/excel-import/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }
}

// Создаем глобальный экземпляр API клиента
window.api = new ApiClient();

// Проверяем подключение при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    const apiStatus = document.getElementById('apiStatus');
    if (apiStatus) {
        try {
            const isHealthy = await window.api.checkHealth();
            apiStatus.innerHTML = isHealthy ? 'API: 🟢' : 'API: 🔴';
            apiStatus.className = isHealthy ? 'status-indicator online' : 'status-indicator offline';
            
            if (!isHealthy) {
                console.warn('API сервер недоступен. Убедитесь что backend запущен на http://localhost:8000');
            }
        } catch (error) {
            apiStatus.innerHTML = 'API: 🔴';
            apiStatus.className = 'status-indicator offline';
            console.error('Не удалось проверить статус API:', error);
        }
    }
});

/**
 * Утилиты для обработки ошибок API
 */
window.ApiUtils = {
    /**
     * Показать уведомление об ошибке API
     */
    showApiError(error, context = '') {
        const message = error.message || 'Неизвестная ошибка API';
        const title = context ? `Ошибка ${context}` : 'Ошибка API';
        
        if (window.NotificationManager) {
            window.NotificationManager.show(title, message, 'error');
        } else {
            alert(`${title}: ${message}`);
        }
        
        console.error(`API Error${context ? ` (${context})` : ''}:`, error);
    },

    /**
     * Показать уведомление об успехе
     */
    showSuccess(message, title = 'Успех') {
        if (window.NotificationManager) {
            window.NotificationManager.show(title, message, 'success');
        } else {
            console.log(`${title}: ${message}`);
        }
    },

    /**
     * Обработать ошибки валидации
     */
    handleValidationError(error) {
        if (error.message && error.message.includes('validation')) {
            return 'Ошибка валидации данных. Проверьте корректность введенных значений.';
        }
        return error.message;
    },

    /**
     * Форматировать данные задачи для отправки
     */
    formatTaskData(formData) {
        return {
            name: formData.name?.trim(),
            feature_id: parseInt(formData.feature_id),
            sprint_id: formData.sprint_id ? parseInt(formData.sprint_id) : null,
            estimate_ios: parseFloat(formData.estimate_ios) || 0,
            estimate_android: parseFloat(formData.estimate_android) || 0,
            estimate_qa: parseFloat(formData.estimate_qa) || 0,
            estimate_sa: parseFloat(formData.estimate_sa) || 0,
            color: formData.color || '#ffeb3b',
            position_x: parseFloat(formData.position_x) || 0,
            position_y: parseFloat(formData.position_y) || 0,
            enabler_title: formData.enabler_title || '',
            enabler_active: true, // Всегда активен
            is_collapsed_feature: formData.is_collapsed_feature || false,
            original_feature_tasks: formData.original_feature_tasks || null
        };
    },

    /**
     * Форматировать данные спринта для отправки
     */
    formatSprintData(formData) {
        return {
            board_id: parseInt(formData.board_id),
            number: parseInt(formData.number),
            capacity_ios: parseFloat(formData.capacity_ios) || 0,
            capacity_android: parseFloat(formData.capacity_android) || 0,
            capacity_qa: parseFloat(formData.capacity_qa) || 0,
            capacity_sa: parseFloat(formData.capacity_sa) || 0
        };
    },

    /**
     * Форматировать данные фичи для отправки
     */
    formatFeatureData(formData) {
        return {
            board_id: parseInt(formData.board_id),
            name: formData.name?.trim(),
            order: parseInt(formData.order) || 0
        };
    }
};
