/**
 * Менеджер доски планирования
 */
class BoardManager {
    constructor() {
        this.currentBoard = null;
        this.features = [];
        this.sprints = [];
        this.tasks = [];
        this.backlogTasks = [];
        
        this.isLoading = false;
        
        // DOM элементы
        this.boardSelect = document.getElementById('boardSelect');
        this.planningBoard = document.getElementById('planningBoard');
        this.sprintHeaders = document.querySelector('.sprint-headers');
        this.backlogTasks = document.getElementById('backlogTasks');
        this.loadingSpinner = document.getElementById('loadingSpinner');
        this.mainContent = document.getElementById('mainContent');
        
        // Debounce для сохранения данных
        this.saveTimeout = null;
        
        this.setupEventListeners();
        this.setupWebSocketHandlers();
        this.loadBoards();
    }

    /**
     * Сохранить состояние с debounce
     */
    debouncedSave(callback, delay = 1000) {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(async () => {
            try {
                await callback();
                console.log('Board state saved successfully');
            } catch (error) {
                console.error('Error saving board state:', error);
            }
        }, delay);
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Выбор доски
        this.boardSelect.addEventListener('change', async (e) => {
            const boardId = e.target.value;
            if (boardId) {
                await this.loadBoard(parseInt(boardId));
            }
        });

        // Обновление доски
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn?.addEventListener('click', async () => {
            if (this.currentBoard) {
                console.log('Refreshing board data from server...');
                
                // Очищаем локальные данные для полного обновления
                this.features = [];
                this.sprints = [];
                this.tasks = [];
                this.backlogTasks = [];
                
                // Перезагружаем с сервера
                await this.loadBoard(this.currentBoard.id);
                
                // Убрали уведомление об обновлении
            }
        });

        // Кнопка добавления задачи в backlog
        const addTaskBtn = document.getElementById('addTaskToBacklog');
        addTaskBtn?.addEventListener('click', () => {
            this.showTaskModal();
        });
    }

