/**
 * Менеджер drag-and-drop функциональности
 */
class DragDropManager {
    constructor() {
        this.draggedTask = null;
        this.draggedFeature = null;
        this.sourceContainer = null;
        this.isInitialized = false;
        
        this.setupEventListeners();
    }

    /**
     * Настроить общие обработчики событий
     */
    setupEventListeners() {
        document.addEventListener('dragstart', this.handleDragStart.bind(this));
        document.addEventListener('dragend', this.handleDragEnd.bind(this));
        document.addEventListener('dragover', this.handleDragOver.bind(this));
        document.addEventListener('drop', this.handleDrop.bind(this));
        document.addEventListener('dragenter', this.handleDragEnter.bind(this));
        document.addEventListener('dragleave', this.handleDragLeave.bind(this));
    }

    /**
     * Инициализировать SortableJS для ячеек задач
     */
    initializeSortable() {
        if (this.isInitialized) {
            this.destroySortable();
        }

        // Инициализируем sortable для каждой ячейки задач
        const taskCells = document.querySelectorAll('.task-cell');
        
        taskCells.forEach(cell => {
            new Sortable(cell, {
                group: 'tasks',
                animation: 200,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                
                onStart: (evt) => {
                    console.log('Sortable start:', evt);
                    evt.item.classList.add('dragging');
                },
                
                onEnd: (evt) => {
                    console.log('Sortable end:', evt);
                    evt.item.classList.remove('dragging');
                    
                    // Обрабатываем перемещение задачи
                    this.handleTaskMove(evt);
                },

                onAdd: (evt) => {
                    console.log('Sortable add:', evt);
                },

                onUpdate: (evt) => {
                    console.log('Sortable update:', evt);
                },

                onRemove: (evt) => {
                    console.log('Sortable remove:', evt);
                }
            });
        });

        // Инициализируем drag-and-drop для фич
        this.initializeFeatureDragDrop();
        
        this.isInitialized = true;
    }

    /**
     * Инициализировать drag-and-drop для фич (строк)
     */
    initializeFeatureDragDrop() {
        // Делаем всю строку фичи (feature-row) перетаскиваемой
        const featureRows = document.querySelectorAll('.feature-row');
        featureRows.forEach(featureRow => {
            featureRow.draggable = true;
            featureRow.addEventListener('dragstart', this.handleFeatureRowDragStart.bind(this));
            featureRow.addEventListener('dragend', this.handleFeatureRowDragEnd.bind(this));
        });

        // Инициализируем SortableJS для строк фич
        const planningBoard = document.getElementById('planningBoard');
        if (planningBoard && !planningBoard.featureSortable) {
            planningBoard.featureSortable = new Sortable(planningBoard, {
                group: 'features',
                animation: 200,
                handle: '.feature-cell', // Перетаскивание за ячейку фичи
                ghostClass: 'feature-row-ghost',
                chosenClass: 'feature-row-chosen',
                dragClass: 'feature-row-drag',
                
                onEnd: (evt) => {
                    this.handleFeatureReorder(evt);
                }
            });
        }

        // Делаем backlog drop-zone для фич
        const backlogTasks = document.getElementById('backlogTasks');
        if (backlogTasks) {
            backlogTasks.addEventListener('dragover', this.handleFeatureDragOver.bind(this));
            backlogTasks.addEventListener('drop', this.handleFeatureDrop.bind(this));
        }
    }

    /**
     * Инициализировать sortable для backlog
     */
    initializeBacklog() {
        const backlogContainer = document.getElementById('backlogTasks');
        if (backlogContainer && !backlogContainer.sortableInstance) {
            const sortableInstance = new Sortable(backlogContainer, {
                group: 'tasks',
                animation: 200,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                
                onStart: (evt) => {
                    evt.item.classList.add('dragging');
                    console.log('Backlog sortable start:', evt);
                },
                
                onEnd: (evt) => {
                    evt.item.classList.remove('dragging');
                    console.log('Backlog sortable end:', evt);
                    
                    // Обрабатываем перемещение задачи в/из backlog
                    this.handleBacklogMove(evt);
                }
            });
            
            backlogContainer.sortableInstance = sortableInstance;
        }
    }

