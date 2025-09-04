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

    // --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
    let currentConfig = {};
    let githubToken = '';
    let selectedElementId = null;

    // --- ЛОГИКА ВХОДА ---
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
            renderLayoutSettings();
            renderElementsOnCanvas();
            setupToolbarActions();
            makePanelsInteractive();
        } catch (error) {
            alert('Ошибка загрузки конфига: ' + error.message);
        }
    }
    
    function renderLayoutSettings() {
        document.querySelector('[data-config-key="globalSettings.pageTitle"]').value = currentConfig.globalSettings.pageTitle;
        document.querySelector('[data-config-key="globalSettings.defaultViewMode"]').value = currentConfig.globalSettings.defaultViewMode;
        
        ['header', 'main', 'footer'].forEach(part => {
            const contentArea = document.querySelector(`[data-config-key="layout.${part}.content"]`);
            if (contentArea) contentArea.value = currentConfig.layout[part].content || '';

            const bg = currentConfig.layout[part].background;
            document.querySelector(`.bg-type-selector[data-target="${part}"]`).value = bg.type;
            document.querySelector(`.bg-url-input[data-target="${part}"]`).value = bg.url || bg.color || '';
        });
    }

    function renderElementsOnCanvas() {
        container.innerHTML = '';
        currentConfig.elements.forEach(element => {
            if (!element.visible) return;
            const elWrapper = document.createElement('div');
            elWrapper.className = `draggable-element type-${element.type}`;
            elWrapper.id = element.id;
            Object.assign(elWrapper.style, {
                position: 'absolute',
                left: `${element.position.x}px`,
                top: `${element.position.y}px`,
                width: `${element.size.width}px`,
                height: `${element.size.height}px`
            });
            elWrapper.innerHTML = `<strong>${element.title || element.type}</strong>`;
            container.appendChild(elWrapper);
        });
        makeElementsInteractive();
    }

    function makeElementsInteractive() {
        interact('.draggable-element')
            .draggable({
                listeners: {
                    move(event) {
                        const target = event.target;
                        target.style.left = `${parseFloat(target.style.left) + event.dx}px`;
                        target.style.top = `${parseFloat(target.style.top) + event.dy}px`;
                        if (target.id === selectedElementId) updateInspectorPosition();
                    }
                },
                modifiers: [interact.modifiers.restrictRect({ restriction: 'parent' })]
            })
            .resizable({
                edges: { left: true, right: true, bottom: true, top: true },
                listeners: {
                    move(event) {
                        Object.assign(event.target.style, {
                            width: `${event.rect.width}px`,
                            height: `${event.rect.height}px`,
                        });
                        if (event.target.id === selectedElementId) updateInspectorSize();
                    }
                }
            })
            .on('tap', (event) => {
                selectElement(event.currentTarget);
            });
    }

    function makePanelsInteractive() {
        interact('.floating-panel').draggable({
            allowFrom: '.panel-header',
            ignoreFrom: '.panel-content, input, textarea, select, button',
            modifiers: [interact.modifiers.restrictRect({ restriction: 'body' })]
        }).styleCursor(false);
    }
    
    function setupToolbarActions() {
        document.getElementById('toggle-global-settings').onclick = () => togglePanel('global-settings-panel');
        document.getElementById('toggle-layout-settings').onclick = () => togglePanel('layout-settings-panel');

        document.getElementById('view-desktop').onclick = () => canvas.className = '';
        document.getElementById('view-tablet').onclick = () => canvas.className = 'tablet-view';
        document.getElementById('view-mobile').onclick = () => canvas.className = 'mobile-view';
        
        document.querySelector('#admin-toolbar').addEventListener('click', (e) => {
            const type = e.target.dataset.type;
            if (type) addNewElement(type);
        });
    }

    function togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }

    function addNewElement(type) {
        const newElement = {
            id: type + '_' + Date.now(),
            type: type,
            title: `Новый ${type}`,
            position: { x: 50, y: 50 },
            size: { width: 350, height: 250 },
            visible: true,
            url: '', text: '', content: '', style: {}
        };
        currentConfig.elements.push(newElement);
        renderElementsOnCanvas();
        selectElement(document.getElementById(newElement.id));
    }
    
    function selectElement(element) {
        document.querySelectorAll('.draggable-element.selected').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        selectedElementId = element.id;
        renderInspector();
    }
    
    function renderInspector() {
        const elementData = currentConfig.elements.find(el => el.id === selectedElementId);
        if (!elementData) return;
        inspectorPanel.style.display = 'block';
        
        let content = `
            <button id="delete-element-btn" style="background: #dc3545; color:white; width:100%; padding:8px; border:none; cursor:pointer;">Удалить элемент</button>
            <hr>
            <label>ID (не изменять)</label><input type="text" id="inspector-id" value="${elementData.id}" readonly>
            <label>Заголовок (для админки)</label><input type="text" id="inspector-title" value="${elementData.title || ''}">
            <label>Видимость</label><input type="checkbox" id="inspector-visible" ${elementData.visible ? 'checked' : ''}>
        `;
        // ... (код для добавления специфичных полей для каждого типа, как в предыдущих примерах)
        inspectorContent.innerHTML = content;
        
        document.getElementById('delete-element-btn').onclick = deleteSelectedElement;
    }

    function deleteSelectedElement() {
        if (!selectedElementId || !confirm('Вы уверены, что хотите удалить этот элемент?')) return;
        currentConfig.elements = currentConfig.elements.filter(el => el.id !== selectedElementId);
        inspectorPanel.style.display = 'none';
        selectedElementId = null;
        renderElementsOnCanvas();
    }

    function updateInspectorPosition() { /* ... */ }
    function updateInspectorSize() { /* ... */ }

    // --- ЛОГИКА СОХРАНЕНИЯ ---
    saveBtn.addEventListener('click', async () => {
        // 1. Собрать все данные
        // ... (сложный код сбора данных из всех полей и элементов)
        
        // 2. Отправить на GitHub API
        const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/config.json`;
        alert("Сохранение... Пожалуйста, подождите.");
        try {
            const fileResponse = await fetch(url, { headers: { 'Authorization': `token ${githubToken}` } });
            const fileData = await fileResponse.json();
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Authorization': `token ${githubToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Admin Panel: Settings updated`,
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
        }
    });
});