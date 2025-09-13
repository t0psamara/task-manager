/**
 * Основной файл приложения
 * Управляет модальными окнами, уведомлениями и общими функциями
 */

// ============ Менеджер уведомлений ============
class NotificationManager {
    constructor() {
        this.container = document.getElementById('notifications');
        this.notifications = new Map();
        this.autoHideTimeout = 5000; // 5 секунд
    }

    show(title, message, type = 'info', duration = this.autoHideTimeout) {
        const id = this.generateId();
        const notification = this.createNotificationElement(id, title, message, type);
        
        this.container.appendChild(notification);
        this.notifications.set(id, notification);

        // Анимация появления
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Автоматическое скрытие
        if (duration > 0) {
            setTimeout(() => {
                this.hide(id);
            }, duration);
        }

        return id;
    }

    hide(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        notification.classList.remove('show');
        notification.classList.add('hiding');

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            this.notifications.delete(id);
        }, 300);
    }

    createNotificationElement(id, title, message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.dataset.id = id;

        const icon = this.getIconForType(type);
        
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${icon}</div>
                <div class="notification-text">
                    <div class="notification-title">${title}</div>
                    <div class="notification-message">${message}</div>
                </div>
                <button class="notification-close" onclick="window.NotificationManager.hide('${id}')">&times;</button>
            </div>
        `;

        return notification;
    }

    getIconForType(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    generateId() {
        return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    clear() {
        this.notifications.forEach((notification, id) => {
            this.hide(id);
        });
    }
}

// ============ Менеджер модальных окон ============
class ModalManager {
    constructor() {
        this.activeModal = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Закрытие по клику на overlay
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hide();
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.hide();
            }
        });

        // Кнопки закрытия
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-close') || 
                e.target.classList.contains('modal-cancel')) {
                this.hide();
            }
        });
    }

    show(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal with id "${modalId}" not found`);
            return false;
        }

        // Закрываем предыдущий модал
        if (this.activeModal) {
            this.hide();
        }

        this.activeModal = modal;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Блокируем скролл

        // Фокус на первый input
        const firstInput = modal.querySelector('input, textarea, select');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }

        return true;
    }

    hide() {
        if (!this.activeModal) return;

        this.activeModal.classList.remove('active');
        document.body.style.overflow = ''; // Восстанавливаем скролл
        
        // Очищаем формы
        const forms = this.activeModal.querySelectorAll('form');
        forms.forEach(form => form.reset());
        
        this.activeModal = null;
    }

    isOpen() {
        return !!this.activeModal;
    }

    getCurrentModal() {
        return this.activeModal;
    }
}

// ============ Менеджер модальных форм ============
class FormModalManager {
    constructor() {
        this.setupFormHandlers();
    }