    /**
     * Уничтожить все sortable экземпляры
     */
    destroySortable() {
        const taskCells = document.querySelectorAll('.task-cell');
        taskCells.forEach(cell => {
            if (cell.sortableInstance) {
                cell.sortableInstance.destroy();
                delete cell.sortableInstance;
            }
        });

        const backlogContainer = document.getElementById('backlogTasks');
        if (backlogContainer && backlogContainer.sortableInstance) {
            backlogContainer.sortableInstance.destroy();
            delete backlogContainer.sortableInstance;
        }

        const planningBoard = document.getElementById('planningBoard');
        if (planningBoard && planningBoard.featureSortable) {
            planningBoard.featureSortable.destroy();
            delete planningBoard.featureSortable;
        }

        this.isInitialized = false;
    }

    /**
     * Обработать начало перетаскивания
     */
    handleDragStart(e) {
        const taskCard = e.target.closest('.task-card');
        if (!taskCard) return;

        this.draggedTask = {
            id: parseInt(taskCard.dataset.taskId),
            element: taskCard
        };

        this.sourceContainer = taskCard.parentElement;
        
        // Добавляем визуальные эффекты
        taskCard.classList.add('dragging');
        
        // Настройка данных для передачи
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', taskCard.outerHTML);
        e.dataTransfer.setData('application/json', JSON.stringify({
            taskId: this.draggedTask.id,
            sourceContainer: {
                featureId: this.sourceContainer.dataset.featureId,
                sprintId: this.sourceContainer.dataset.sprintId
            }
        }));

        // Показываем подсказки для drop-зон
        this.highlightDropZones(true);
    }

    /**
     * Обработать окончание перетаскивания
     */
    handleDragEnd(e) {
        const taskCard = e.target.closest('.task-card');
        if (taskCard) {
            taskCard.classList.remove('dragging');
        }

        // Скрываем подсказки
        this.highlightDropZones(false);
        this.clearDragOverEffects();

        // Очищаем состояние
        this.draggedTask = null;
        this.draggedFeature = null;
        this.sourceContainer = null;
    }

    /**
     * Обработать dragover
     */
    handleDragOver(e) {
        e.preventDefault(); // Разрешаем drop
        e.dataTransfer.dropEffect = 'move';
    }

    /**
     * Обработать dragenter
     */
    handleDragEnter(e) {
        const dropZone = e.target.closest('.task-cell, #backlogTasks');
        if (dropZone) {
            dropZone.classList.add('drag-over');
        }
    }

    /**
     * Обработать dragleave
     */
    handleDragLeave(e) {
        const dropZone = e.target.closest('.task-cell, #backlogTasks');
        if (dropZone && !dropZone.contains(e.relatedTarget)) {
            dropZone.classList.remove('drag-over');
        }
    }

    /**
     * Обработать drop
     */
    handleDrop(e) {
        e.preventDefault();
        
        const dropZone = e.target.closest('.task-cell, #backlogTasks');
        if (!dropZone) return;

        dropZone.classList.remove('drag-over');

        try {
            const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
            this.performTaskMove(dragData.taskId, dropZone);
        } catch (error) {
            console.error('Error handling drop:', error);
        }
    }

    /**
     * Обработать перемещение задачи через SortableJS
     */
    async handleTaskMove(evt) {
        const taskId = parseInt(evt.item.dataset.taskId);
        const targetContainer = evt.to;
        
        await this.performTaskMove(taskId, targetContainer);
    }

    /**
     * Обработать перемещение в/из backlog
     */
    async handleBacklogMove(evt) {
        const taskId = parseInt(evt.item.dataset.taskId);
        const targetContainer = evt.to;
        
        await this.performTaskMove(taskId, targetContainer);
    }

