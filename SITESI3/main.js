document.addEventListener('DOMContentLoaded', () => {
    // Добавляем случайный параметр для обхода кэша браузера при загрузке конфига
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
            console.error("Ошибка: Не удалось загрузить конфигурацию сайта.", error);
            document.body.innerHTML = '<h1 style="text-align: center; margin-top: 50px;">Ошибка загрузки сайта</h1>';
        });
});

/**
 * Главная функция рендеринга страницы
 * @param {object} config - Объект конфигурации сайта
 */
function renderPage(config) {
    // 1. Установка глобальных настроек
    document.title = config.globalSettings.pageTitle;

    // 2. Рендеринг секций: шапка и подвал
    setupSection('page-header', config.layout.header);
    setupSection('page-footer', config.layout.footer);
    
    // 3. Рендеринг основного контента (колонки и элементы)
    const elementContainer = document.getElementById('element-container');
    elementContainer.innerHTML = ''; // Очищаем на всякий случай

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
    
    // 4. Настройка интерактивности для модальных окон
    setupModalInteraction();
}

/**
 * Настраивает шапку или подвал
 * @param {string} elementId - ID секции ('page-header' или 'page-footer')
 * @param {object} sectionConfig - Конфигурация для этой секции
 */
function setupSection(elementId, sectionConfig) {
    const element = document.getElementById(elementId);
    if (!element || !sectionConfig) return;
    
    element.innerHTML = sectionConfig.content;
    
    // Применение фона
    if (sectionConfig.background) {
        if (sectionConfig.background.type === 'color') {
            element.style.backgroundColor = sectionConfig.background.value;
        } else if (sectionConfig.background.type === 'image') {
            element.style.backgroundImage = `url('${sectionConfig.background.value}')`;
            element.style.backgroundSize = 'cover';
            element.style.backgroundPosition = 'center';
        }
    }
    // Применение кастомных стилей
    if (sectionConfig.styles) {
        Object.assign(element.style, sectionConfig.styles);
    }
}

/**
 * "Фабрика" для создания HTML-элементов на основе данных
 * @param {object} elementData - Объект с описанием элемента
 * @returns {HTMLElement} Готовый для вставки DOM-узел
 */
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
            if (elementData.content.action === 'openLink' && elementData.content.url) {
                element.onclick = () => window.open(elementData.content.url, '_blank');
            } else if (elementData.content.action === 'openModal') {
                element.classList.add('modal-trigger-btn');
                element.dataset.modalContent = elementData.content.modalContent;
            }
            break;
        default:
            element = document.createElement('div');
            element.textContent = `Неизвестный тип элемента: ${elementData.type}`;
    }

    if (element) {
        // Применение стилей к созданному элементу
        if (elementData.styles) {
            Object.assign(element.style, elementData.styles);
        }
        wrapper.appendChild(element);
    }
    
    return wrapper;
}

/**
 * Настраивает логику открытия и закрытия модального окна
 */
function setupModalInteraction() {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.querySelector('.modal-close-btn');

    document.querySelectorAll('.modal-trigger-btn').forEach(button => {
        button.addEventListener('click', () => {
            modalBody.innerHTML = button.dataset.modalContent || '<p>Контент не задан.</p>';
            modalOverlay.classList.add('active');
        });
    });

    const closeModal = () => {
        modalOverlay.classList.remove('active');
    };

    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (event) => {
        // Закрываем, только если клик был по самому оверлею, а не по его содержимому
        if (event.target === modalOverlay) {
            closeModal();
        }
    });
}