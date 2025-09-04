document.addEventListener('DOMContentLoaded', () => {
    // --- НАСТРОЙКИ ---
    const GITHUB_USER = 'YOUR_GITHUB_USERNAME'; // <<< ВАШ ЮЗЕРНЕЙМ GITHUB
    const GITHUB_REPO = 'YOUR_REPOSITORY_NAME'; // <<< ИМЯ ВАШЕГО РЕПОЗИТОРИЯ

    // --- DOM ЭЛЕМЕНТЫ ---
    const loginView = document.getElementById('login-view');
    const adminView = document.getElementById('admin-view');
    const loginBtn = document.getElementById('login-btn');
    const tokenInput = document.getElementById('github-token');
    const saveBtn = document.getElementById('save-btn');
    const canvas = document.getElementById('admin-canvas');
    const container = document.getElementById('element-container');
    
    // --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
    let currentConfig = {};
    let githubToken = '';
    let selectedElementId = null;

    // --- ЛОГИКА ВХОДА ---
    // ... (код входа остается таким же, как в предыдущем ответе)
    loginBtn.addEventListener('click', () => { /* ... */ });
    const savedToken = localStorage.getItem('github_token');
    if (savedToken) { /* ... */ }

    // --- ОСНОВНАЯ ФУНКЦИЯ ЗАГРУЗКИ ПАНЕЛИ ---
    async function loadAdminPanel() {
        try {
            const response = await fetch('config.json?cachebust=' + new Date().getTime());
            currentConfig = await response.json();
            renderLayoutAndSettings();
            renderElementsOnCanvas();
            setupToolbarActions();
            makePanelsInteractive();
        } catch (error) {
            alert('Ошибка загрузки конфига: ' + error.message);
        }
    }

    // --- ФУНКЦИИ РЕНДЕРИНГА (ОТОБРАЖЕНИЯ) ---
    function renderLayoutAndSettings() {
        // Заполняем все панели настроек из config.json
        // ... (детализированный код для заполнения всех полей)
    }

    function renderElementsOnCanvas() {
        container.innerHTML = ''; // Очищаем холст
        currentConfig.elements.forEach(element => {
            // ... (код создания элементов, как в предыдущем ответе)
        });
        makeElementsDraggable(); // Делаем созданные элементы интерактивными
    }

    // --- ИНТЕРАКТИВНОСТЬ ЭЛЕМЕНТОВ И ПАНЕЛЕЙ ---
    function makeElementsDraggable() {
        // Используем interact.js для перетаскивания и ресайза элементов на холсте
        // ... (код из предыдущего ответа)
        interact('.draggable-element').on('tap', (event) => {
            // ... логика выбора элемента и показа инспектора ...
        });
    }

    function makePanelsInteractive() {
        // Делаем панели настроек плавающими и изменяемыми в размере
        interact('.floating-panel')
            .draggable({
                allowFrom: '.panel-header', // Перетаскивать можно только за заголовок
                modifiers: [
                    interact.modifiers.restrictRect({
                        restriction: 'parent',
                        endOnly: true
                    })
                ]
            })
            .resizable({
                edges: { top: true, left: true, bottom: true, right: true }
            })
            .on('dragmove resizemove', (event) => {
                const target = event.target;
                let x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                let y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

                target.style.width = event.rect.width + 'px';
                target.style.height = event.rect.height + 'px';
                target.style.transform = `translate(${x}px, ${y}px)`;

                target.setAttribute('data-x', x);
                target.setAttribute('data-y', y);
            });
    }
    
    // --- УПРАВЛЕНИЕ С ВЕРХНЕЙ ПАНЕЛИ (TOOLBAR) ---
    function setupToolbarActions() {
        // Кнопки для показа/скрытия панелей настроек
        document.getElementById('toggle-global-settings').onclick = () => togglePanel('global-settings-panel');
        document.getElementById('toggle-layout-settings').onclick = () => togglePanel('layout-settings-panel');

        // Кнопки для изменения вида холста
        document.getElementById('view-desktop').onclick = () => canvas.className = '';
        document.getElementById('view-tablet').onclick = () => canvas.className = 'tablet-view';
        document.getElementById('view-mobile').onclick = () => canvas.className = 'mobile-view';
        
        // Кнопки для добавления новых элементов
        document.querySelector('#add-element-toolbar').addEventListener('click', (e) => {
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
        // Создает новый объект элемента, добавляет в currentConfig.elements и перерисовывает холст
        const newElement = {
            id: type + '_' + Date.now(),
            type: type,
            title: `Новый ${type}`,
            position: { x: 20, y: 20 },
            size: { width: 300, height: 200 },
            visible: true,
            // ... другие свойства по умолчанию
        };
        currentConfig.elements.push(newElement);
        renderElementsOnCanvas();
        // Сразу выделяем новый элемент
        selectElement(document.getElementById(newElement.id));
    }
    
    // --- ЛОГИКА СОХРАНЕНИЯ (остается концептуально такой же) ---
    saveBtn.addEventListener('click', async () => {
        // 1. Собрать все данные со всех полей и элементов на холсте
        // 2. Сформировать новый объект currentConfig
        // 3. Отправить его на GitHub API, как в предыдущем ответе
    });
});