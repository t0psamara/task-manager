/**
 * Менеджер истории для undo/redo функциональности
 */
class HistoryManager {
    constructor(maxHistorySize = 10) {
        this.maxHistorySize = maxHistorySize;
        this.history = [];
        this.currentIndex = -1;
        this.isApplyingChange = false;
        
        this.setupKeyboardShortcuts();
        this.updateButtons();
    }

    /**
     * Настроить клавиатурные сокращения
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Z для undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }
            
            // Ctrl+Y или Ctrl+Shift+Z для redo
            if (((e.ctrlKey || e.metaKey) && e.key === 'y') || 
                ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
                e.preventDefault();
                this.redo();
            }
        });

        // Кнопки в UI
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');

        undoBtn?.addEventListener('click', () => this.undo());
        redoBtn?.addEventListener('click', () => this.redo());
    }

    /**
     * Добавить действие в историю
     */
    addAction(action) {
        if (this.isApplyingChange) return;

        // Удаляем все действия после текущего индекса (при undo и потом новом действии)
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        // Добавляем новое действие
        this.history.push({
            ...action,
            timestamp: Date.now(),
            id: this.generateActionId()
        });

        // Ограничиваем размер истории
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.currentIndex++;
        }

        this.updateButtons();
        console.log('History action added:', action);
    }

    /**
     * Отменить последнее действие
     */
    async undo() {
        if (!this.canUndo()) return;

        const action = this.history[this.currentIndex];
        console.log('Undoing action:', action);

        try {
            this.isApplyingChange = true;
            await this.revertAction(action);
            this.currentIndex--;
            this.updateButtons();
            
            this.showNotification('Действие отменено', action.description, 'success');
        } catch (error) {
            console.error('Error during undo:', error);
            this.showNotification('Ошибка отмены', error.message, 'error');
        } finally {
            this.isApplyingChange = false;
        }
    }

    /**
     * Повторить отмененное действие
     */
    async redo() {
        if (!this.canRedo()) return;

        const action = this.history[this.currentIndex + 1];
        console.log('Redoing action:', action);

        try {
            this.isApplyingChange = true;
            await this.applyAction(action);
            this.currentIndex++;
            this.updateButtons();
            
            this.showNotification('Действие повторено', action.description, 'success');
        } catch (error) {
            console.error('Error during redo:', error);
            this.showNotification('Ошибка повтора', error.message, 'error');
        } finally {
            this.isApplyingChange = false;
        }
    }

    /**
     * Проверить можно ли отменить
     */
    canUndo() {
        return this.currentIndex >= 0;
    }

    /**
     * Проверить можно ли повторить
     */
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }

    /**
     * Применить действие
     */
    async applyAction(action) {
        switch (action.type) {
            case 'task_create':
                await this.redoTaskCreate(action);
                break;
            case 'task_update':
                await this.redoTaskUpdate(action);
                break;
            case 'task_delete':
                await this.redoTaskDelete(action);
                break;
            case 'task_move':
                await this.redoTaskMove(action);
                break;
            case 'feature_create':
                await this.redoFeatureCreate(action);
                break;
            case 'feature_update':
                await this.redoFeatureUpdate(action);
                break;
            case 'feature_delete':
                await this.redoFeatureDelete(action);
                break;
            case 'sprint_create':
                await this.redoSprintCreate(action);
                break;
            case 'sprint_update':
                await this.redoSprintUpdate(action);
                break;
            case 'sprint_delete':
                await this.redoSprintDelete(action);
                break;
            default:
                console.warn('Unknown action type for redo:', action.type);
        }
    }

    /**
     * Отменить действие
     */
    async revertAction(action) {
        switch (action.type) {
            case 'task_create':
                await this.undoTaskCreate(action);
                break;
            case 'task_update':
                await this.undoTaskUpdate(action);
                break;
            case 'task_delete':
                await this.undoTaskDelete(action);
                break;
            case 'task_move':
                await this.undoTaskMove(action);
                break;
            case 'feature_create':
                await this.undoFeatureCreate(action);
                break;
            case 'feature_update':
                await this.undoFeatureUpdate(action);
                break;
            case 'feature_delete':
                await this.undoFeatureDelete(action);
                break;
            case 'sprint_create':
                await this.undoSprintCreate(action);
                break;
            case 'sprint_update':
                await this.undoSprintUpdate(action);
                break;
            case 'sprint_delete':
                await this.undoSprintDelete(action);
                break;
            default:
                console.warn('Unknown action type for undo:', action.type);
        }
    }

    // ============ Undo методы ============

    async undoTaskCreate(action) {
        const { taskId } = action.data;
        await window.api.deleteTask(taskId);
        window.boardManager?.removeTaskFromBoard(taskId);
    }

    async undoTaskUpdate(action) {
        const { taskId, oldData } = action.data;
        await window.api.updateTask(taskId, oldData);
        
        if (window.boardManager) {
            const updatedTask = await window.api.getTask(taskId);
            window.boardManager.updateTaskOnBoard(updatedTask);
        }
    }

    async undoTaskDelete(action) {
        const { taskData } = action.data;
        const newTask = await window.api.createTask(taskData);
        window.boardManager?.addTaskToBoard(newTask);
    }

    async undoTaskMove(action) {
        const { taskId, oldPosition } = action.data;
        const moveData = {
            task_id: taskId,
            new_feature_id: oldPosition.feature_id,
            new_sprint_id: oldPosition.sprint_id,
            new_position_x: oldPosition.position_x || 0,
            new_position_y: oldPosition.position_y || 0
        };
        
        const movedTask = await window.api.moveTask(moveData);
        window.boardManager?.updateTaskOnBoard(movedTask);
    }

    async undoFeatureCreate(action) {
        const { featureId } = action.data;
        await window.api.deleteFeature(featureId);
        if (window.boardManager && window.boardManager.currentBoard) {
            await window.boardManager.loadBoard(window.boardManager.currentBoard.id);
        }
    }

    async undoFeatureUpdate(action) {
        const { featureId, oldData } = action.data;
        await window.api.updateFeature(featureId, oldData);
        if (window.boardManager && window.boardManager.currentBoard) {
            await window.boardManager.loadBoard(window.boardManager.currentBoard.id);
        }
    }

    async undoFeatureDelete(action) {
        const { featureData } = action.data;
        await window.api.createFeature(featureData);
        if (window.boardManager && window.boardManager.currentBoard) {
            await window.boardManager.loadBoard(window.boardManager.currentBoard.id);
        }
    }

    async undoSprintCreate(action) {
        const { sprintId } = action.data;
        await window.api.deleteSprint(sprintId);
        if (window.boardManager && window.boardManager.currentBoard) {
            await window.boardManager.loadBoard(window.boardManager.currentBoard.id);
        }
    }

    async undoSprintUpdate(action) {
        const { sprintId, oldData } = action.data;
        await window.api.updateSprint(sprintId, oldData);
        if (window.boardManager && window.boardManager.currentBoard) {
            await window.boardManager.loadBoard(window.boardManager.currentBoard.id);
        }
    }

    async undoSprintDelete(action) {
        const { sprintData } = action.data;
        await window.api.createSprint(sprintData);
        if (window.boardManager && window.boardManager.currentBoard) {
            await window.boardManager.loadBoard(window.boardManager.currentBoard.id);
        }
    }

    // ============ Redo методы (применяют действие повторно) ============

    async redoTaskCreate(action) {
        const { taskData } = action.data;
        const newTask = await window.api.createTask(taskData);
        window.boardManager?.addTaskToBoard(newTask);
    }

    async redoTaskUpdate(action) {
        const { taskId, newData } = action.data;
        await window.api.updateTask(taskId, newData);
        
        if (window.boardManager) {
            const updatedTask = await window.api.getTask(taskId);
            window.boardManager.updateTaskOnBoard(updatedTask);
        }
    }

    async redoTaskDelete(action) {
        const { taskId } = action.data;
        await window.api.deleteTask(taskId);
        window.boardManager?.removeTaskFromBoard(taskId);
    }

    async redoTaskMove(action) {
        const { taskId, newPosition } = action.data;
        const moveData = {
            task_id: taskId,
            new_feature_id: newPosition.feature_id,
            new_sprint_id: newPosition.sprint_id,
            new_position_x: newPosition.position_x || 0,
            new_position_y: newPosition.position_y || 0
        };
        
        const movedTask = await window.api.moveTask(moveData);
        window.boardManager?.updateTaskOnBoard(movedTask);
    }

    async redoFeatureCreate(action) {
        const { featureData } = action.data;
        await window.api.createFeature(featureData);
        if (window.boardManager && window.boardManager.currentBoard) {
            await window.boardManager.loadBoard(window.boardManager.currentBoard.id);
        }
    }

    async redoFeatureUpdate(action) {
        const { featureId, newData } = action.data;
        await window.api.updateFeature(featureId, newData);
        if (window.boardManager && window.boardManager.currentBoard) {
            await window.boardManager.loadBoard(window.boardManager.currentBoard.id);
        }
    }

    async redoFeatureDelete(action) {
        const { featureId } = action.data;
        await window.api.deleteFeature(featureId);
        if (window.boardManager && window.boardManager.currentBoard) {
            await window.boardManager.loadBoard(window.boardManager.currentBoard.id);
        }
    }

    async redoSprintCreate(action) {
        const { sprintData } = action.data;
        await window.api.createSprint(sprintData);
        if (window.boardManager && window.boardManager.currentBoard) {
            await window.boardManager.loadBoard(window.boardManager.currentBoard.id);
        }
    }

    async redoSprintUpdate(action) {
        const { sprintId, newData } = action.data;
        await window.api.updateSprint(sprintId, newData);
        if (window.boardManager && window.boardManager.currentBoard) {
            await window.boardManager.loadBoard(window.boardManager.currentBoard.id);
        }
    }

    async redoSprintDelete(action) {
        const { sprintId } = action.data;
        await window.api.deleteSprint(sprintId);
        if (window.boardManager && window.boardManager.currentBoard) {
            await window.boardManager.loadBoard(window.boardManager.currentBoard.id);
        }
    }

    /**
     * Обновить состояние кнопок undo/redo
     */
    updateButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');

        if (undoBtn) {
            undoBtn.disabled = !this.canUndo();
            undoBtn.title = this.canUndo() ? 
                `Отменить: ${this.history[this.currentIndex]?.description}` : 
                'Нет действий для отмены';
        }

        if (redoBtn) {
            redoBtn.disabled = !this.canRedo();
            redoBtn.title = this.canRedo() ? 
                `Повторить: ${this.history[this.currentIndex + 1]?.description}` : 
                'Нет действий для повтора';
        }
    }

    /**
     * Показать уведомление
     */
    showNotification(title, message, type = 'info') {
        if (window.NotificationManager) {
            window.NotificationManager.show(title, message, type);
        } else {
            console.log(`${title}: ${message}`);
        }
    }

    /**
     * Сгенерировать ID для действия
     */
    generateActionId() {
        return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Очистить историю
     */
    clear() {
        this.history = [];
        this.currentIndex = -1;
        this.updateButtons();
    }

    /**
     * Получить текущее состояние истории
     */
    getHistoryInfo() {
        return {
            history: [...this.history],
            currentIndex: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            historySize: this.history.length
        };
    }

    /**
     * Получить предварительный просмотр истории
     */
    getHistoryPreview() {
        return this.history.map((action, index) => ({
            id: action.id,
            description: action.description,
            timestamp: action.timestamp,
            type: action.type,
            isCurrent: index === this.currentIndex,
            canUndo: index <= this.currentIndex,
            canRedo: index > this.currentIndex
        }));
    }
}