    /**
     * Выполнить перемещение задачи
     */
    async performTaskMove(taskId, targetContainer) {
        if (!taskId || !targetContainer) {
            console.error('Invalid task move parameters');
            return;
        }

        try {
            // Получаем текущую задачу для записи в историю
            const currentTask = window.boardManager.tasks.find(t => t.id === taskId) ||
                               window.boardManager.backlogTasks.find(t => t.id === taskId);
            
            if (!currentTask) {
                throw new Error('Задача не найдена');
            }

            // Проверяем это свернутая фича
            if (currentTask.is_collapsed_feature && targetContainer.classList.contains('task-cell')) {
                await this.expandCollapsedFeature(currentTask, targetContainer);
                return;
            }

            const oldPosition = {
                feature_id: currentTask.feature_id,
                sprint_id: currentTask.sprint_id,
                position_x: currentTask.position_x,
                position_y: currentTask.position_y
            };

            let moveData = { task_id: taskId };

            if (targetContainer.classList.contains('task-cell')) {
                // Перемещение в спринт
                moveData.new_feature_id = parseInt(targetContainer.dataset.featureId);
                moveData.new_sprint_id = parseInt(targetContainer.dataset.sprintId);
            } else if (targetContainer.id === 'backlogTasks') {
                // Перемещение в backlog
                moveData.new_sprint_id = null;
                moveData.new_feature_id = currentTask.feature_id;
            }

            const newPosition = {
                feature_id: moveData.new_feature_id,
                sprint_id: moveData.new_sprint_id,
                position_x: moveData.new_position_x || 0,
                position_y: moveData.new_position_y || 0
            };

            // Отправляем запрос на сервер
            const updatedTask = await window.api.moveTask(moveData);
            console.log('Task moved successfully:', updatedTask);

            // Записываем в историю после успешного перемещения
            if (window.HistoryUtils) {
                window.HistoryUtils.recordTaskMove(
                    taskId, 
                    currentTask.name, 
                    oldPosition, 
                    newPosition
                );
            }

            // Обновляем локальное состояние
            this.updateLocalTaskData(updatedTask);

        } catch (error) {
            console.error('Error moving task:', error);
            window.ApiUtils.showApiError(error, 'перемещения задачи');
            
            // В случае ошибки перезагружаем доску
            if (window.boardManager && window.boardManager.currentBoard) {
                await window.boardManager.loadBoard(window.boardManager.currentBoard.id);
            }
        }
    }

    /**
     * Развернуть свернутую фичу обратно в задачи
     */
    async expandCollapsedFeature(collapsedTask, targetContainer) {
        try {
            console.log('Expanding collapsed feature:', collapsedTask);
            
            // Получаем target feature_id и sprint_id
            const targetFeatureId = parseInt(targetContainer.dataset.featureId);
            const targetSprintId = parseInt(targetContainer.dataset.sprintId);
            
            // Получаем оригинальные задачи из JSON
            const originalTasks = JSON.parse(collapsedTask.original_feature_tasks || '[]');
            
            if (originalTasks.length === 0) {
                throw new Error('Нет данных для восстановления фичи');
            }

            // Удаляем свернутый тикет
            await window.api.deleteTask(collapsedTask.id);
            
            // Создаем все оригинальные задачи в новом месте
            for (const originalTask of originalTasks) {
                const taskData = {
                    name: originalTask.name,
                    feature_id: targetFeatureId,
                    sprint_id: targetSprintId,
                    estimate_ios: originalTask.estimate_ios || 0,
                    estimate_android: originalTask.estimate_android || 0,
                    estimate_qa: originalTask.estimate_qa || 0,
                    estimate_sa: originalTask.estimate_sa || 0,
                    color: originalTask.color || '#ffeb3b',
                    enabler_title: originalTask.enabler_title || '',
                    enabler_active: true,
                    is_collapsed_feature: false
                };
                
                await window.api.createTask(taskData);
            }

            console.log('Feature expanded successfully');

            // Обновляем доску
            await window.boardManager.loadBoard(window.boardManager.currentBoard.id);

        } catch (error) {
            console.error('Error expanding feature:', error);
            window.ApiUtils.showApiError(error, 'восстановления фичи');
        }
    }