    setupFormHandlers() {
        // Обработчик создания доски
        const createBoardBtn = document.getElementById('createBoard');
        const boardForm = document.getElementById('boardForm');
        
        createBoardBtn?.addEventListener('click', () => {
            window.ModalManager.show('boardModal');
        });

        boardForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleBoardCreate(new FormData(boardForm));
        });

        // Обработчик создания фичи
        const addFeatureBtn = document.getElementById('addFeature');
        const featureForm = document.getElementById('featureForm');
        
        addFeatureBtn?.addEventListener('click', () => {
            if (!window.boardManager?.currentBoard) {
                window.NotificationManager.show('Ошибка', 'Сначала выберите доску', 'warning');
                return;
            }
            window.ModalManager.show('featureModal');
        });

        featureForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFeatureCreate(new FormData(featureForm));
        });

        // Обработчик редактирования спринта (убрали создание спринтов)
        const sprintEditForm = document.getElementById('sprintEditForm');
        sprintEditForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSprintEdit(new FormData(sprintEditForm));
        });

        // Обработчик формы задачи
        const taskForm = document.getElementById('taskForm');
        taskForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleTaskSubmit(new FormData(taskForm));
        });

        // Цветовая палитра для задач
        this.setupColorPicker();
    }

    async handleBoardCreate(formData) {
        try {
            const boardData = {
                name: formData.get('name').trim()
            };

            if (!boardData.name) {
                window.NotificationManager.show('Ошибка', 'Название доски не может быть пустым', 'error');
                return;
            }

            const newBoard = await window.api.createBoard(boardData);
            // Убрали уведомление об успехе
            
            // Обновляем список досок и выбираем новую
            await window.boardManager.loadBoards();
            window.boardManager.boardSelect.value = newBoard.id;
            await window.boardManager.loadBoard(newBoard.id);
            
            window.ModalManager.hide();

        } catch (error) {
            console.error('Error creating board:', error);
            window.ApiUtils.showApiError(error, 'создания доски');
        }
    }

    async handleFeatureCreate(formData) {
        try {
            const featureData = {
                board_id: window.boardManager.currentBoard.id,
                name: formData.get('name').trim(),
                order: window.boardManager.features.length
            };

            if (!featureData.name) {
                window.NotificationManager.show('Ошибка', 'Название фичи не может быть пустым', 'error');
                return;
            }

            const newFeature = await window.api.createFeature(featureData);
            // Убрали уведомление об успехе
            
            // Записываем в историю
            window.HistoryUtils.recordFeatureCreate(newFeature);
            
            // Добавляем на доску
            window.boardManager.addFeatureToBoard(newFeature);
            
            window.ModalManager.hide();

        } catch (error) {
            console.error('Error creating feature:', error);
            window.ApiUtils.showApiError(error, 'создания фичи');
        }
    }

    async handleSprintEdit(formData) {
        if (!window.SprintEditModal?.currentSprint) {
            window.NotificationManager.show('Ошибка', 'Спринт для редактирования не выбран', 'error');
            return;
        }

        try {
            const sprintId = window.SprintEditModal.currentSprint.id;
            const sprintData = {
                capacity_ios: parseFloat(formData.get('capacity_ios')) || 0,
                capacity_android: parseFloat(formData.get('capacity_android')) || 0,
                capacity_qa: parseFloat(formData.get('capacity_qa')) || 0,
                capacity_sa: parseFloat(formData.get('capacity_sa')) || 0,
                description: formData.get('description') || '',
                badge1_text: formData.get('badge1_text') || '',
                badge1_color: formData.get('badge1_color') || 'blue',
                badge1_tooltip: formData.get('badge1_tooltip') || '',
                badge2_text: formData.get('badge2_text') || '',
                badge2_color: formData.get('badge2_color') || 'blue',
                badge2_tooltip: formData.get('badge2_tooltip') || ''
            };

            const oldSprint = window.SprintEditModal.currentSprint;
            const updatedSprint = await window.api.updateSprint(sprintId, sprintData);
            
            // Записываем в историю
            window.HistoryUtils.recordSprintUpdate(sprintId, oldSprint, updatedSprint);
            
            // Убрали уведомление об успехе обновления спринта
            
            // Обновляем спринт в локальных данных
            const sprintIndex = window.boardManager.sprints.findIndex(s => s.id === sprintId);
            if (sprintIndex > -1) {
                window.boardManager.sprints[sprintIndex] = updatedSprint;
            }
            
            // Перерисовываем заголовки спринтов
            window.boardManager.renderSprintHeaders();
            
            window.ModalManager.hide();

        } catch (error) {
            console.error('Error updating sprint:', error);
            window.ApiUtils.showApiError(error, 'обновления спринта');
        }
    }

    async handleTaskSubmit(formData) {
        try {
            const isEdit = window.TaskModal.currentTask !== null;
            const taskData = window.ApiUtils.formatTaskData({
                name: formData.get('name'),
                feature_id: formData.get('feature_id') || window.TaskModal.defaultFeatureId,
                sprint_id: formData.get('sprint_id') || null,
                estimate_ios: formData.get('estimate_ios'),
                estimate_android: formData.get('estimate_android'),
                estimate_qa: formData.get('estimate_qa'),
                estimate_sa: formData.get('estimate_sa'),
                color: formData.get('color')
            });

            if (!taskData.name?.trim()) {
                window.NotificationManager.show('Ошибка', 'Название задачи не может быть пустым', 'error');
                return;
            }

            if (!taskData.feature_id) {
                window.NotificationManager.show('Ошибка', 'Выберите фичу для задачи', 'error');
                return;
            }

            if (isEdit) {
                const oldTask = window.TaskModal.currentTask;
                const updatedTask = await window.api.updateTask(oldTask.id, taskData);
                
                // Записываем в историю
                window.HistoryUtils.recordTaskUpdate(oldTask.id, oldTask, taskData);
                
                // Убрали уведомление об успехе обновления
                window.boardManager.updateTaskOnBoard(updatedTask);
            } else {
                const newTask = await window.api.createTask(taskData);
                
                // Записываем в историю
                window.HistoryUtils.recordTaskCreate(newTask);
                
                // Убрали уведомление о создании
                window.boardManager.addTaskToBoard(newTask);
            }
            
            window.ModalManager.hide();

        } catch (error) {
            console.error('Error submitting task:', error);
            window.ApiUtils.showApiError(error, isEdit ? 'обновления задачи' : 'создания задачи');
        }
    }

    setupColorPicker() {
        const colorInput = document.getElementById('taskColor');
        const colorPresets = document.querySelectorAll('.color-preset');

        colorPresets.forEach(preset => {
            preset.addEventListener('click', () => {
                const color = preset.dataset.color;
                colorInput.value = color;
                
                // Обновляем активный пресет
                colorPresets.forEach(p => p.classList.remove('active'));
                preset.classList.add('active');
            });
        });

        // Обновляем активный пресет при изменении цвета
        colorInput?.addEventListener('change', () => {
            const currentColor = colorInput.value;
            colorPresets.forEach(p => {
                p.classList.toggle('active', p.dataset.color === currentColor);
            });
        });
    }
}

