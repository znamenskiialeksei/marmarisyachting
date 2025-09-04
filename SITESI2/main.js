document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Добавляем случайный параметр, чтобы избежать кэширования конфига
        const response = await fetch('config.json?cachebust=' + new Date().getTime());
        if (!response.ok) throw new Error('Не удалось загрузить конфигурацию!');
        const config = await response.json();

        // --- Глобальные настройки ---
        document.title = config.globalSettings.pageTitle;

        // --- Настройка фона ---
        setupBackground('main-header', config.layout.header.background);
        setupBackground(document.body, config.layout.main.background); // Фон для всей страницы
        setupBackground('main-footer', config.layout.footer.background);

        // --- Заполнение контента ---
        document.getElementById('main-header').innerHTML += config.layout.header.content;
        document.getElementById('main-footer').innerHTML += config.layout.footer.content;
        
        const menuContainer = document.getElementById('main-menu');
        if (config.menuItems && menuContainer) {
            config.menuItems.forEach(item => {
                menuContainer.innerHTML += `<a href="${item.link}">${item.text}</a>`;
            });
        }
        
        // --- Рендеринг всех элементов ---
        const container = document.getElementById('element-container');
        container.innerHTML = ''; 

        // Создаем колонки
        if (config.layout.main.columns) {
            config.layout.main.columns.forEach(columnData => {
                const columnEl = document.createElement('div');
                columnEl.className = 'layout-column';
                columnEl.style.flexBasis = columnData.width;
                
                // Наполняем колонку элементами
                columnData.elements.forEach(elementId => {
                    const elementData = config.elements.find(el => el.id === elementId);
                    if (elementData && elementData.visible) {
                        const elWrapper = createElement(elementData);
                        columnEl.appendChild(elWrapper);
                    }
                });
                container.appendChild(columnEl);
            });
        }

    } catch (error) {
        console.error(error);
        document.body.innerHTML = `<h1>Ошибка загрузки страницы</h1><p>${error.message}</p>`;
    }
});

function createElement(elementData) {
    const elWrapper = document.createElement('div');
    elWrapper.className = `element-wrapper type-${elementData.type}`;
    elWrapper.id = elementData.id;

    if (elementData.height) elWrapper.style.height = elementData.height;
    if (elementData.style) Object.assign(elWrapper.style, elementData.style);

    switch (elementData.type) {
        case 'player':
            elWrapper.innerHTML = `<iframe src="${elementData.url}" scrolling="no"></iframe>`;
            break;
        case 'textBlock':
            elWrapper.innerHTML = elementData.content;
            break;
        case 'photo':
            elWrapper.innerHTML = `<img src="${elementData.url}" alt="${elementData.title || ''}">`;
            break;
        case 'videoBlock':
        case 'reels':
            elWrapper.innerHTML = `<iframe src="${elementData.url}" allowfullscreen></iframe>`;
            if (elementData.type === 'reels') elWrapper.style.aspectRatio = '9 / 16';
            break;
        case 'button':
            const btn = document.createElement('button');
            btn.textContent = elementData.text || 'Кнопка';
            Object.assign(btn.style, {
                width: '100%', height: '100%', cursor: 'pointer',
                border: 'none',
                backgroundColor: elementData.style.backgroundColor,
                color: elementData.style.color,
                fontSize: elementData.style.fontSize,
                fontWeight: elementData.style.fontWeight,
                borderRadius: elementData.style.borderRadius
            });
            
            btn.onclick = () => {
                if (elementData.action === 'openLink' && elementData.link) {
                    window.open(elementData.link, '_blank');
                } else if (elementData.action === 'openModal' && elementData.modalContent) {
                    openCustomModal(elementData.modalContent);
                }
            };
            elWrapper.appendChild(btn);
            break;
    }
    return elWrapper;
}


function setupBackground(element, bgConfig) {
    if (!element || !bgConfig) return;
    
    const existingBg = element.querySelector('.background-layer');
    if (existingBg) existingBg.remove();

    if (bgConfig.type === 'color') {
        element.style.backgroundColor = bgConfig.color || bgConfig.url || 'transparent';
    } else {
        element.style.backgroundColor = 'transparent';
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

const customModal = document.getElementById('custom-modal');
if (customModal) {
    const customModalContent = document.getElementById('custom-modal-content');
    customModal.querySelector('.modal-close').onclick = () => customModal.style.display = 'none';

    function openCustomModal(content) {
        customModalContent.innerHTML = content;
        customModal.style.display = 'flex';
    }
}