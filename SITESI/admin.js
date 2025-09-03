document.addEventListener('DOMContentLoaded', () => {
    const loginView = document.getElementById('login-view');
    const adminView = document.getElementById('admin-view');
    const loginBtn = document.getElementById('login-btn');
    const tokenInput = document.getElementById('github-token');

    const GITHUB_USER = 'YOUR_GITHUB_USERNAME'; // <<< ЗАМЕНИТЕ НА ВАШ ЮЗЕРНЕЙМ
    const GITHUB_REPO = 'YOUR_REPOSITORY_NAME'; // <<< ЗАМЕНИТЕ НА ИМЯ РЕПОЗИТОРИЯ

    let currentConfig = {};
    let githubToken = '';

    // Вход в админку
    loginBtn.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        if (!token) {
            alert('Введите токен!');
            return;
        }
        githubToken = token;
        localStorage.setItem('github_token', token); // Сохраняем токен в браузере
        loginView.style.display = 'none';
        adminView.style.display = 'block';
        loadAdminPanel();
    });

    // Авто-вход, если токен сохранен
    const savedToken = localStorage.getItem('github_token');
    if (savedToken) {
        tokenInput.value = savedToken;
        loginBtn.click();
    }
    
    // Загрузка данных и построение панели
    async function loadAdminPanel() {
        try {
            const response = await fetch('config.json');
            currentConfig = await response.json();

            document.getElementById('header-editor').value = currentConfig.headerContent;
            document.getElementById('footer-editor').value = currentConfig.footerContent;
            
            const routeContainer = document.getElementById('route-container');
            routeContainer.innerHTML = ''; // Очищаем контейнер

            currentConfig.routes.forEach(route => {
                const div = document.createElement('div');
                div.className = 'route-window draggable-route';
                div.dataset.id = route.id; // Сохраняем ID
                div.style.position = 'absolute';
                div.style.left = `${route.position.x}px`;
                div.style.top = `${route.position.y}px`;
                div.style.width = `${route.size.width}px`;
                div.style.height = `${route.size.height}px`;
                div.innerHTML = `<h3>${route.title}</h3><p>${route.url}</p>`;
                routeContainer.appendChild(div);
            });

            // Делаем блоки перетаскиваемыми с помощью interact.js
            interact('.draggable-route')
                .draggable({
                    listeners: {
                        move(event) {
                            const target = event.target;
                            const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                            const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
                            target.style.transform = `translate(${x}px, ${y}px)`;
                            target.setAttribute('data-x', x);
                            target.setAttribute('data-y', y);
                        }
                    },
                    modifiers: [
                        interact.modifiers.restrictRect({
                            restriction: 'parent'
                        })
                    ]
                })
                .resizable({
                    edges: { left: true, right: true, bottom: true, top: true },
                    listeners: {
                        move(event) {
                            let { x, y } = event.target.dataset;
                            x = parseFloat(x) || 0;
                            y = parseFloat(y) || 0;
                            Object.assign(event.target.style, {
                                width: `${event.rect.width}px`,
                                height: `${event.rect.height}px`,
                                transform: `translate(${x}px, ${y}px)`
                            });
                        }
                    }
                });

        } catch (error) {
            alert('Ошибка загрузки конфига: ' + error.message);
        }
    }

    // Сохранение изменений
    document.getElementById('save-btn').addEventListener('click', async () => {
        // 1. Собираем новые данные
        const newConfig = { ...currentConfig };
        newConfig.headerContent = document.getElementById('header-editor').value;
        newConfig.footerContent = document.getElementById('footer-editor').value;
        
        const routeElements = document.querySelectorAll('.draggable-route');
        routeElements.forEach(el => {
            const routeId = el.dataset.id;
            const route = newConfig.routes.find(r => r.id === routeId);
            if (route) {
                const transform = el.style.transform.match(/translate\((.+)px, (.+)px\)/);
                const currentX = parseInt(el.style.left);
                const currentY = parseInt(el.style.top);
                const dx = transform ? parseFloat(transform[1]) : 0;
                const dy = transform ? parseFloat(transform[2]) : 0;
                
                route.position.x = currentX + dx;
                route.position.y = currentY + dy;
                route.size.width = parseInt(el.style.width);
                route.size.height = parseInt(el.style.height);
            }
        });
        
        // 2. Отправляем на GitHub API для сохранения
        const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/config.json`;
        
        try {
            // Сначала нужно получить SHA-хэш текущего файла (обязательно для обновления)
            const fileResponse = await fetch(url, {
                headers: { 'Authorization': `token ${githubToken}` }
            });
            const fileData = await fileResponse.json();
            
            // Формируем запрос на обновление
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Обновление настроек от ${new Date().toISOString()}`,
                    content: btoa(unescape(encodeURIComponent(JSON.stringify(newConfig, null, 2)))), // Кодируем JSON в Base64
                    sha: fileData.sha // Передаем SHA старого файла
                })
            });

            if (response.ok) {
                alert('Настройки успешно сохранены! Изменения появятся на сайте через 1-2 минуты.');
                location.reload();
            } else {
                const error = await response.json();
                alert(`Ошибка сохранения: ${error.message}`);
            }
        } catch (error) {
            alert('Сетевая ошибка: ' + error.message);
        }
    });
});