    /**
     * Настройка WebSocket обработчиков
     */
    setupWebSocketHandlers() {
        // Переопределяем обработчики WebSocket клиента
        window.wsClient.handleTaskCreated = (data) => {
            console.log('Real-time: Task created', data);
            this.addTaskToBoard(data.task);
        };

        window.wsClient.handleTaskUpdated = (data) => {
            console.log('Real-time: Task updated', data);
            this.updateTaskOnBoard(data.task);
        };

        window.wsClient.handleTaskDeleted = (data) => {
            console.log('Real-time: Task deleted', data);
            this.removeTaskFromBoard(data.task_id);
        };

        window.wsClient.handleTaskMoved = (data) => {
            console.log('Real-time: Task moved', data);
            this.moveTaskOnBoard(data.task);
        };

        window.wsClient.handleFeatureCreated = (data) => {
            console.log('Real-time: Feature created', data);
            this.addFeatureToBoard(data.feature);
        };

        window.wsClient.handleSprintCreated = (data) => {
            console.log('Real-time: Sprint created', data);
            this.addSprintToBoard(data.sprint);
        };
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
     * Загрузить список досок
     */
    async loadBoards() {
        try {
            const boards = await window.api.getBoards();
            this.populateBoardSelector(boards);
        } catch (error) {
            console.error('Error loading boards:', error);
            window.ApiUtils.showApiError(error, 'загрузки досок');
        }
    }

    /**
     * Заполнить селектор досок
     */
    populateBoardSelector(boards) {
        this.boardSelect.innerHTML = '<option value="">Выберите доску...</option>';
        
        boards.forEach(board => {
            const option = document.createElement('option');
            option.value = board.id;
            option.textContent = board.name;
            this.boardSelect.appendChild(option);
        });
    }

    /**
     * Загрузить доску
     */
    async loadBoard(boardId) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading(true);

        try {
            // Загружаем данные доски параллельно
            const [board, features, sprints, tasks, backlogTasks] = await Promise.all([
                window.api.getBoard(boardId),
                window.api.getFeatures(boardId),
                window.api.getSprints(boardId),
                window.api.getTasks({ board_id: boardId }),
                window.api.getUnassignedTasks(boardId)
            ]);

            this.currentBoard = board;
            this.features = features;
            this.sprints = sprints;
            
            // ПРАВИЛЬНО РАЗДЕЛЯЕМ ЗАДАЧИ НА SPRINT TASKS И BACKLOG
            this.tasks = tasks.filter(task => task.sprint_id !== null);
            this.backlogTasks = [...backlogTasks, ...tasks.filter(task => task.sprint_id === null)];
            
            console.log('Board loaded:');
            console.log('- Tasks in sprints:', this.tasks.length);
            console.log('- Tasks in backlog:', this.backlogTasks.length);

            this.renderBoard();
            this.showLoading(false);

            // Подключаемся к WebSocket для этой доски
            window.WebSocketUtils.connectToBoard(boardId);

        } catch (error) {
            console.error('Error loading board:', error);
            window.ApiUtils.showApiError(error, 'загрузки доски');
            this.showLoading(false);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Показать/скрыть индикатор загрузки
     */
    showLoading(show) {
        if (show) {
            this.loadingSpinner.style.display = 'flex';
            this.mainContent.style.display = 'none';
        } else {
            this.loadingSpinner.style.display = 'none';
            this.mainContent.style.display = 'block';
        }
    }

    /**
     * Отрендерить доску
     */
    renderBoard() {
        if (!this.currentBoard) return;

        this.renderSprintHeaders();
        this.renderFeatureRows();
        this.renderBacklog();
        this.updateCapacityIndicators();
    }

    /**
     * Отрендерить заголовки спринтов
     */
    renderSprintHeaders() {
        this.sprintHeaders.innerHTML = '<div class="feature-header">Фичи</div>';
        
        // Синхронизируем количество колонок с количеством спринтов
        const sprintCount = this.sprints.length;
        const sprintWidths = this.calculateSprintWidths();
        const gridColumns = `300px ${sprintWidths.map(width => `${width}px`).join(' ')}`;
        this.sprintHeaders.style.gridTemplateColumns = gridColumns;
        
        this.sprints.forEach(sprint => {
            const sprintHeader = document.createElement('div');
            sprintHeader.className = 'sprint-header';
            sprintHeader.dataset.sprintId = sprint.id;

            const capacityInfo = this.calculateSprintCapacity(sprint);
            
            // Создаем бейджи если есть текст
            const badges = [];
            if (sprint.badge1_text) {
                badges.push(`
                    <div class="sprint-badge ${sprint.badge1_color || 'blue'}" title="${sprint.badge1_tooltip || ''}">
                        ${sprint.badge1_text}
                        ${sprint.badge1_tooltip ? `<div class="tooltip">${sprint.badge1_tooltip}</div>` : ''}
                    </div>
                `);
            }
            if (sprint.badge2_text) {
                badges.push(`
                    <div class="sprint-badge ${sprint.badge2_color || 'blue'}" title="${sprint.badge2_tooltip || ''}">
                        ${sprint.badge2_text}
                        ${sprint.badge2_tooltip ? `<div class="tooltip">${sprint.badge2_tooltip}</div>` : ''}
                    </div>
                `);
            }

            sprintHeader.innerHTML = `
                <div class="sprint-title">Спринт ${sprint.number}</div>
                ${sprint.description ? `<div class="sprint-description">${sprint.description}</div>` : ''}
                ${badges.length > 0 ? `<div class="sprint-badges">${badges.join('')}</div>` : ''}
                <div class="sprint-capacity">
                    <div class="capacity-item">iOS: <span class="capacity-value ${capacityInfo.ios_status}">${capacityInfo.used_ios}/${sprint.capacity_ios || 0}</span></div>
                    <div class="capacity-item">Android: <span class="capacity-value ${capacityInfo.android_status}">${capacityInfo.used_android}/${sprint.capacity_android || 0}</span></div>
                    <div class="capacity-item">QA: <span class="capacity-value ${capacityInfo.qa_status}">${capacityInfo.used_qa}/${sprint.capacity_qa || 0}</span></div>
                    <div class="capacity-item">SA: <span class="capacity-value ${capacityInfo.sa_status}">${capacityInfo.used_sa}/${sprint.capacity_sa || 0}</span></div>
                </div>
                <div class="capacity-bar">
                    <div class="capacity-fill ${capacityInfo.status}" 
                         style="width: ${Math.min(capacityInfo.usage_percent, 100)}%">
                    </div>
                </div>
            `;

            // Добавляем обработчик двойного клика для редактирования
            sprintHeader.addEventListener('dblclick', () => {
                this.showSprintEditModal(sprint);
            });

            this.sprintHeaders.appendChild(sprintHeader);
        });
    }

    /**
     * Рассчитать использование емкости спринта
     */
    calculateSprintCapacity(sprint) {
        const sprintTasks = this.tasks.filter(task => task.sprint_id === sprint.id);
        
        const used_ios = sprintTasks.reduce((sum, task) => sum + (parseFloat(task.estimate_ios) || 0), 0);
        const used_android = sprintTasks.reduce((sum, task) => sum + (parseFloat(task.estimate_android) || 0), 0);
        const used_qa = sprintTasks.reduce((sum, task) => sum + (parseFloat(task.estimate_qa) || 0), 0);
        const used_sa = sprintTasks.reduce((sum, task) => sum + (parseFloat(task.estimate_sa) || 0), 0);

        const total_capacity = (sprint.capacity_ios || 0) + (sprint.capacity_android || 0) + (sprint.capacity_qa || 0) + (sprint.capacity_sa || 0);
        const total_used = used_ios + used_android + used_qa + used_sa;
        const usage_percent = total_capacity > 0 ? (total_used / total_capacity) * 100 : 0;

        // Индивидуальные статусы для каждого направления
        const getDirectionStatus = (used, capacity) => {
            if (!capacity) return 'normal';
            const remaining = capacity - used;
            
            // Зеленый если загрузка равна емкости или меньше на 2
            if (remaining >= 0 && remaining <= 2) return 'optimal';
            // Обычный цвет если есть емкость  
            if (remaining > 2) return 'normal';
            // Красный если перегрузка
            return 'overload';
        };

        let status = 'available';
        if (usage_percent >= 100) status = 'overload';
        else if (usage_percent >= 90) status = 'full';

        return {
            used_ios,
            used_android,
            used_qa,
            used_sa,
            total_used,
            usage_percent,
            status,
            ios_status: getDirectionStatus(used_ios, sprint.capacity_ios),
            android_status: getDirectionStatus(used_android, sprint.capacity_android),
            qa_status: getDirectionStatus(used_qa, sprint.capacity_qa),
            sa_status: getDirectionStatus(used_sa, sprint.capacity_sa)
        };
    }

    /**
     * Рассчитать ширину столбцов спринтов на основе количества тикетов
     */
    calculateSprintWidths() {
        const baseWidth = 200; // Минимальная ширина столбца
        const taskWidth = 100; // Ширина одного тикета + отступы
        const maxTasksPerColumn = 6; // Максимум тикетов в одной колонке
        
        return this.sprints.map(sprint => {
            let maxColumnsNeeded = 1;
            
            // Находим максимальное количество колонок тикетов в любой ячейке этого спринта
            this.features.forEach(feature => {
                const tasksInCell = this.tasks.filter(
                    task => task.sprint_id === sprint.id && task.feature_id === feature.id
                ).length;
                
                // Рассчитываем количество колонок тикетов (6 тикетов в колонке максимум)
                const columnsNeeded = Math.ceil(tasksInCell / maxTasksPerColumn);
                maxColumnsNeeded = Math.max(maxColumnsNeeded, columnsNeeded);
            });
            
            // Рассчитываем ширину столбца
            const calculatedWidth = baseWidth + (maxColumnsNeeded > 1 ? (maxColumnsNeeded - 1) * taskWidth : 0);
            
            return Math.max(calculatedWidth, baseWidth);
        });
    }

    /**
     * Отрендерить строки с фичами
     */
    renderFeatureRows() {
        this.planningBoard.innerHTML = '';

        // Синхронизируем количество колонок с заголовками спринтов  
        const sprintCount = this.sprints.length;
        const sprintWidths = this.calculateSprintWidths();
        const gridColumns = `300px ${sprintWidths.map(width => `${width}px`).join(' ')}`;

        this.features.forEach(feature => {
            const featureRow = document.createElement('div');
            featureRow.className = 'feature-row';
            featureRow.dataset.featureId = feature.id;
            featureRow.style.gridTemplateColumns = gridColumns; // Синхронизируем с заголовками

            // Ячейка с названием фичи и метаданными
            const featureCell = document.createElement('div');
            featureCell.className = 'feature-cell';
            
            // Метаданные фичи
            const metadataHtml = [];
            if (feature.mgmt_link) {
                metadataHtml.push(`<a href="${feature.mgmt_link}" class="feature-meta-link" target="_blank" rel="noopener">${feature.mgmt_title || 'МГМТ'}</a>`);
            }
            if (feature.epic_link) {
                metadataHtml.push(`<a href="${feature.epic_link}" class="feature-meta-link" target="_blank" rel="noopener">${feature.epic_title || 'Эпик'}</a>`);
            }
            if (feature.project_code) {
                metadataHtml.push(`<div class="feature-project">проект ${feature.project_code}</div>`);
            }

            featureCell.innerHTML = `
                <div class="feature-name" title="${feature.name}">${feature.name}</div>
                ${metadataHtml.length > 0 ? `<div class="feature-metadata">${metadataHtml.join('')}</div>` : ''}
            `;
            
            // Добавляем обработчик для редактирования фичи
            featureCell.addEventListener('dblclick', () => {
                this.showFeatureEditModal(feature);
            });
            
            featureRow.appendChild(featureCell);

            // Ячейки для каждого спринта
            this.sprints.forEach(sprint => {
                const taskCell = document.createElement('div');
                taskCell.className = 'task-cell';
                taskCell.dataset.featureId = feature.id;
                taskCell.dataset.sprintId = sprint.id;

                // Добавляем задачи в ячейку с многорядной компоновкой
                const featureTasks = this.tasks.filter(
                    task => task.feature_id === feature.id && task.sprint_id === sprint.id
                );
                
                this.renderTasksInCell(taskCell, featureTasks);

                featureRow.appendChild(taskCell);
            });

            this.planningBoard.appendChild(featureRow);
        });

        // Инициализируем drag-and-drop после рендеринга
        if (window.DragDropManager) {
            window.DragDropManager.initializeSortable();
        }
    }

    /**
     * Создать элемент задачи
     */
    createTaskElement(task) {
        const taskCard = document.createElement('div');
        taskCard.className = 'task-card';
        taskCard.dataset.taskId = task.id;
        
        // Проверяем это свернутая фича
        if (task.is_collapsed_feature) {
            taskCard.classList.add('collapsed-feature');
            taskCard.style.backgroundColor = '#9c27b0'; // Фиолетовый для свернутых фич
        } else {
            taskCard.style.backgroundColor = task.color || '#ffeb3b';
        }
        
        // Делаем задачу перетаскиваемой
        taskCard.draggable = true;

        const estimates = [
            task.estimate_ios ? { team: 'iOS', value: task.estimate_ios } : null,
            task.estimate_android ? { team: 'And', value: task.estimate_android } : null,
            task.estimate_qa ? { team: 'QA', value: task.estimate_qa } : null,
            task.estimate_sa ? { team: 'SA', value: task.estimate_sa } : null
        ].filter(Boolean);

        const estimatesHtml = estimates.map(est => 
            `<div class="estimate" data-team="${est.team}">${est.value}</div>`
        ).join('');

        // Создаем HTML для энейблера если он есть (всегда активен)
        const enablerHtml = task.enabler_title ? 
            `<div class="task-enabler active">${task.enabler_title}</div>` : '';

        taskCard.innerHTML = `
            ${enablerHtml}
            <div class="task-name">${task.name}</div>
            <div class="task-estimates">${estimatesHtml}</div>
        `;

        // Обработчик двойного клика для редактирования
        taskCard.addEventListener('dblclick', () => {
            if (task.is_collapsed_feature) {
                // Для свернутых фич показываем информацию о восстановлении
                const originalTasks = task.original_feature_tasks ? JSON.parse(task.original_feature_tasks) : [];
                alert(`Свернутая фича: ${task.name}\nОригинальных задач: ${originalTasks.length}\nПеретащите в ячейку спринта для восстановления`);
            } else {
                this.showTaskModal(task);
            }
        });

        return taskCard;
    }

    /**
     * Отрендерить задачи в ячейке с многорядной компоновкой
     */
    renderTasksInCell(taskCell, tasks) {
        const maxTasksPerColumn = 6;
        const taskHeight = 60; // Высота одного тикета
        const columns = Math.ceil(tasks.length / maxTasksPerColumn);
        
        // Очищаем ячейку
        taskCell.innerHTML = '';
        
        // Устанавливаем размеры ячейки
        const cellWidth = 200 + (columns > 1 ? (columns - 1) * 100 : 0);
        const cellHeight = Math.min(tasks.length, maxTasksPerColumn) * taskHeight + 16; // +отступы
        
        taskCell.style.width = `${cellWidth}px`;
        taskCell.style.height = `${cellHeight}px`;
        taskCell.style.maxHeight = `${maxTasksPerColumn * taskHeight + 16}px`;
        
        console.log(`Rendering ${tasks.length} tasks in ${columns} columns, cell size: ${cellWidth}x${cellHeight}`);
        
        // Добавляем задачи
        tasks.forEach((task, index) => {
            const taskElement = this.createTaskElement(task);
            taskCell.appendChild(taskElement);
        });
    }

    /**
     * Отрендерить backlog
     */
    renderBacklog() {
        const backlogContainer = document.getElementById('backlogTasks');
        backlogContainer.innerHTML = '';

        this.backlogTasks.forEach(task => {
            backlogContainer.appendChild(this.createTaskElement(task));
        });

        // Инициализируем drag-and-drop для backlog
        if (window.DragDropManager) {
            window.DragDropManager.initializeBacklog();
        }
    }

    /**
     * Обновить индикаторы емкости
     */
    updateCapacityIndicators() {
        this.sprints.forEach(sprint => {
            const header = this.sprintHeaders.querySelector(`[data-sprint-id="${sprint.id}"]`);
            if (header) {
                const capacityInfo = this.calculateSprintCapacity(sprint);
                
                const capacityBar = header.querySelector('.capacity-fill');
                if (capacityBar) {
                    capacityBar.className = `capacity-fill ${capacityInfo.status}`;
                    capacityBar.style.width = `${Math.min(capacityInfo.usage_percent, 100)}%`;
                }

                const capacityText = header.querySelector('.sprint-capacity');
                if (capacityText) {
                    capacityText.innerHTML = `
                        <div class="capacity-item">iOS: <span class="capacity-value ${capacityInfo.ios_status}">${capacityInfo.used_ios}/${sprint.capacity_ios || 0}</span></div>
                        <div class="capacity-item">Android: <span class="capacity-value ${capacityInfo.android_status}">${capacityInfo.used_android}/${sprint.capacity_android || 0}</span></div>
                        <div class="capacity-item">QA: <span class="capacity-value ${capacityInfo.qa_status}">${capacityInfo.used_qa}/${sprint.capacity_qa || 0}</span></div>
                        <div class="capacity-item">SA: <span class="capacity-value ${capacityInfo.sa_status}">${capacityInfo.used_sa}/${sprint.capacity_sa || 0}</span></div>
                    `;
                }
            }
        });
    }

    /**
     * Показать модальное окно задачи
     */
    showTaskModal(task = null) {
        if (window.TaskModal) {
            window.TaskModal.show(task, this.currentBoard?.id);
        }
    }

    /**
     * Показать модальное окно редактирования спринта
     */
    showSprintEditModal(sprint) {
        if (window.SprintEditModal) {
            window.SprintEditModal.show(sprint);
        }
    }

    /**
     * Показать модальное окно редактирования фичи
     */
    showFeatureEditModal(feature) {
        if (window.FeatureEditModal) {
            window.FeatureEditModal.show(feature);
        }
    }

    /**
     * Добавить задачу на доску (real-time)
     */
    addTaskToBoard(task) {
        console.log('BoardManager: Adding task to board:', task);
        
        // ОЧИЩАЕМ ВОЗМОЖНЫЕ ДУБЛИКАТЫ
        this.tasks = this.tasks.filter(t => t.id !== task.id);
        this.backlogTasks = this.backlogTasks.filter(t => t.id !== task.id);
        
        // ДОБАВЛЯЕМ В ПРАВИЛЬНОЕ МЕСТО
        if (task.sprint_id) {
            this.tasks.push(task);
            console.log(`Task ${task.id} added to sprint ${task.sprint_id}`);
        } else {
            this.backlogTasks.push(task);
            console.log(`Task ${task.id} added to backlog`);
        }
        
        // ПОЛНАЯ ПЕРЕРИСОВКА
        this.renderBoard();
        
        // Отладка
        this.debugTaskDistribution();
    }

    /**
     * Обновить задачу на доске (real-time)
     */
    updateTaskOnBoard(updatedTask) {
        console.log('BoardManager: Updating task on board:', updatedTask);
        
        // Находим старую задачу для сравнения
        const oldTask = this.tasks.find(t => t.id === updatedTask.id) || 
                       this.backlogTasks.find(t => t.id === updatedTask.id);
        
        if (!oldTask) {
            console.log('Task not found, adding as new task');
            this.addTaskToBoard(updatedTask);
            return;
        }

        // Проверяем изменилось ли положение задачи (sprint_id или feature_id)
        const positionChanged = oldTask.sprint_id !== updatedTask.sprint_id || 
                               oldTask.feature_id !== updatedTask.feature_id;
        
        if (positionChanged) {
            console.log('Task position changed, moving task');
            // Если позиция изменилась - делаем полное перемещение
            this.tasks = this.tasks.filter(t => t.id !== updatedTask.id);
            this.backlogTasks = this.backlogTasks.filter(t => t.id !== updatedTask.id);
            
            if (updatedTask.sprint_id) {
                this.tasks.push(updatedTask);
            } else {
                this.backlogTasks.push(updatedTask);
            }
            
            // Полная перерисовка при перемещении
            this.renderBoard();
        } else {
            console.log('Task updated in place, keeping same position');
            // Если только данные изменились (оценки, название, цвет) - обновляем на месте
            
            // Обновляем в массивах
            if (updatedTask.sprint_id) {
                const taskIndex = this.tasks.findIndex(t => t.id === updatedTask.id);
                if (taskIndex > -1) {
                    this.tasks[taskIndex] = updatedTask;
                }
            } else {
                const backlogIndex = this.backlogTasks.findIndex(t => t.id === updatedTask.id);
                if (backlogIndex > -1) {
                    this.backlogTasks[backlogIndex] = updatedTask;
                }
            }
            
            // Обновляем только DOM элемент задачи
            const taskElement = document.querySelector(`[data-task-id="${updatedTask.id}"]`);
            if (taskElement) {
                const newTaskElement = this.createTaskElement(updatedTask);
                taskElement.parentNode.replaceChild(newTaskElement, taskElement);
            }
            
            // Пересчитываем только емкость без полной перерисовки
            this.updateCapacityIndicators();
            this.renderSprintHeaders();
        }
        
        // Отладка
        this.debugTaskDistribution();
    }

    /**
     * Удалить задачу с доски (real-time)
     */
    removeTaskFromBoard(taskId) {
        console.log('BoardManager: Removing task from board:', taskId);
        
        // ПОЛНОСТЬЮ УДАЛЯЕМ ИЗ ВСЕХ МАССИВОВ
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.backlogTasks = this.backlogTasks.filter(t => t.id !== taskId);
        
        console.log('After removal - tasks:', this.tasks.length, 'backlog:', this.backlogTasks.length);

        // ПОЛНАЯ ПЕРЕРИСОВКА
        this.renderBoard();
        
        // Отладка
        this.debugTaskDistribution();
    }

    /**
     * Переместить задачу на доске (real-time)
     */
    moveTaskOnBoard(movedTask) {
        // Удаляем старый элемент
        const oldTaskElement = document.querySelector(`[data-task-id="${movedTask.id}"]`);
        if (oldTaskElement) {
            oldTaskElement.remove();
        }

        // Добавляем в новое место
        this.updateTaskOnBoard(movedTask);
    }

    /**
     * Добавить фичу на доску (real-time)
     */
    addFeatureToBoard(feature) {
        this.features.push(feature);
        this.renderBoard(); // Полная перерисовка так как добавляется строка
    }

    /**
     * Добавить спринт на доску (real-time)
     */
    addSprintToBoard(sprint) {
        this.sprints.push(sprint);
        this.sprints.sort((a, b) => a.number - b.number); // Сортируем по номеру
        this.renderBoard(); // Полная перерисовка так как добавляется колонка
    }

    /**
     * Получить текущие данные доски
     */
    getCurrentBoardData() {
        return {
            board: this.currentBoard,
            features: this.features,
            sprints: this.sprints,
            tasks: this.tasks,
            backlogTasks: this.backlogTasks
        };
    }

    /**
     * Отладочная информация о распределении задач
     */
    debugTaskDistribution() {
        console.log('=== TASK DISTRIBUTION DEBUG ===');
        console.log('Tasks in sprints:', this.tasks.map(t => `${t.id}→Sprint${t.sprint_id}`));
        console.log('Tasks in backlog:', this.backlogTasks.map(t => `${t.id}→Backlog`));
        
        // Проверяем дубликаты
        const allTaskIds = [...this.tasks.map(t => t.id), ...this.backlogTasks.map(t => t.id)];
        const duplicates = allTaskIds.filter((id, index) => allTaskIds.indexOf(id) !== index);
        if (duplicates.length > 0) {
            console.error('DUPLICATE TASKS FOUND:', duplicates);
        }
        
        // Проверяем емкость каждого спринта
        this.sprints.forEach(sprint => {
            const sprintTasks = this.tasks.filter(t => t.sprint_id === sprint.id);
            const totalUsed = sprintTasks.reduce((sum, t) => sum + (t.estimate_ios || 0) + (t.estimate_android || 0) + (t.estimate_qa || 0) + (t.estimate_sa || 0), 0);
            console.log(`Sprint ${sprint.number}: ${sprintTasks.length} tasks, total used: ${totalUsed}`);
        });
        console.log('=== END DEBUG ===');
    }
}

// Создаем глобальный экземпляр менеджера доски
window.boardManager = null;

// Инициализируем после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.boardManager = new BoardManager();
});