// ============ Менеджер задач ============
class TaskModal {
    constructor() {
        this.currentTask = null;
        this.defaultFeatureId = null;
        this.setupDeleteHandler();
    }

    show(task = null, boardId = null) {
        this.currentTask = task;
        const modal = document.getElementById('taskModal');
        const form = document.getElementById('taskForm');
        const title = document.getElementById('taskModalTitle');
        const deleteBtn = document.getElementById('deleteTask');

        if (task) {
            // Режим редактирования
            title.textContent = 'Редактировать задачу';
            deleteBtn.style.display = 'inline-flex';
            this.populateForm(task);
        } else {
            // Режим создания
            title.textContent = 'Создать задачу';
            deleteBtn.style.display = 'none';
            form.reset();
            
            // Устанавливаем цвет по умолчанию
            const colorInput = document.getElementById('taskColor');
            if (colorInput) {
                colorInput.value = '#ffeb3b';
                const yellowPreset = document.querySelector('.color-preset[data-color="#ffeb3b"]');
                if (yellowPreset) {
                    document.querySelectorAll('.color-preset').forEach(p => p.classList.remove('active'));
                    yellowPreset.classList.add('active');
                }
            }
        }

        this.populateFeatureSelect(boardId);
        this.populateSprintSelect(boardId);

        window.ModalManager.show('taskModal');
    }

    populateForm(task) {
        const fields = {
            'taskName': task.name,
            'estimateIos': task.estimate_ios,
            'estimateAndroid': task.estimate_android,
            'estimateQa': task.estimate_qa,
            'estimateSa': task.estimate_sa,
            'taskColor': task.color || '#ffeb3b'
        };

        Object.entries(fields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = value || '';
            }
        });

        // Устанавливаем активный цветовой пресет
        const colorPresets = document.querySelectorAll('.color-preset');
        colorPresets.forEach(p => {
            p.classList.toggle('active', p.dataset.color === task.color);
        });
    }

    populateFeatureSelect(boardId) {
        if (!window.boardManager?.features) return;

        const features = window.boardManager.features;
        // Добавим поле выбора фичи в форму (сейчас его нет в HTML)
        // Пока будем использовать defaultFeatureId
        if (features.length > 0 && !this.currentTask) {
            this.defaultFeatureId = features[0].id;
        } else if (this.currentTask) {
            this.defaultFeatureId = this.currentTask.feature_id;
        }
    }

    populateSprintSelect(boardId) {
        if (!window.boardManager?.sprints) return;

        const sprints = window.boardManager.sprints;
        // Аналогично для спринтов - добавим позже в HTML
    }

    setupDeleteHandler() {
        const deleteBtn = document.getElementById('deleteTask');
        deleteBtn?.addEventListener('click', async () => {
            if (!this.currentTask) return;

            const confirmDelete = confirm(`Удалить задачу "${this.currentTask.name}"?`);
            if (!confirmDelete) return;

            try {
                await window.api.deleteTask(this.currentTask.id);
                
                // Записываем в историю
                window.HistoryUtils.recordTaskDelete(this.currentTask);
                
                window.boardManager.removeTaskFromBoard(this.currentTask.id);
                // Убрали уведомление об удалении
                window.ModalManager.hide();

            } catch (error) {
                console.error('Error deleting task:', error);
                window.ApiUtils.showApiError(error, 'удаления задачи');
            }
        });
    }
}

