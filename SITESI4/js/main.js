document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error('Network response was not ok');
        const config = await response.json();
        renderPage(config);
    } catch (error) {
        console.error('Failed to load or render page:', error);
        document.getElementById('app').innerHTML = `<p style="text-align:center; color:red;">Ошибка загрузки конфигурации сайта.</p>`;
    }
});

function renderPage(config) {
    document.title = config.globalSettings.title;
    const app = document.getElementById('app');
    app.innerHTML = ''; // Очищаем loader

    const header = createSection('header', config.layout.header);
    const main = createMain(config.layout.main, config.elements);
    const footer = createSection('footer', config.layout.footer);

    app.append(header, main, footer);
    setupModals(config.elements);
}

function createSection(tagName, sectionData) {
    const section = document.createElement(tagName);
    section.innerHTML = sectionData.content;
    applyBackground(section, sectionData.background);
    return section;
}

function createMain(mainData, allElements) {
    const main = document.createElement('main');
    applyBackground(main, mainData.background);

    mainData.columns.forEach(columnData => {
        const column = document.createElement('div');
        column.classList.add('column');
        column.style.width = columnData.width;

        columnData.elements.forEach(elementId => {
            const elementData = allElements.find(el => el.id === elementId);
            if (elementData && elementData.visible) {
                const elementNode = createElement(elementData);
                column.appendChild(elementNode);
            }
        });
        main.appendChild(column);
    });
    return main;
}

function createElement(elementData) {
    const el = document.createElement('div');
    el.classList.add('element');
    el.id = elementData.id;

    switch (elementData.type) {
        case 'textBlock':
            el.innerHTML = elementData.content;
            break;
        case 'photo':
            el.innerHTML = `<img src="${elementData.content.url}" alt="${elementData.title}" style="width:100%; height:100%;">`;
            break;
        case 'videoBlock':
        case 'reels':
        case 'externalBlock':
            el.innerHTML = `<iframe src="${elementData.content.url}" style="width:100%; height:100%; border:none;" allowfullscreen></iframe>`;
            break;
        case 'button':
            const btn = document.createElement('button');
            btn.textContent = elementData.content.text;
            if (elementData.content.action === 'openModal') {
                btn.dataset.action = 'openModal';
                btn.dataset.elementId = elementData.id;
            } else if (elementData.content.action === 'openLink') {
                btn.onclick = () => window.open(elementData.content.link, '_blank');
            }
            el.appendChild(btn);
            break;
    }

    if (elementData.style) {
        for (const [key, value] of Object.entries(elementData.style)) {
            const cssKey = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
            el.style[cssKey] = value;
        }
    }
    return el;
}

function applyBackground(element, bgData) {
    if (!bgData) return;
    if (bgData.type === 'color') {
        element.style.backgroundColor = bgData.value;
    } else if (bgData.type === 'image') {
        element.style.backgroundImage = `url(${bgData.value})`;
        element.style.backgroundSize = 'cover';
        element.style.backgroundPosition = 'center';
    }
}

function setupModals(allElements) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    const closeButton = document.querySelector('.close-button');

    document.querySelectorAll('[data-action="openModal"]').forEach(button => {
        button.addEventListener('click', () => {
            const elementId = button.dataset.elementId;
            const elementData = allElements.find(el => el.id === elementId);
            if (elementData) {
                modalBody.innerHTML = elementData.content.modalContent;
                modal.style.display = 'block';
            }
        });
    });

    closeButton.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
}