    /**
     * Обновить локальные данные задачи
     */
    updateLocalTaskData(updatedTask) {
        if (!window.boardManager) return;

        console.log('Updating local task data:', updatedTask);

        // СНАЧАЛА ПОЛНОСТЬЮ ОЧИЩАЕМ ЗАДАЧУ ИЗ ВСЕХ МАССИВОВ
        window.boardManager.tasks = window.boardManager.tasks.filter(t => t.id !== updatedTask.id);
        window.boardManager.backlogTasks = window.boardManager.backlogTasks.filter(t => t.id !== updatedTask.id);

        // ТЕПЕРЬ ДОБАВЛЯЕМ В ПРАВИЛЬНОЕ МЕСТО
        if (updatedTask.sprint_id) {
            // Задача в спринте
            window.boardManager.tasks.push(updatedTask);
            console.log(`Task ${updatedTask.id} moved to sprint ${updatedTask.sprint_id}`);
        } else {
            // Задача в backlog
            window.boardManager.backlogTasks.push(updatedTask);
            console.log(`Task ${updatedTask.id} moved to backlog`);
        }

        // ПРИНУДИТЕЛЬНО ПЕРЕРИСОВЫВАЕМ ВСЮ ДОСКУ
        window.boardManager.renderBoard();
        
        console.log('Current tasks in sprints:', window.boardManager.tasks.length);
        console.log('Current tasks in backlog:', window.boardManager.backlogTasks.length);
    }

    /**
     * Подсветить drop-зоны
     */
    highlightDropZones(highlight) {
        const dropZones = document.querySelectorAll('.task-cell, #backlogTasks');
        
        dropZones.forEach(zone => {
            if (highlight) {
                zone.classList.add('droppable');
            } else {
                zone.classList.remove('droppable');
            }
        });
    }

    /**
     * Очистить эффекты dragover
     */
    clearDragOverEffects() {
        const elementsWithDragOver = document.querySelectorAll('.drag-over');
        elementsWithDragOver.forEach(el => {
            el.classList.remove('drag-over');
        });
    }

    /**
     * Получить информацию о перетаскиваемой задаче
     */
    getDraggedTaskInfo() {
        return this.draggedTask ? {
            ...this.draggedTask,
            sourceContainer: {
                featureId: this.sourceContainer?.dataset.featureId,
                sprintId: this.sourceContainer?.dataset.sprintId
            }
        } : null;
    }

    /**
     * Проверить можно ли перетащить задачу в определенную зону
     */
    canDropTaskInZone(taskId, targetZone) {
        if (!targetZone) return false;

        // Пока разрешаем все перемещения
        // В будущем здесь можно добавить бизнес-логику ограничений
        return true;
    }

    /**
     * Анимировать возврат задачи в исходную позицию (при ошибке)
     */
    animateTaskReturn(taskElement, sourceContainer) {
        if (!taskElement || !sourceContainer) return;

        const taskRect = taskElement.getBoundingClientRect();
        const containerRect = sourceContainer.getBoundingClientRect();
        
        // Вычисляем смещение
        const deltaX = containerRect.left - taskRect.left;
        const deltaY = containerRect.top - taskRect.top;

        // Анимируем возврат
        taskElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        taskElement.style.transition = 'transform 0.3s ease';

        setTimeout(() => {
            taskElement.style.transform = '';
            taskElement.style.transition = '';
        }, 300);
    }