// ============ Менеджер редактирования спринтов ============
class SprintEditModal {
    constructor() {
        this.currentSprint = null;
    }

    show(sprint) {
        this.currentSprint = sprint;
        const modal = document.getElementById('sprintEditModal');
        const form = document.getElementById('sprintEditForm');
        const title = document.getElementById('sprintEditTitle');

        // Обновляем заголовок
        title.textContent = `Редактировать Спринт ${sprint.number}`;

        // Заполняем форму текущими данными
        this.populateForm(sprint);

        window.ModalManager.show('sprintEditModal');
    }

    populateForm(sprint) {
        const fields = {
            'editCapacityIos': sprint.capacity_ios || 0,
            'editCapacityAndroid': sprint.capacity_android || 0,
            'editCapacityQa': sprint.capacity_qa || 0,
            'editCapacitySa': sprint.capacity_sa || 0,
            'sprintDescription': sprint.description || '',
            'badge1Text': sprint.badge1_text || '',
            'badge1Color': sprint.badge1_color || 'blue',
            'badge1Tooltip': sprint.badge1_tooltip || '',
            'badge2Text': sprint.badge2_text || '',
            'badge2Color': sprint.badge2_color || 'blue',
            'badge2Tooltip': sprint.badge2_tooltip || ''
        };

        Object.entries(fields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field) {
                if (field.type === 'number') {
                    field.value = value || '';
                } else {
                    field.value = value || '';
                }
            }
        });
    }

    getCurrentSprint() {
        return this.currentSprint;
    }

    clear() {
        this.currentSprint = null;
        const form = document.getElementById('sprintEditForm');
        if (form) {
            form.reset();
        }
    }
}

// ============ Менеджер копирования/вставки ============
class CopyPasteManager {
    constructor() {
        this.clipboard = null;
        this.setupKeyboardShortcuts();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+C для копирования задачи
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !this.isInputFocused()) {
                const selectedTask = this.getSelectedTask();
                if (selectedTask) {
                    e.preventDefault();
                    this.copyTask(selectedTask);
                }
            }
            
            // Ctrl+V для вставки задачи
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !this.isInputFocused()) {
                if (this.clipboard) {
                    e.preventDefault();
                    this.pasteTask();
                }
            }
        });

        // Обработчик клика для выбора задач
        document.addEventListener('click', (e) => {
            const taskCard = e.target.closest('.task-card');
            if (taskCard && !e.ctrlKey && !e.metaKey) {
                this.selectTask(taskCard);
            }
        });
    }

    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        );
    }

    selectTask(taskCard) {
        // Убираем выделение с других задач
        document.querySelectorAll('.task-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Выделяем текущую
        taskCard.classList.add('selected');
    }

    getSelectedTask() {
        const selectedCard = document.querySelector('.task-card.selected');
        if (selectedCard) {
            const taskId = parseInt(selectedCard.dataset.taskId);
            const task = window.boardManager.tasks.find(t => t.id === taskId) ||
                        window.boardManager.backlogTasks.find(t => t.id === taskId);
            return task;
        }
        return null;
    }

    copyTask(task) {
        this.clipboard = {
            ...task,
            id: null, // Новая задача получит новый ID
            name: task.name + ' (копия)',
            sprint_id: null // Копии создаются в backlog
        };
        
        // Убрали уведомление о копировании
    }

    async pasteTask() {
        if (!this.clipboard) return;
        
        try {
            const taskData = {
                name: this.clipboard.name,
                feature_id: this.clipboard.feature_id,
                sprint_id: null, // Вставляем в backlog
                estimate_ios: this.clipboard.estimate_ios,
                estimate_android: this.clipboard.estimate_android,
                estimate_qa: this.clipboard.estimate_qa,
                estimate_sa: this.clipboard.estimate_sa,
                color: this.clipboard.color,
                position_x: this.clipboard.position_x + 10, // Смещение
                position_y: this.clipboard.position_y + 10
            };

            const newTask = await window.api.createTask(taskData);
            
            // Записываем в историю
            window.HistoryUtils.recordTaskCreate(newTask);
            
            window.boardManager.addTaskToBoard(newTask);
            
            // Убрали уведомление о вставке
            
        } catch (error) {
            console.error('Error pasting task:', error);
            window.ApiUtils.showApiError(error, 'вставки задачи');
        }
    }
}

