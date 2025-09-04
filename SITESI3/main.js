document.addEventListener('DOMContentLoaded', () => {
    // Добавляем случайный параметр для обхода кэша браузера
    const cacheBust = `?v=${new Date().getTime()}`;

    fetch(`config.json${cacheBust}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(config => {
            renderPage(config);
        })
        .catch(error => {
            console.error("Не удалось загрузить конфигурацию:", error);
            document.body.innerHTML = '<h1>Ошибка загрузки сайта. Пожалуйста, попробуйте позже.</h1>';
        });
});

function renderPage(config) {
    // 1. Устанавливаем глобальные настройки
    document.title = config.globalSettings.pageTitle;

    // 2. Настраиваем секции
    setupSection('page-header', config.layout.header);
    setupSection('page-footer', config.layout.footer);
    
    // 3. Рендерим основное содержимое
    const elementContainer = document.getElementById('element-container');
    elementContainer.innerHTML = ''; // Очищаем контейнер

    config.layout.main.columns.forEach(column => {
        const columnDiv = document.createElement('div');
        columnDiv.className = 'layout-column';
        columnDiv.style.flexBasis = column.width;

        column.elements.forEach(elementId => {
            const elementData = config.elements.find(el => el.id === elementId);
            if (elementData) {
                const elementNode = createElement(elementData);
                columnDiv.appendChild(elementNode);
            }
        });
        elementContainer.appendChild(columnDiv);
    });
    
    // 4. Настраиваем интерактивность для модальных окон
    setupModalInteraction();
}

function setupSection(elementId, sectionConfig) {
    const element = document.getElementById(elementId);
    if (element && sectionConfig) {
        element.innerHTML = sectionConfig.content;
        // Применяем фон
        if (sectionConfig.background) {
            if (sectionConfig.background.type === 'color') {
                element.style.backgroundColor = sectionConfig.background.value;
            } else if (sectionConfig.background.type === 'image') {
                element.style.backgroundImage = `url('${sectionConfig.background.value}')`;
                element.style.backgroundSize = 'cover';
                element.style.backgroundPosition = 'center';
            }
        }
        // Применяем кастомные стили
        if (sectionConfig.styles) {
            Object.assign(element.style, sectionConfig.styles);
        }
    }
}

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
            if (elementData.content.action === 'openLink') {
                element.onclick = () => window.open(elementData.content.url, '_blank');
            } else if (elementData.content.action === 'openModal') {
                element.classList.add('modal-trigger-btn');
                element.dataset.modalContent = elementData.content.modalContent;
            }
            break;
        default:
            element = document.createElement('div');
            element.textContent = 'Неизвестный тип элемента';
    }

    // Применяем стили к элементу
    if (elementData.styles) {
        Object.assign(element.style, elementData.styles);
    }

    wrapper.appendChild(element);
    return wrapper;
}


function setupModalInteraction() {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.querySelector('.modal-close-btn');

    document.querySelectorAll('.modal-trigger-btn').forEach(button => {
        button.addEventListener('click', () => {
            modalBody.innerHTML = button.dataset.modalContent;
            modalOverlay.classList.add('active');
        });
    });

    const closeModal = () => {
        modalOverlay.classList.remove('active');
    };

    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) {
            closeModal();
        }
    });
}