    /**
     * Обработать начало перетаскивания фичи
     */
    handleFeatureDragStart(e) {
        const featureName = e.target.closest('.feature-name');
        if (!featureName) return;

        const featureRow = featureName.closest('.feature-row');
        if (!featureRow) return;

        this.draggedFeature = {
            id: parseInt(featureRow.dataset.featureId),
            element: featureRow,
            name: featureName.textContent
        };

        // Визуальные эффекты
        featureRow.classList.add('dragging-feature');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', featureRow.outerHTML);
        e.dataTransfer.setData('application/json', JSON.stringify({
            type: 'feature',
            featureId: this.draggedFeature.id
        }));

        console.log('Feature drag started:', this.draggedFeature);
    }

    /**
     * Обработать окончание перетаскивания фичи
     */
    handleFeatureDragEnd(e) {
        if (this.draggedFeature) {
            this.draggedFeature.element.classList.remove('dragging-feature');
            this.draggedFeature = null;
        }
    }

    /**
     * Обработать dragover для фич
     */
    handleFeatureDragOver(e) {
        if (this.draggedFeature) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        }
    }

    /**
     * Обработать drop фичи в backlog (сворачивание в один тикет)
     */
    async handleFeatureDrop(e) {
        if (!this.draggedFeature) return;

        e.preventDefault();
        const dropZone = e.target.closest('#backlogTasks');
        if (!dropZone) return;

        try {
            console.log('Collapsing feature to backlog:', this.draggedFeature);
            
            // Получаем все задачи фичи
            const featureTasks = window.boardManager.tasks.filter(
                task => task.feature_id === this.draggedFeature.id
            );
            const featureBacklogTasks = window.boardManager.backlogTasks.filter(
                task => task.feature_id === this.draggedFeature.id
            );
            
            const allFeatureTasks = [...featureTasks, ...featureBacklogTasks];
            
            if (allFeatureTasks.length === 0) {
                console.log('No tasks to collapse, skipping');
                return;
            }

            // Рассчитываем суммарные оценки всех тикетов фичи
            const totalEstimates = allFeatureTasks.reduce((sum, task) => ({
                ios: sum.ios + (task.estimate_ios || 0),
                android: sum.android + (task.estimate_android || 0),
                qa: sum.qa + (task.estimate_qa || 0),
                sa: sum.sa + (task.estimate_sa || 0)
            }), { ios: 0, android: 0, qa: 0, sa: 0 });

            // Получаем название фичи
            const feature = window.boardManager.features.find(f => f.id === this.draggedFeature.id);
            const featureName = feature ? feature.name : 'Неизвестная фича';

            // Создаем один суммарный тикет в backlog
            const collapsedTaskData = {
                name: `📦 ${featureName}`,
                feature_id: this.draggedFeature.id,
                sprint_id: null, // В backlog
                estimate_ios: totalEstimates.ios,
                estimate_android: totalEstimates.android,
                estimate_qa: totalEstimates.qa,
                estimate_sa: totalEstimates.sa,
                color: '#9c27b0', // Фиолетовый цвет для свернутых фич
                enabler_title: 'ФИЧА',
                is_collapsed_feature: true,
                original_feature_tasks: JSON.stringify(allFeatureTasks.map(t => ({...t})))
            };

            // Создаем свернутый тикет
            const collapsedTask = await window.api.createTask(collapsedTaskData);
            
            // Удаляем все оригинальные тикеты
            for (const task of allFeatureTasks) {
                await window.api.deleteTask(task.id);
            }

            console.log('Feature collapsed successfully');

            // Обновляем доску
            await window.boardManager.loadBoard(window.boardManager.currentBoard.id);

        } catch (error) {
            console.error('Error collapsing feature:', error);
            window.ApiUtils.showApiError(error, 'сворачивания фичи');
        }
    }

    /**
     * Обработать начало перетаскивания строки фичи (SortableJS)
     */
    handleFeatureRowDragStart(e) {
        const featureRow = e.target.closest('.feature-row');
        if (!featureRow) return;

        this.draggedFeature = {
            id: parseInt(featureRow.dataset.featureId),
            element: featureRow,
            originalIndex: Array.from(featureRow.parentNode.children).indexOf(featureRow)
        };

        featureRow.classList.add('dragging-feature-row');
        console.log('Feature row drag started:', this.draggedFeature);
    }

    /**
     * Обработать окончание перетаскивания строки фичи
     */
    handleFeatureRowDragEnd(e) {
        if (this.draggedFeature) {
            this.draggedFeature.element.classList.remove('dragging-feature-row');
        }
    }

    /**
     * Обработать изменение порядка фич (SortableJS)
     */
    async handleFeatureReorder(evt) {
        const featureRow = evt.item;
        const featureId = parseInt(featureRow.dataset.featureId);
        const newIndex = evt.newIndex;
        const oldIndex = evt.oldIndex;

        if (newIndex === oldIndex) return; // Порядок не изменился

        try {
            console.log(`Reordering feature ${featureId} from ${oldIndex} to ${newIndex}`);

            // Обновляем порядок в локальных данных
            const feature = window.boardManager.features.find(f => f.id === featureId);
            if (feature) {
                // Обновляем order для данной фичи
                const newOrder = newIndex;
                
                // Обновляем на сервере
                await window.api.updateFeature(featureId, { order: newOrder });
                
                // Обновляем локальные данные
                feature.order = newOrder;
                
                // Пересортировываем все фичи
                window.boardManager.features.sort((a, b) => a.order - b.order);
                
                console.log('Feature reordered successfully');
            }

        } catch (error) {
            console.error('Error reordering feature:', error);
            
            // В случае ошибки возвращаем на место
            if (window.boardManager && window.boardManager.currentBoard) {
                await window.boardManager.loadBoard(window.boardManager.currentBoard.id);
            }
        }
    }
}