// ============ Инициализация приложения ============
document.addEventListener('DOMContentLoaded', () => {
    // Создаем глобальные экземпляры менеджеров
    window.NotificationManager = new NotificationManager();
    window.ModalManager = new ModalManager();
    window.FormModalManager = new FormModalManager();
    window.TaskModal = new TaskModal();
    window.SprintEditModal = new SprintEditModal();
    window.CopyPasteManager = new CopyPasteManager();

    // Добавляем стили для уведомлений
    const notificationStyles = `
        .notification {
            margin-bottom: 8px;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        }
        
        .notification.show {
            opacity: 1;
            transform: translateX(0);
        }
        
        .notification.hiding {
            opacity: 0;
            transform: translateX(100%);
        }
        
        .notification-content {
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }
        
        .notification-icon {
            font-size: 18px;
            flex-shrink: 0;
        }
        
        .notification-text {
            flex: 1;
        }
        
        .notification-close {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: var(--text-secondary);
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background-color 0.2s;
        }
        
        .notification-close:hover {
            background-color: rgba(0,0,0,0.1);
        }

        .task-card.selected {
            border: 2px solid var(--primary-color) !important;
            box-shadow: 0 0 8px rgba(33, 150, 243, 0.3) !important;
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = notificationStyles;
    document.head.appendChild(styleSheet);

    // Убрали приветственное уведомление

    console.log('Task Manager initialized successfully!');
});

// ============ Глобальные утилиты ============
window.AppUtils = {
    /**
     * Форматировать дату
     */
    formatDate(date) {
        if (!date) return '';
        return new Date(date).toLocaleDateString('ru-RU');
    },

    /**
     * Форматировать время
     */
    formatTime(date) {
        if (!date) return '';
        return new Date(date).toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    },

    /**
     * Форматировать дату и время
     */
    formatDateTime(date) {
        if (!date) return '';
        const d = new Date(date);
        return `${d.toLocaleDateString('ru-RU')} ${d.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        })}`;
    },

    /**
     * Сокращить текст
     */
    truncateText(text, maxLength = 50) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    },

    /**
     * Получить контрастный цвет для текста
     */
    getContrastColor(hexColor) {
        // Преобразуем hex в RGB
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        
        // Вычисляем яркость
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        
        // Возвращаем черный или белый в зависимости от яркости
        return brightness > 155 ? '#000000' : '#ffffff';
    },

    /**
     * Сгенерировать случайный цвет
     */
    generateRandomColor() {
        const colors = ['#ffeb3b', '#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0'];
        return colors[Math.floor(Math.random() * colors.length)];
    },

    /**
     * Валидация email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Экспортировать данные доски в JSON
     */
    async exportBoardData() {
        if (!window.boardManager?.currentBoard) {
            window.NotificationManager.show('Ошибка', 'Нет активной доски для экспорта', 'error');
            return;
        }

        try {
            const boardData = window.boardManager.getCurrentBoardData();
            const dataStr = JSON.stringify(boardData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `task-manager-board-${boardData.board.id}-${new Date().getTime()}.json`;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            window.NotificationManager.show('Успех', 'Данные доски экспортированы', 'success');
            
        } catch (error) {
            console.error('Export error:', error);
            window.NotificationManager.show('Ошибка', 'Не удалось экспортировать данные', 'error');
        }
    }
};

// Подключаем обработчик экспорта
document.getElementById('exportBtn')?.addEventListener('click', window.AppUtils.exportBoardData);
