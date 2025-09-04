document.addEventListener('DOMContentLoaded', () => {
    // --- НАСТРОЙКИ ---
    const GITHUB_USER = 'znamenskiialeksei'; // <<< ВАШ ЮЗЕРНЕЙМ GITHUB
    const GITHUB_REPO = 'marmarisyachting'; // <<< ИМЯ ВАШЕГО РЕПОЗИТОРИЯ

    // --- DOM ЭЛЕМЕНТЫ ---
    const loginView = document.getElementById('login-view');
    const adminView = document.getElementById('admin-view');
    const loginBtn = document.getElementById('login-btn');
    const tokenInput = document.getElementById('github-token');
    const saveBtn = document.getElementById('save-btn');
    const container = document.getElementById('element-container');
    const inspectorPanel = document.getElementById('element-inspector-panel');

    // --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
    let currentConfig = {};
    let githubToken = '';
    let selectedElementId = null;

    // --- ЛОГИКА ВХОДА ---
    loginBtn.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        if (!token) return alert('Введите токен!');
        githubToken = token;
        localStorage.setItem('github_token', token);
        loginView.style.display = 'none';
        adminView.style.display = 'flex';
        loadAdminPanel();
    });
    const savedToken = localStorage.getItem('github_token');
    if (savedToken) {
        tokenInput.value = savedToken;
        loginBtn.click();
    }
    
    // --- ОСНОВНАЯ ФУНКЦИЯ ЗАГРУЗКИ ПАНЕЛИ ---
    async function loadAdminPanel() {
        try {
            const response = await fetch('config.json?cachebust=' + new Date().getTime());
            currentConfig = await response.json();
            renderLayout();
            renderElements();
            setupGlobalListeners();
        } catch (error) {
            alert('Ошибка загрузки конфига: ' + error.message);
        }
    }

    // --- ФУНКЦИИ РЕНДЕРИНГА (ОТОБРАЖЕНИЯ) ---
    function renderLayout() {
        // Глобальные настройки
        document.querySelector('[data-config-key="globalSettings.pageTitle"]').value = currentConfig.globalSettings.pageTitle;
        // Настройки шапки
        document.querySelector('[data-config-key="layout.header.content"]').value = currentConfig.layout.header.content;
        document.querySelector('[data-config-key="layout.header.background.type"]').value = currentConfig.layout.header.background.type;
        document.querySelector('[data-config-key="layout.header.background.url"]').value = currentConfig.layout.header.background.url || currentConfig.layout.header.background.color || '';
    }

    function renderElements() {
        container.innerHTML = '';
        currentConfig.elements.forEach(element => {
            if (!element.visible) return;
            const elWrapper = document.createElement('div');
            elWrapper.className = `element-wrapper draggable-element type-${element.type}`;
            elWrapper.id = element.id;
            elWrapper.style.position = 'absolute';
            elWrapper.style.left = `${element.position.x}px`;
            elWrapper.style.top = `${element.position.y}px`;
            elWrapper.style.width = `${element.size.width}px`;
            elWrapper.style.height = `${element.size.height}px`;

            // Упрощенное отображение в админке
            elWrapper.innerHTML = `<strong>${element.title || element.type}</strong>`;
            
            container.appendChild(elWrapper);
        });
        makeElementsInteractive();
    }

    // --- ИНТЕРАКТИВНОСТЬ (DRAG & DROP) ---
    function makeElementsInteractive() {
        interact('.draggable-element')
            .draggable({
                listeners: {
                    move(event) {
                        const target = event.target;
                        const x = (parseFloat(target.style.left) || 0) + event.dx;
                        const y = (parseFloat(target.style.top) || 0) + event.dy;
                        target.style.left = `${x}px`;
                        target.style.top = `${y}px`;
                        updateInspectorPosition(x, y);
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
                        updateInspectorSize(event.rect.width, event.rect.height);
                    }
                }
            })
            .on('tap', (event) => {
                selectElement(event.currentTarget);
            });
    }

    // --- ЛОГИКА ИНСПЕКТОРА ---
    function selectElement(element) {
        document.querySelectorAll('.draggable-element.selected').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        selectedElementId = element.id;
        showInspectorForElement(selectedElementId);
    }

    function showInspectorForElement(elementId) {
        const elementData = currentConfig.elements.find(el => el.id === elementId);
        if (!elementData) return;

        inspectorPanel.style.display = 'block';
        document.getElementById('inspector-element-id').textContent = `(${elementData.title || elementData.id})`;
        
        // Заполняем общие поля
        inspectorPanel.querySelector('[data-prop="id"]').value = elementData.id;
        inspectorPanel.querySelector('[data-prop="title"]').value = elementData.title;
        inspectorPanel.querySelector('[data-prop="visible"]').checked = elementData.visible;

        // Показываем поля для конкретного типа
        inspectorPanel.querySelectorAll('.type-fields').forEach(f => f.style.display = 'none');
        const typeFields = document.getElementById(`${elementData.type}-fields`);
        if (typeFields) {
            typeFields.style.display = 'block';
            // Заполняем специфичные поля
            switch (elementData.type) {
                case 'player':
                case 'videoBlock':
                    typeFields.querySelector('[data-prop="url"]').value = elementData.url;
                    break;
                case 'textBlock':
                    typeFields.querySelector('[data-prop="content"]').value = elementData.content;
                    break;
                case 'button':
                    typeFields.querySelector('[data-prop="text"]').value = elementData.text;
                    typeFields.querySelector('[data-prop="action"]').value = elementData.action;
                    typeFields.querySelector('[data-prop="link"]').value = elementData.link || '';
                    typeFields.querySelector('[data-prop="modalContent"]').value = elementData.modalContent || '';
                    typeFields.querySelector('[data-style-prop="backgroundColor"]').value = elementData.style.backgroundColor;
                    typeFields.querySelector('[data-style-prop="textColor"]').value = elementData.style.textColor;
                    typeFields.querySelector('[data-style-prop="pulsing"]').checked = elementData.style.pulsing;
                    break;
            }
        }
    }
    
    // Обновление полей инспектора при перетаскивании/ресайзе
    function updateInspectorPosition(x, y) { /* ... */ }
    function updateInspectorSize(w, h) { /* ... */ }

    // --- ЛОГИКА СОХРАНЕНИЯ ---
    saveBtn.addEventListener('click', async () => {
        // 1. Собрать все данные из инспектора и с холста в объект currentConfig
        // ... (это самая объемная часть, требующая прохода по всем полям и элементам)

        // 2. Отправить на GitHub API
        const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/config.json`;
        try {
            const fileResponse = await fetch(url, { headers: { 'Authorization': `token ${githubToken}` } });
            const fileData = await fileResponse.json();
            
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
                alert('Настройки сохранены! Обновите публичную страницу через 1-2 минуты.');
            } else {
                alert(`Ошибка сохранения: ${(await response.json()).message}`);
            }
        } catch (error) {
            alert('Сетевая ошибка: ' + error.message);
        }
    });

    function setupGlobalListeners() { /* ... */ }
});