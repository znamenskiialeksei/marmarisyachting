document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('config.json?cachebust=' + new Date().getTime());
        if (!response.ok) throw new Error('Не удалось загрузить конфигурацию!');
        const config = await response.json();

        document.title = config.globalSettings.pageTitle;
        document.body.className = `view-mode-${config.globalSettings.defaultViewMode}`;

        setupBackground('main-header', config.layout.header.background);
        setupBackground('element-container', config.layout.main.background);
        setupBackground('main-footer', config.layout.footer.background);

        document.getElementById('main-header').innerHTML += config.layout.header.content;
        document.getElementById('main-footer').innerHTML += config.layout.footer.content;
        
        const menuContainer = document.getElementById('main-menu');
        if (config.menuItems && menuContainer) {
            config.menuItems.forEach(item => {
                menuContainer.innerHTML += `<a href="${item.link}">${item.text}</a>`;
            });
        }
        
        const container = document.getElementById('element-container');
        config.elements.forEach(element => {
            if (!element.visible) return;

            const elWrapper = document.createElement('div');
            elWrapper.className = `element-wrapper type-${element.type}`;
            elWrapper.id = element.id;
            
            Object.assign(elWrapper.style, {
                position: 'absolute',
                left: `${element.position.x}px`,
                top: `${element.position.y}px`,
                width: `${element.size.width}px`,
                height: `${element.size.height}px`
            });

            switch (element.type) {
                case 'player':
                    elWrapper.innerHTML = `<iframe src="${element.url}" style="width:100%; height:100%; border:0;"></iframe>`;
                    break;
                case 'textBlock':
                    elWrapper.innerHTML = element.content;
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
                    if (element.style.pulsing) btn.classList.add('pulsing');
                    
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

function setupBackground(elementId, bgConfig) {
    const element = document.getElementById(elementId);
    if (!element || !bgConfig) return;
    
    const existingBg = element.querySelector('.background-layer');
    if (existingBg) existingBg.remove();

    if (bgConfig.type === 'color') {
        element.style.backgroundColor = bgConfig.color || bgConfig.url;
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