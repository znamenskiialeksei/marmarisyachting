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

    // --- 2. ФУНКЦИИ РЕНДЕРИНГА ---
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
                    <select class="bg-type-selector" data-layout-part="${part}"><option value="color">Цвет</option><option value="image">Изображение</option><option value="video">Видео</option></select>
                    <label>Значение (цвет HEX или URL):</label>
                    <input type="text" class="bg-url-input" data-layout-part="${part}">
                </details>
            `).join('')}
            <div class="column-controls">
                <hr><label>Колонки основного контента:</label>
                <div id="columns-editor"></div>
                <button id="add-column-btn">+ Добавить колонку</button>
            </div>
        `;
        layoutSettingsPanel.querySelector('.panel-content').innerHTML = layoutContent;

        ['header', 'main', 'footer'].forEach(part => {
            const bg = currentConfig.layout[part].background;
            const panel = layoutSettingsPanel;
            panel.querySelector(`.bg-type-selector[data-layout-part="${part}"]`).value = bg.type;
            panel.querySelector(`.bg-url-input[data-layout-part="${part}"]`).value = bg.url || bg.color || '';
        });
        
        renderColumnsEditor();
    }
    
    function renderColumnsEditor() {
        const editor = document.getElementById('columns-editor');
        if(!editor) return;
        editor.innerHTML = '';
        currentConfig.layout.main.columns.forEach((col, index) => {
            editor.innerHTML += `
                <div class="column-editor">
                    <span>Колонка ${index + 1}:</span>
                    <input type="text" value="${col.width}" data-col-id="${col.id}" class="column-width-input" placeholder="н.р. 50% или 1fr">
                    <button data-col-id="${col.id}" class="delete-column-btn" title="Удалить колонку">❌</button>
                </div>
            `;
        });
    }

    function renderElementsOnCanvas() {
        container.innerHTML = '';
        if(!currentConfig.layout.main.columns) currentConfig.layout.main.columns = [];
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
        initInteractivity();
    }

    function createAndSetupElement(elementData) {
        const elWrapper = document.createElement('div');
        elWrapper.className = `element-wrapper draggable-element type-${elementData.type}`;
        elWrapper.id = elementData.id;
        elWrapper.dataset.elementId = elementData.id;

        if (elementData.style) Object.assign(elWrapper.style, elementData.style);
        
        const overlay = `<div class="admin-element-overlay"></div>`;
        
        switch (elementData.type) {
            case 'externalBlock': case 'player':
                elWrapper.innerHTML = `${overlay}<iframe src="${elementData.url}" scrolling="no" sandbox=""></iframe>`; break;
            case 'videoBlock': case 'reels':
                elWrapper.innerHTML = `${overlay}<iframe src="${elementData.url}" sandbox="allow-fullscreen" allowfullscreen></iframe>`;
                if (elementData.type === 'reels') elWrapper.style.aspectRatio = '9 / 16';
                break;
            case 'textBlock':
                elWrapper.innerHTML = elementData.content; break;
            case 'photo':
                elWrapper.innerHTML = `<img src="${elementData.url}" alt="${elementData.title || ''}" style="width:100%; height:100%; object-fit: ${elementData.style?.objectFit || 'cover'};">`; break;
            case 'button':
                elWrapper.innerHTML = `<button style="pointer-events:none; width:100%; height:100%; background:${elementData.style?.backgroundColor}; color:${elementData.style?.color}; font-size:${elementData.style?.fontSize}; border-radius:${elementData.style?.borderRadius}; border:none;">${elementData.text || 'Кнопка'}</button>`; break;
        }

        elWrapper.addEventListener('click', (e) => { e.stopPropagation(); selectElement(elWrapper); });
        return elWrapper;
    }

    // --- 3. ИНТЕРАКТИВНОСТЬ ---
    function initInteractivity() {
        document.querySelectorAll('.sortable-column').forEach(col => {
            new Sortable(col, { group: 'shared', animation: 150, handle: '.admin-element-overlay, .draggable-element:not(.type-player, .type-externalBlock, .type-videoBlock, .type-reels)' });
        });

        interact('.draggable-element').resizable({
            edges: { top: true, left: true, bottom: true, right: true },
            listeners: {
                move(event) {
                    const target = event.target;
                    target.style.width = `${event.rect.width}px`;
                    target.style.height = `${event.rect.height}px`;
                    if (target.id === selectedElementId) {
                       updateElementFromResize(target);
                    }
                }
            }
        });
    }

    function makePanelsInteractive() {
        document.body.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('.panel-close-btn');
            if(closeBtn) closeBtn.closest('.floating-panel').style.display = 'none';

            const collapseBtn = e.target.closest('.panel-collapse-btn');
            if(collapseBtn) collapseBtn.closest('.floating-panel').classList.toggle('collapsed');
        });

        interact('.floating-panel').draggable({
            allowFrom: '.panel-header',
            ignoreFrom: '.panel-content, input, textarea, select, button'
        }).styleCursor(false);
    }

    // --- 4. УПРАВЛЕНИЕ С ТУЛБАРА И ПАНЕЛЕЙ ---
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

        layoutSettingsPanel.addEventListener('input', (e) => {
             if (e.target.classList.contains('column-width-input')) {
                const colId = e.target.dataset.colId;
                const column = currentConfig.layout.main.columns.find(c => c.id === colId);
                if(column) column.width = e.target.value;
                renderElementsOnCanvas();
             }
        });
        
        layoutSettingsPanel.addEventListener('click', (e) => {
            if (e.target.id === 'add-column-btn') {
                if(!currentConfig.layout.main.columns) currentConfig.layout.main.columns = [];
                currentConfig.layout.main.columns.push({
                    id: 'column_' + Date.now(), width: '1fr', elements: []
                });
                renderLayoutAndSettings();
                renderElementsOnCanvas();
            }
            if (e.target.classList.contains('delete-column-btn')) {
                const colId = e.target.dataset.colId;
                currentConfig.layout.main.columns = currentConfig.layout.main.columns.filter(c => c.id !== colId);
                renderLayoutAndSettings();
                renderElementsOnCanvas();
            }
        });
    }

    function togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        panel.classList.remove('collapsed');
    }

    function addNewElement(type) {
        if (!currentConfig.layout.main.columns || currentConfig.layout.main.columns.length === 0){
            alert("Сначала добавьте хотя бы одну колонку в настройках макета!");
            return;
        }
        const newElement = {
            id: type + '_' + Date.now(), type, title: `Новый ${type}`, visible: true, style: {width: '100%', height: '300px'},
            ...({
                externalBlock: { style: { height: '650px' } },
                textBlock: { content: '<p>Новый текстовый блок</p>', style: {height: '200px'} },
                photo: { url: 'https://via.placeholder.com/400x300', style: { objectFit: 'cover', height: '300px' } },
                reels: { style: { height: '600px'} },
                videoBlock: { style: { height: '300px'} },
                button: { text: 'Кнопка', style: { backgroundColor: '#007bff', color: '#ffffff', fontSize: '16px', borderRadius: '8px', height: '50px' } }
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
        inspectorPanel.classList.remove('collapsed');
        document.getElementById('inspector-element-id').textContent = `(${elementData.title || elementData.id})`;
        
        let content = `
            <button id="delete-element-btn">Удалить элемент</button><hr>
            <label>ID (не изменять)</label><input type="text" data-prop="id" value="${elementData.id}" readonly>
            <label>Заголовок (для админки)</label><input type="text" data-prop="title" value="${elementData.title || ''}">
        `;
        
        switch (elementData.type) {
            case 'externalBlock': case 'player': case 'videoBlock': case 'reels': case 'photo':
                content += `<label>URL контента</label><input type="text" data-prop="url" value="${elementData.url || ''}">`; break;
            case 'textBlock':
                content += `<label>HTML контент</label><textarea data-prop="content">${elementData.content || ''}</textarea>`; break;
            case 'button':
                content += `<label>Текст кнопки</label><input type="text" data-prop="text" value="${elementData.text || ''}">`; break;
        }

        content += `<hr><details open><summary>Стилизация</summary>
            <label>Ширина (н-р, 100% или 300px)</label><input type="text" data-style-prop="width" value="${elementData.style?.width || ''}">
            <label>Высота (н-р, 650px или auto)</label><input type="text" data-style-prop="height" value="${elementData.style?.height || ''}">
            <label>Цвет фона</label><input type="text" data-style-prop="backgroundColor" value="${elementData.style?.backgroundColor || ''}">
            <label>Цвет текста</label><input type="text" data-style-prop="color" value="${elementData.style?.color || ''}">
            <label>Размер шрифта (н-р, 16px)</label><input type="text" data-style-prop="fontSize" value="${elementData.style?.fontSize || ''}">
            <label>Скругление углов (н-р, 8px)</label><input type="text" data-style-prop="borderRadius" value="${elementData.style?.borderRadius || ''}">
            <label>Тень (CSS)</label><input type="text" data-style-prop="boxShadow" value="${elementData.style?.boxShadow || ''}">
            <label>Внутренние отступы (padding)</label><input type="text" data-style-prop="padding" value="${elementData.style?.padding || ''}">
            ${elementData.type === 'photo' ? `<label>Вписывание фото (object-fit)</label><select data-style-prop="objectFit"><option value="cover">cover</option><option value="contain">contain</option></select>` : ''}
        </details>`;
        
        inspectorContent.innerHTML = content;

        if(elementData.type === 'photo' && inspectorContent.querySelector('[data-style-prop="objectFit"]')) {
            inspectorContent.querySelector('[data-style-prop="objectFit"]').value = elementData.style?.objectFit || 'cover';
        }

        document.getElementById('delete-element-btn').onclick = deleteSelectedElement;
        inspectorContent.querySelectorAll('input, textarea, select').forEach(input => {
            input.addEventListener('input', updateElementFromInspector);
        });
    }

    function updateElementFromInspector(fromResize = false) {
        if (!selectedElementId) return;
        const elementData = currentConfig.elements.find(el => el.id === selectedElementId);
        if (!elementData) return;
        const elementOnCanvas = document.getElementById(selectedElementId);

        if (!elementData.style) elementData.style = {};
        
        if (fromResize) {
            elementData.style.width = elementOnCanvas.style.width;
            elementData.style.height = elementOnCanvas.style.height;
        } else {
            inspectorContent.querySelectorAll('[data-prop]').forEach(input => {
                elementData[input.dataset.prop] = input.value;
            });
            inspectorContent.querySelectorAll('[data-style-prop]').forEach(input => {
                elementData.style[input.dataset.styleProp] = input.value;
            });
        }
        
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
        currentConfig.globalSettings.pageTitle = document.querySelector('[data-config-key="globalSettings.pageTitle"]').value;
        
        ['header', 'main', 'footer'].forEach(part => {
             const panel = layoutSettingsPanel;
             if(currentConfig.layout[part].content !== undefined) {
                 currentConfig.layout[part].content = panel.querySelector(`textarea[data-layout-part="${part}"]`).value;
             }
             const bgType = panel.querySelector(`select[data-layout-part="${part}"]`).value;
             const bgValue = panel.querySelector(`input[data-layout-part="${part}"]`).value;
             currentConfig.layout[part].background.type = bgType;
             if(bgType === 'color') {
                 currentConfig.layout[part].background.color = bgValue;
                 delete currentConfig.layout[part].background.url;
             } else {
                 currentConfig.layout[part].background.url = bgValue;
                 delete currentConfig.layout[part].background.color;
             }
        });
        
        document.querySelectorAll('.column-width-input').forEach(input => {
            const colId = input.dataset.colId;
            const col = currentConfig.layout.main.columns.find(c => c.id === colId);
            if(col) col.width = input.value;
        });
        
        const newColumns = [];
        document.querySelectorAll('.layout-column').forEach(columnEl => {
            newColumns.push({
                id: columnEl.dataset.columnId,
                width: columnEl.style.flexBasis,
                elements: Array.from(columnEl.querySelectorAll('.element-wrapper')).map(el => el.dataset.elementId)
            });
        });
        currentConfig.layout.main.columns = newColumns;

        const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/config.json`;
        saveBtn.textContent = 'Сохранение...';
        saveBtn.disabled = true;

        try {
            const fileResponse = await fetch(url, { headers: { 'Authorization': `token ${githubToken}` } });
            const fileData = await fileResponse.json();
            
            if (!fileResponse.ok) throw new Error(fileData.message || 'Не удалось получить SHA файла.');

            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Authorization': `token ${githubToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Admin Panel: Settings updated at ${new Date().toISOString()}`,
                    content: btoa(unescape(encodeURIComponent(JSON.stringify(currentConfig, null, 2)))),
                    sha: fileData.sha
                })
            });

            if (response.ok) {
                alert('Настройки успешно сохранены! Изменения появятся на сайте через 1-2 минуты.');
            } else {
                alert(`Ошибка сохранения: ${(await response.json()).message}`);
            }
        } catch (error) {
            alert('Сетевая ошибка: ' + error.message);
        } finally {
            saveBtn.textContent = '💾 Сохранить все изменения';
            saveBtn.disabled = false;
        }
    });
});