// Создаем глобальный экземпляр менеджера drag-and-drop
window.DragDropManager = new DragDropManager();

// CSS классы для SortableJS
const style = document.createElement('style');
style.textContent = `
    .sortable-ghost {
        opacity: 0.4;
    }

    .sortable-chosen {
        cursor: grabbing !important;
    }

    .sortable-drag {
        transform: rotate(5deg);
        box-shadow: 0 8px 16px rgba(0,0,0,0.3) !important;
        z-index: 1000;
    }

    .task-cell.droppable {
        background: rgba(33, 150, 243, 0.1);
        border: 2px dashed var(--primary-color);
    }

    .task-cell.drag-over,
    #backlogTasks.drag-over {
        background: rgba(33, 150, 243, 0.2);
        border-color: var(--primary-color);
    }

    .task-card.dragging {
        opacity: 0.8;
        transform: rotate(3deg);
        z-index: 1000;
        cursor: grabbing;
    }

    .task-card:hover {
        cursor: grab;
    }

    .feature-name {
        cursor: grab;
        transition: all 0.2s ease;
    }

    .feature-name:hover {
        background: rgba(33, 150, 243, 0.1);
        border-radius: 4px;
        padding: 2px 4px;
        margin: -2px -4px;
    }

    .dragging-feature {
        opacity: 0.7;
        transform: rotate(1deg);
    }

    .dragging-feature .task-cell {
        background: rgba(33, 150, 243, 0.1) !important;
    }

    /* Стили для перетаскивания строк фич */
    .feature-row-ghost {
        opacity: 0.4;
    }

    .feature-row-chosen {
        cursor: grabbing !important;
    }

    .feature-row-drag {
        transform: rotate(1deg);
        box-shadow: 0 8px 16px rgba(0,0,0,0.2) !important;
        z-index: 1000;
    }

    .dragging-feature-row {
        opacity: 0.8;
        transform: rotate(1deg);
        background: rgba(33, 150, 243, 0.1) !important;
    }

    .dragging-feature-row .task-cell {
        background: rgba(33, 150, 243, 0.05) !important;
    }

    .feature-cell {
        cursor: grab;
        transition: all 0.2s ease;
    }

    .feature-cell:hover {
        background: rgba(33, 150, 243, 0.05);
    }
`;

document.head.appendChild(style);