// Утилиты для работы с историей
window.HistoryUtils = {
    /**
     * Создать запись о создании задачи
     */
    recordTaskCreate(task) {
        if (!window.historyManager) return;
        
        window.historyManager.addAction({
            type: 'task_create',
            description: `Создание задачи "${task.name}"`,
            data: {
                taskId: task.id,
                taskData: { ...task }
            }
        });
    },

    /**
     * Создать запись об обновлении задачи
     */
    recordTaskUpdate(taskId, oldData, newData) {
        if (!window.historyManager) return;
        
        window.historyManager.addAction({
            type: 'task_update',
            description: `Обновление задачи "${newData.name || oldData.name}"`,
            data: {
                taskId,
                oldData,
                newData
            }
        });
    },

    /**
     * Создать запись об удалении задачи
     */
    recordTaskDelete(task) {
        if (!window.historyManager) return;
        
        window.historyManager.addAction({
            type: 'task_delete',
            description: `Удаление задачи "${task.name}"`,
            data: {
                taskId: task.id,
                taskData: { ...task }
            }
        });
    },

    /**
     * Создать запись о перемещении задачи
     */
    recordTaskMove(taskId, taskName, oldPosition, newPosition) {
        if (!window.historyManager) return;
        
        window.historyManager.addAction({
            type: 'task_move',
            description: `Перемещение задачи "${taskName}"`,
            data: {
                taskId,
                oldPosition,
                newPosition
            }
        });
    },

    /**
     * Создать запись о создании фичи
     */
    recordFeatureCreate(feature) {
        if (!window.historyManager) return;
        
        window.historyManager.addAction({
            type: 'feature_create',
            description: `Создание фичи "${feature.name}"`,
            data: {
                featureId: feature.id,
                featureData: { ...feature }
            }
        });
    },

    /**
     * Создать запись об обновлении спринта
     */
    recordSprintUpdate(sprintId, oldData, newData) {
        if (!window.historyManager) return;
        
        window.historyManager.addAction({
            type: 'sprint_update',
            description: `Обновление спринта ${newData.number || oldData.number}`,
            data: {
                sprintId,
                oldData,
                newData
            }
        });
    }
};

// Создаем глобальный экземпляр менеджера истории
window.historyManager = null;

// Инициализируем после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.historyManager = new HistoryManager();
});
