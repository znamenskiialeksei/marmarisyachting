document.addEventListener('DOMContentLoaded', () => {
    // Глобальные переменные состояния
    let githubToken = null;
    let currentConfig = null;
    let selectedElementId = null;

    const loginView = document.getElementById('login-view');
    const adminView = document.getElementById('admin-view');
    const tokenInput = document.getElementById('github-token-input');
    const loginBtn = document.getElementById('login-btn');
    const saveBtn = document.getElementById('save-btn');
    
    // --- ИНИЦИАЛИЗАЦИЯ ---

    // Попытка авто-входа при загрузке
    const savedToken = localStorage.getItem('githubToken');
    if (savedToken) {
        githubToken = savedToken;
        loginView.style.display = 'none';
        adminView.style.display = 'flex';
        loadAdminPanel();
    }

    // Вход по кнопке
    loginBtn.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        if (token) {
            githubToken = token;
            localStorage.setItem('githubToken', token);
            loginView.style.display = 'none';
            adminView.style.display = 'flex';
            loadAdminPanel();
        } else {
            alert('Пожалуйста, введите токен.');
        }
    });
    
    // Сохранение по кнопке
    saveBtn.addEventListener('click', saveConfiguration);

    // --- ЗАГРУЗКА И РЕНДЕРИНГ ---

    async function loadAdminPanel() {
        const cacheBust = `?v=${new Date().getTime()}`;
        try {
            const response = await fetch(`config.json${cacheBust}`);
            if (!response.ok) throw new Error('Ошибка сети при загрузке config.json');
            currentConfig = await response.json();
            renderCanvas();
            setupToolbarActions();
            makePanelsInteractive();
        } catch (error) {
            console.error("Ошибка загрузки панели:", error);
            alert("Не удалось загрузить конфигурацию. Проверьте консоль.");
        }
    }

    function renderCanvas() {
        const canvas = document.getElementById('admin-canvas');
        canvas.innerHTML = ''; // Очистка

        // Создаем контейнер, аналогичный публичному
        const elementContainer = document.createElement('div');
        elementContainer.id = 'element-container';
        
        currentConfig.layout.main.columns.forEach(column => {
            const columnDiv = document.createElement('div');
            columnDiv.className = 'layout-column sortable-column';
            columnDiv.style.flexBasis = column.width;
            columnDiv.dataset.columnId = column.id;

            column.elements.forEach(elementId => {
                const elementData = currentConfig.elements.find(el => el.id === elementId);
                if (elementData) {
                    const elementNode = createAdminElement(elementData);
                    columnDiv.appendChild(elementNode);
                }
            });
            elementContainer.appendChild(columnDiv);
        });
        
        canvas.appendChild(elementContainer);
        initInteractivity();
    }

    function createAdminElement(elementData) {
        const wrapper = document.createElement('div');
        wrapper.className = 'admin-element-wrapper';
        wrapper.dataset.elementId = elementData.id;

        // Создаем оверлей для перетаскивания и кликов
        const overlay = document.createElement('div');
        overlay.className = 'admin-element-overlay';
        wrapper.appendChild(overlay);

        // Используем публичную фабрику для создания "внутренностей" элемента
        const publicElement = createElement(elementData); // Функция из main.js, но нужно ее скопировать сюда
        
        // Для iframe добавляем sandbox для безопасности
        const iframe = publicElement.querySelector('iframe');
        if (iframe) {
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
            iframe.style.pointerEvents = 'none'; // Предотвращает "кражу" кликов
        }

        wrapper.appendChild(publicElement);
        
        // Добавляем обработчик клика для выбора элемента
        wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            selectElement(elementData.id);
        });

        return wrapper;
    }
    
    // --- ИНТЕРАКТИВНОСТЬ ---

    function initInteractivity() {
        // Инициализация SortableJS для колонок
        const columns = document.querySelectorAll('.sortable-column');
        columns.forEach(col => {
            new Sortable(col, {
                group: 'shared',
                animation: 150,
                onEnd: updateStructureFromDOM,
            });
        });
    }

    function makePanelsInteractive() {
        interact('.floating-panel')
            .draggable({
                allowFrom: '.panel-header',
                modifiers: [
                    interact.modifiers.restrictRect({
                        restriction: 'parent',
                        endOnly: true
                    })
                ],
                inertia: true,
                onmove: (event) => {
                    const target = event.target;
                    const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                    const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

                    target.style.transform = `translate(${x}px, ${y}px)`;
                    target.setAttribute('data-x', x);
                    target.setAttribute('data-y', y);
                }
            });
    }

    // --- УПРАВЛЕНИЕ ЭЛЕМЕНТАМИ И ИНСПЕКТОР ---
    
    function selectElement(elementId) {
        // Снимаем выделение с предыдущего
        const oldSelected = document.querySelector('.admin-element-wrapper.selected');
        if (oldSelected) oldSelected.classList.remove('selected');
        
        // Выделяем новый
        const newSelected = document.querySelector(`.admin-element-wrapper[data-element-id="${elementId}"]`);
        if (newSelected) {
            newSelected.classList.add('selected');
            selectedElementId = elementId;
            renderInspector(elementId);
        }
    }

    function renderInspector(elementId) {
        const elementData = currentConfig.elements.find(el => el.id === elementId);
        if (!elementData) return;

        const inspectorPanel = document.getElementById('inspector-panel');
        const inspectorBody = document.getElementById('inspector-body');
        inspectorBody.innerHTML = ''; // Очистка

        let fieldsHtml = `
            <div class="inspector-group">
                <h4>ДЕЙСТВИЯ С БЛОКОМ</h4>
                <button id="delete-element-btn">Удалить элемент</button>
            </div>
            <div class="inspector-group">
                <h4>ОБЩИЕ</h4>
                <div class="inspector-field">
                    <label>ID (не изменять)</label>
                    <input type="text" value="${elementData.id}" readonly>
                </div>
                <div class="inspector-field">
                    <label>Заголовок (для админки)</label>
                    <input type="text" data-key="adminTitle" value="${elementData.adminTitle || ''}">
                </div>
            </div>
            <div class="inspector-group">
                <h4>СОДЕРЖИМОЕ</h4>
                ${generateContentFields(elementData)}
            </div>
            <div class="inspector-group">
                <h4>РАЗМЕРЫ И СТИЛЬ</h4>
                ${generateStyleFields(elementData.styles)}
            </div>
        `;
        
        inspectorBody.innerHTML = fieldsHtml;
        inspectorPanel.style.display = 'block';

        // Добавляем обработчики
        inspectorBody.querySelectorAll('input, textarea, select').forEach(input => {
            input.addEventListener('input', updateElementFromInspector);
        });
        
        document.getElementById('delete-element-btn').addEventListener('click', deleteSelectedElement);
    }
    
    function generateContentFields(element) {
        switch(element.type) {
            case 'externalBlock':
            case 'photo':
            case 'videoBlock':
                return `<div class="inspector-field">
                          <label>URL контента</label>
                          <input type="text" data-content-key="url" value="${element.content.url || ''}">
                        </div>`;
            case 'textBlock':
                return `<div class="inspector-field">
                          <label>HTML контент</label>
                          <textarea data-content-key="html">${element.content.html || ''}</textarea>
                        </div>`;
            case 'button':
                return `<div class="inspector-field">
                           <label>Текст кнопки</label>
                           <input type="text" data-content-key="text" value="${element.content.text || ''}">
                        </div>
                        <div class="inspector-field">
                           <label>Действие</label>
                           <select data-content-key="action">
                               <option value="openLink" ${element.content.action === 'openLink' ? 'selected' : ''}>Открыть ссылку</option>
                               <option value="openModal" ${element.content.action === 'openModal' ? 'selected' : ''}>Модальное окно</option>
                           </select>
                        </div>
                        <div class="inspector-field">
                           <label>Ссылка (URL)</label>
                           <input type="text" data-content-key="url" value="${element.content.url || ''}">
                        </div>
                        <div class="inspector-field">
                           <label>Контент модального окна (HTML)</label>
                           <textarea data-content-key="modalContent">${element.content.modalContent || ''}</textarea>
                        </div>`;
            default: return '';
        }
    }
    
    function generateStyleFields(styles) {
        // Пример полей. Можно расширить для всех нужных свойств CSS
        return `
            <div class="inspector-field"><label>Ширина (width)</label><input type="text" data-style-key="width" value="${styles.width || ''}"></div>
            <div class="inspector-field"><label>Высота (height)</label><input type="text" data-style-key="height" value="${styles.height || ''}"></div>
            <div class="inspector-field"><label>Цвет фона (backgroundColor)</label><input type="color" data-style-key="backgroundColor" value="${styles.backgroundColor || '#ffffff'}"></div>
            <div class="inspector-field"><label>Цвет текста (color)</label><input type="color" data-style-key="color" value="${styles.color || '#000000'}"></div>
            <div class="inspector-field"><label>Внутренние отступы (padding)</label><input type="text" data-style-key="padding" value="${styles.padding || ''}"></div>
            <div class="inspector-field"><label>Скругление углов (borderRadius)</label><input type="text" data-style-key="borderRadius" value="${styles.borderRadius || ''}"></div>
            <div class="inspector-field"><label>Тень (boxShadow)</label><input type="text" data-style-key="boxShadow" value="${styles.boxShadow || ''}"></div>
        `;
    }

    function updateElementFromInspector(event) {
        if (!selectedElementId) return;

        const elementData = currentConfig.elements.find(el => el.id === selectedElementId);
        const input = event.target;
        
        if (input.dataset.key) {
            elementData[input.dataset.key] = input.value;
        } else if (input.dataset.contentKey) {
            elementData.content[input.dataset.contentKey] = input.value;
        } else if (input.dataset.styleKey) {
            elementData.styles[input.dataset.styleKey] = input.value;
        }
        
        // Перерисовываем измененный элемент на холсте
        const oldElement = document.querySelector(`.admin-element-wrapper[data-element-id="${selectedElementId}"]`);
        if(oldElement) {
            const newElement = createAdminElement(elementData);
            oldElement.replaceWith(newElement);
            newElement.classList.add('selected'); // Сохраняем выделение
        }
    }
    
    function deleteSelectedElement() {
        if (!selectedElementId || !confirm('Вы уверены, что хотите удалить этот элемент?')) return;
        
        // Удаляем из массива elements
        currentConfig.elements = currentConfig.elements.filter(el => el.id !== selectedElementId);
        
        // Удаляем из всех колонок в layout
        currentConfig.layout.main.columns.forEach(col => {
            col.elements = col.elements.filter(id => id !== selectedElementId);
        });
        
        // Скрываем инспектор и перерисовываем холст
        document.getElementById('inspector-panel').style.display = 'none';
        selectedElementId = null;
        renderCanvas();
    }
    
    function addNewElement(type) {
        if (currentConfig.layout.main.columns.length === 0) {
            alert('Сначала добавьте хотя бы одну колонку в макете!');
            return;
        }
        
        const newElement = {
            id: `el-${new Date().getTime()}`,
            adminTitle: `Новый элемент (${type})`,
            type: type,
            content: {},
            styles: {}
        };
        
        // Задаем базовый контент в зависимости от типа
        switch(type) {
            case 'textBlock': newElement.content.html = '<p>Новый текстовый блок.</p>'; break;
            case 'photo': newElement.content.url = 'https://via.placeholder.com/400x200'; break;
            case 'button': newElement.content.text = 'Нажми меня'; newElement.styles.padding = '10px'; break;
        }
        
        currentConfig.elements.push(newElement);
        // Добавляем в начало первой колонки
        currentConfig.layout.main.columns[0].elements.unshift(newElement.id);
        
        renderCanvas();
        selectElement(newElement.id);
    }
    
    // --- УПРАВЛЕНИЕ СТРУКТУРОЙ ---

    function setupToolbarActions() {
        document.querySelectorAll('.add-element-btn').forEach(btn => {
            btn.onclick = () => addNewElement(btn.dataset.type);
        });
        
        document.querySelectorAll('.preview-btn').forEach(btn => {
            btn.onclick = () => {
                const canvas = document.getElementById('admin-canvas');
                if (btn.dataset.mode === 'desktop') canvas.style.width = '100%';
                if (btn.dataset.mode === 'tablet') canvas.style.width = '768px';
                if (btn.dataset.mode === 'mobile') canvas.style.width = '375px';
            }
        });
    }

    function updateStructureFromDOM() {
        const newColumns = [];
        document.querySelectorAll('.sortable-column').forEach(columnDiv => {
            const columnId = columnDiv.dataset.columnId;
            const originalColumn = currentConfig.layout.main.columns.find(c => c.id === columnId);
            
            const elementIds = Array.from(columnDiv.querySelectorAll('.admin-element-wrapper'))
                                  .map(el => el.dataset.elementId);
            
            newColumns.push({
                ...originalColumn,
                elements: elementIds
            });
        });
        currentConfig.layout.main.columns = newColumns;
        console.log("Структура обновлена после перетаскивания.");
    }
    
    // --- СОХРАНЕНИЕ НА GITHUB ---
    
    async function saveConfiguration() {
        saveBtn.textContent = 'Сохранение...';
        saveBtn.disabled = true;

        // Перед сохранением убедимся, что структура актуальна
        updateStructureFromDOM();
        
        const { username, repo } = currentConfig.github;
        const filePath = 'config.json';
        const url = `https://api.github.com/repos/${username}/${repo}/contents/${filePath}`;

        try {
            // 1. Получаем текущий SHA файла
            const getFileResponse = await fetch(url, {
                headers: { 'Authorization': `token ${githubToken}` }
            });
            if (!getFileResponse.ok) throw new Error('Не удалось получить SHA файла.');
            const fileData = await getFileResponse.json();
            const sha = fileData.sha;

            // 2. Готовим данные для отправки
            const contentToSave = JSON.stringify(currentConfig, null, 2);
            const encodedContent = btoa(unescape(encodeURIComponent(contentToSave))); // Кодируем в Base64 с поддержкой UTF-8
            
            const body = JSON.stringify({
                message: `[Admin Panel] Update config.json at ${new Date().toISOString()}`,
                content: encodedContent,
                sha: sha
            });
            
            // 3. Отправляем PUT-запрос
            const saveResponse = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Content-Type': 'application/json'
                },
                body: body
            });
            
            if (saveResponse.ok) {
                alert('Конфигурация успешно сохранена!');
            } else {
                const errorData = await saveResponse.json();
                throw new Error(`Ошибка сохранения: ${errorData.message}`);
            }

        } catch (error) {
            console.error('Ошибка сохранения на GitHub:', error);
            alert(`Произошла ошибка при сохранении: ${error.message}`);
        } finally {
            saveBtn.textContent = '💾 Сохранить';
            saveBtn.disabled = false;
        }
    }
    
    
    // --- КОПИЯ ФАБРИКИ ЭЛЕМЕНТОВ (для админки) ---
    // Это нужно, чтобы admin.js был независим от main.js
    function createElement(elementData) {
        const wrapper = document.createElement('div');
        wrapper.className = `element-wrapper type-${elementData.type}`;
        wrapper.id = elementData.id;

        let element;
        switch (elementData.type) {
            case 'externalBlock':
            case 'videoBlock':
                element = document.createElement('iframe');
                element.src = elementData.content.url;
                element.setAttribute('frameborder', '0');
                element.setAttribute('allowfullscreen', '');
                break;
            case 'textBlock':
                element = document.createElement('div');
                element.innerHTML = elementData.content.html;
                break;
            case 'photo':
                element = document.createElement('img');
                element.src = elementData.content.url;
                element.alt = elementData.adminTitle || 'Изображение';
                break;
            case 'button':
                element = document.createElement('button');
                element.textContent = elementData.content.text;
                // В админке кнопки неактивны
                element.style.pointerEvents = 'none';
                break;
            default:
                element = document.createElement('div');
                element.textContent = 'Неизвестный тип элемента';
        }

        if (elementData.styles) {
            Object.assign(element.style, elementData.styles);
        }

        wrapper.appendChild(element);
        return wrapper;
    }
});