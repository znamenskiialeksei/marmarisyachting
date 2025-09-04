document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('config.json?cachebust=' + new Date().getTime());
        if (!response.ok) throw new Error('Не удалось загрузить конфигурацию!');
        const config = await response.json();

        // --- Глобальные настройки ---
        document.title = config.globalSettings.pageTitle;
        document.body.className = `view-mode-${config.globalSettings.defaultViewMode}`;

        // --- Настройка фона ---
        setupBackground('main-header', config.layout.header.background);
        setupBackground('element-container', config.layout.main.background);
        setupBackground('main-footer', config.layout.footer.background);

        // --- Заполнение контента ---
        document.getElementById('main-header').innerHTML += config.layout.header.content;
        document.getElementById('main-footer').innerHTML += config.layout.footer.content;

        // --- Рендеринг всех элементов ---
        const container = document.getElementById('element-container');
        config.elements.forEach(element => {
            if (!element.visible) return; // Пропускаем скрытые элементы

            const elWrapper = document.createElement('div');
            elWrapper.className = `element-wrapper type-${element.type}`;
            elWrapper.id = element.id;
            
            // Стилизация и позиционирование
            Object.assign(elWrapper.style, {
                position: 'absolute',
                left: `${element.position.x}px`,
                top: `${element.position.y}px`,
                width: `${element.size.width}px`,
                height: `${element.size.height}px`
            });

            // Создание контента в зависимости от типа элемента
            switch (element.type) {
                case 'player':
                    elWrapper.innerHTML = `<iframe src="${element.url}" style="width:100%; height:100%; border:0;"></iframe>`;
                    break;
                case 'textBlock':
                    elWrapper.innerHTML = element.content;
                    elWrapper.style.padding = '15px';
                    elWrapper.style.overflow = 'auto';
                    break;
                case 'videoBlock':
                    elWrapper.innerHTML = `<iframe src="${element.url}" style="width:100%; height:100%; border:0;" allowfullscreen></iframe>`;
                    break;
                case 'button':
                    const btn = document.createElement('button');
                    btn.textContent = element.text;
                    Object.assign(btn.style, {
                        width: '100%', height: '100%', cursor: 'pointer',
                        backgroundColor: element.style.backgroundColor,
                        color: element.style.textColor,
                        border: 'none', fontSize: '1.2em'
                    });
                    if (element.style.pulsing) btn.classList.add('pulsing'); // Нужен CSS для .pulsing
                    
                    btn.onclick = () => {
                        if (element.action === 'openLink') {
                            window.open(element.link, '_blank');
                        } else if (element.action === 'openModal') {
                            openCustomModal(element.modalContent);
                        }
                    };
                    elWrapper.appendChild(btn);
                    break;
            }
            container.appendChild(elWrapper);
        });

    } catch (error) {
        console.error(error);
        document.body.innerHTML = `<h1>Ошибка загрузки:</h1><p>${error.message}</p>`;
    }
});

// Функция для установки фона (цвет/картинка/видео)
function setupBackground(elementId, bgConfig) {
    const element = document.getElementById(elementId);
    if (!element || !bgConfig) return;
    
    // Сброс старых фонов
    const existingBg = element.querySelector('.background-layer');
    if (existingBg) existingBg.remove();

    if (bgConfig.type === 'color') {
        element.style.backgroundColor = bgConfig.color;
    } else {
        element.style.backgroundColor = bgConfig.color || 'transparent';
        const bgLayer = document.createElement('div');
        bgLayer.className = 'background-layer';
        
        if (bgConfig.type === 'image') {
            bgLayer.style.backgroundImage = `url(${bgConfig.url})`;
        } else if (bgConfig.type === 'video') {
            bgLayer.innerHTML = `<video autoplay loop muted playsinline src="${bgConfig.url}"></video>`;
        }
        element.insertBefore(bgLayer, element.firstChild);
    }
}

// Функции для модального окна
const customModal = document.getElementById('custom-modal');
const customModalContent = document.getElementById('custom-modal-content');
customModal.querySelector('.modal-close').onclick = () => customModal.style.display = 'none';

function openCustomModal(content) {
    customModalContent.innerHTML = content;
    customModal.style.display = 'flex';
}