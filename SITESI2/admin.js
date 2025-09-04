document.addEventListener('DOMContentLoaded', () => {
    // --- НАСТРОЙКИ ---
    const GITHUB_USER = 'znamenskiialeksei';
    const GITHUB_REPO = 'marmarisyachting';

    // --- DOM ЭЛЕМЕНТЫ ---
    const loginView = document.getElementById('login-view');
    const adminView = document.getElementById('admin-view');
    const loginBtn = document.getElementById('login-btn');
    const tokenInput = document.getElementById('github-token');
    const saveBtn = document.getElementById('save-btn');
    const canvas = document.getElementById('admin-canvas');
    const container = document.getElementById('element-container');
    const inspectorPanel = document.getElementById('element-inspector-panel');
    const inspectorContent = document.getElementById('inspector-content');
    const globalSettingsPanel = document.getElementById('global-settings-panel');
    const layoutSettingsPanel = document.getElementById('layout-settings-panel');

    // --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
    let currentConfig = {};
    let githubToken = '';
    let selectedElementId = null;

    // --- 1. ЛОГИКА ВХОДА И ЗАГРУЗКИ ---
    loginBtn.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        if (!token) return alert('Пожалуйста, введите ваш токен доступа GitHub.');
        githubToken = token;
        localStorage.setItem('github_token', token);
        loginView.style.display = 'none';
        adminView.style.display = 'block';
        loadAdminPanel();
    });

    const savedToken = localStorage.getItem('github_token');
    if (savedToken) {
        tokenInput.value = savedToken;
        loginBtn.click();
    }

    async function loadAdminPanel() {
        try {
            const response = await fetch('config.json?cachebust=' + new Date().getTime());
            currentConfig = await response.json();
            renderLayoutAndSettings();
            renderElementsOnCanvas();
            setupToolbarActions();
            makePanelsInteractive();
        } catch (error) {
            console.error(error);
            alert('Ошибка загрузки конфига: ' + error.message);
        }
    }

    // --- 2. ФУНКЦИИ РЕНДЕРИНГА (ОТОБРАЖЕНИЯ) ---
    function renderLayoutAndSettings() {
        globalSettingsPanel.querySelector('.panel-content').innerHTML = `
            <label>Заголовок сайта (Title)</label>
            <input type="text" data-config-key="globalSettings.pageTitle" value="${currentConfig.globalSettings.pageTitle}">
        `;

        const layoutContent = `
            ${['header', 'main', 'footer'].map(part => `
                <details ${part === 'header' ? 'open' : ''}>
                    <summary>${part.charAt(0).toUpperCase() + part.slice(1)}</summary>
                    ${currentConfig.layout[part].content !== undefined ? `<label>HTML контент:</label><textarea data-layout-part="${part}" data-prop="content">${currentConfig.layout[part].content}</textarea>` : ''}
                    <label>Тип фона:</label>
                    <select class="bg-type-selector" data-layout-part="${part}">
                        <option value="color">Цвет</option><option value="image">Изображение</option><option value="video">Видео</option>
                    </select>
                    <label>Значение (цвет HEX или URL):</label>
                    <input type="text" class="bg-url-input" data-layout-part="${part}">
                </details>
            `).join('')}
        `;
        layoutSettingsPanel.querySelector('.panel-content').innerHTML = layoutContent;

        ['header', 'main', 'footer'].forEach(part => {
            const bg = currentConfig.layout[part].background;
            const panel = layoutSettingsPanel;
            panel.querySelector(`.bg-type-selector[data-layout-part="${part}"]`).value = bg.type;
            panel.querySelector(`.bg-url-input[data-layout-part="${part}"]`).value = bg.url || bg.color || '';
        });
    }

    function renderElementsOnCanvas() {
        container.innerHTML = '';
        currentConfig.layout.main.columns.forEach(columnData => {
            const columnEl = document.createElement('div');
            columnEl.className = 'layout-column sortable-column';
            columnEl.style.flexBasis = columnData.width;
            columnEl.dataset.columnId = columnData.id;

            columnData.elements.forEach(elementId => {
                const elementData = currentConfig.elements.find(el => el.id === elementId);
                if (elementData) {
                    const elWrapper = createAndSetupElement(elementData);
                    columnEl.appendChild(elWrapper);
                }
            });
            container.appendChild(columnEl);
        });
        initDragAndDrop();
    }

    function createAndSetupElement(elementData) {
        const elWrapper = document.createElement('div');
        elWrapper.className = `element-wrapper draggable-element type-${elementData.type}`;
        elWrapper.id = elementData.id;
        elWrapper.dataset.elementId = elementData.id;

        if (elementData.height) elWrapper.style.height = elementData.height;
        if (elementData.style) Object.assign(elWrapper.style, elementData.style);

        switch (elementData.type) {
            case 'player':
                elWrapper.innerHTML = `<div class="iframe-overlay"></div><iframe src="${elementData.url}" scrolling="no"></iframe>`;
                break;
            case 'textBlock':
                elWrapper.innerHTML = elementData.content;
                break;
            case 'photo':
                elWrapper.innerHTML = `<img src="${elementData.url}" alt="${elementData.title || ''}" style="width:100%; height:100%; object-fit: ${elementData.style?.objectFit || 'cover'};">`;
                break;
            case 'videoBlock':
            case 'reels':
                elWrapper.innerHTML = `<div class="iframe-overlay"></div><iframe src="${elementData.url}" allowfullscreen></iframe>`;
                if (elementData.type === 'reels') elWrapper.style.aspectRatio = '9 / 16';
                break;
            case 'button':
                elWrapper.innerHTML = `<button style="pointer-events:none; width:100%; height:100%; background:${elementData.style?.backgroundColor}; color:${elementData.style?.color}; font-size:${elementData.style?.fontSize}; border-radius:${elementData.style?.borderRadius}; border:none;">${elementData.text || 'Кнопка'}</button>`;
                break;
        }

        elWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            selectElement(elWrapper);
        });
        return elWrapper;
    }

    // --- 3. ИНТЕРАКТИВНОСТЬ (DRAG & DROP) ---
    function initDragAndDrop() {
        document.querySelectorAll('.sortable-column').forEach(col => {
            new Sortable(col, { group: 'shared', animation: 150, handle: '.element-wrapper' });
        });

        interact('.draggable-element').resizable({
            edges: { bottom: true },
            listeners: {
                move(event) {
                    const target = event.target;
                    target.style.height = `${event.rect.height}px`;
                    updateElementFromInspector(); // Обновляем инспектор
                }
            }
        });
    }

    function makePanelsInteractive() {
        interact('.floating-panel').draggable({
            allowFrom: '.panel-header',
            ignoreFrom: '.panel-content, input, textarea, select, button'
        }).styleCursor(false);
    }

    // --- 4. УПРАВЛЕНИЕ С ТУЛБАРА ---
    function setupToolbarActions() {
        document.getElementById('toggle-global-settings').onclick = () => togglePanel('global-settings-panel');
        document.getElementById('toggle-layout-settings').onclick = () => togglePanel('layout-settings-panel');
        document.getElementById('view-desktop').onclick = () => { canvas.className = ''; canvas.style.maxWidth = '100%'; };
        document.getElementById('view-tablet').onclick = () => { canvas.className = 'tablet-view'; canvas.style.maxWidth = '768px'; };
        document.getElementById('view-mobile').onclick = () => { canvas.className = 'mobile-view'; canvas.style.maxWidth = '420px'; };
        
        document.querySelector('#admin-toolbar').addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && e.target.dataset.type) {
                addNewElement(e.target.dataset.type);
            }
        });
    }

    function togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }

    function addNewElement(type) {
        const newElement = {
            id: type + '_' + Date.now(),
            type,
            title: `Новый ${type}`,
            visible: true,
            style: {},
            ...({
                player: { height: '650px', url: '' },
                textBlock: { content: '<p>Новый текстовый блок</p>' },
                photo: { url: 'https://via.placeholder.com/400x300' },
                reels: { height: '600px', url: '' },
                videoBlock: { height: '300px', url: '' },
                button: { text: 'Кнопка', style: { backgroundColor: '#007bff', color: '#ffffff', fontSize: '16px', borderRadius: '8px' } }
            }[type] || {})
        };
        currentConfig.elements.push(newElement);
        currentConfig.layout.main.columns[0].elements.push(newElement.id);
        renderElementsOnCanvas();
        selectElement(document.getElementById(newElement.id));
    }
    
    // --- 5. УПРАВЛЕНИЕ ИНСПЕКТОРОМ ---
    function selectElement(element) {
        document.querySelectorAll('.draggable-element.selected').forEach(el => el.classList.remove('selected'));
        if (element) {
            element.classList.add('selected');
            selectedElementId = element.dataset.elementId;
            renderInspector();
        } else {
            selectedElementId = null;
            inspectorPanel.style.display = 'none';
        }
    }

    function renderInspector() {
        const elementData = currentConfig.elements.find(el => el.id === selectedElementId);
        if (!elementData) return;

        inspectorPanel.style.display = 'block';
        document.getElementById('inspector-element-id').textContent = `(${elementData.title || elementData.id})`;
        
        let content = `
            <button id="delete-element-btn">Удалить элемент</button><hr>
            <label>ID (не изменять)</label><input type="text" data-prop="id" value="${elementData.id}" readonly>
            <label>Заголовок (для админки)</label><input type="text" data-prop="title" value="${elementData.title || ''}">
        `;
        
        switch (elementData.type) {
            case 'player': case 'videoBlock': case 'reels': case 'photo':
                content += `<label>URL контента</label><input type="text" data-prop="url" value="${elementData.url || ''}">`;
                break;
            case 'textBlock':
                content += `<label>HTML контент</label><textarea data-prop="content">${elementData.content || ''}</textarea>`;
                break;
            case 'button':
                content += `
                    <label>Текст кнопки</label><input type="text" data-prop="text" value="${elementData.text || ''}">
                    <label>Действие</label>
                    <select data-prop="action"><option value="openLink">Открыть ссылку</option><option value="openModal">Модальное окно</option></select>
                    <label>Ссылка (для openLink)</label><input type="text" data-prop="link" value="${elementData.link || ''}">
                    <label>Контент модального окна</label><textarea data-prop="modalContent">${elementData.modalContent || ''}</textarea>
                `;
                break;
        }

        content += `<label>Высота (н-р, 650px или auto)</label><input type="text" data-prop="height" value="${elementData.height || 'auto'}">`;

        content += `<hr><details open><summary>Стилизация</summary>
            <label>Цвет фона</label><input type="text" data-style-prop="backgroundColor" value="${elementData.style?.backgroundColor || ''}">
            <label>Цвет текста</label><input type="text" data-style-prop="color" value="${elementData.style?.color || ''}">
            <label>Размер шрифта (н-р, 16px)</label><input type="text" data-style-prop="fontSize" value="${elementData.style?.fontSize || ''}">
            <label>Скругление углов (н-р, 8px)</label><input type="text" data-style-prop="borderRadius" value="${elementData.style?.borderRadius || ''}">
            <label>Тень (CSS)</label><input type="text" data-style-prop="boxShadow" value="${elementData.style?.boxShadow || ''}">
            ${elementData.type === 'photo' ? `<label>Вписывание фото (object-fit)</label><select data-style-prop="objectFit"><option value="cover">cover</option><option value="contain">contain</option></select>` : ''}
        </details>`;
        
        inspectorContent.innerHTML = content;

        if(elementData.type === 'button') inspectorContent.querySelector('[data-prop="action"]').value = elementData.action || 'openLink';
        if(elementData.type === 'photo') inspectorContent.querySelector('[data-style-prop="objectFit"]').value = elementData.style?.objectFit || 'cover';

        document.getElementById('delete-element-btn').onclick = deleteSelectedElement;
        inspectorContent.querySelectorAll('input, textarea, select').forEach(input => {
            input.addEventListener('input', updateElementFromInspector);
        });
    }

    function updateElementFromInspector() {
        if (!selectedElementId) return;
        const elementData = currentConfig.elements.find(el => el.id === selectedElementId);
        if (!elementData) return;

        inspectorContent.querySelectorAll('[data-prop]').forEach(input => {
            const prop = input.dataset.prop;
            elementData[prop] = input.type === 'checkbox' ? input.checked : input.value;
        });
        if (!elementData.style) elementData.style = {};
        inspectorContent.querySelectorAll('[data-style-prop]').forEach(input => {
            const prop = input.dataset.styleProp;
            elementData.style[prop] = input.type === 'checkbox' ? input.checked : input.value;
        });

        const elementOnCanvas = document.getElementById(selectedElementId);
        if (elementOnCanvas) {
            const updatedElement = createAndSetupElement(elementData);
            elementOnCanvas.replaceWith(updatedElement);
            selectElement(updatedElement);
        }
    }
    
    function deleteSelectedElement() {
        if (!selectedElementId || !confirm('Удалить этот элемент?')) return;
        currentConfig.elements = currentConfig.elements.filter(el => el.id !== selectedElementId);
        currentConfig.layout.main.columns.forEach(col => {
            col.elements = col.elements.filter(id => id !== selectedElementId);
        });
        inspectorPanel.style.display = 'none';
        selectedElementId = null;
        renderElementsOnCanvas();
    }
    
    // --- 6. ЛОГИКА СОХРАНЕНИЯ ---
    saveBtn.addEventListener('click', async () => {
        // ... (код сохранения остается без изменений)
    });
});