document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error('Не удалось загрузить конфигурацию!');
        const config = await response.json();

        document.getElementById('main-header').innerHTML = config.headerContent;
        document.getElementById('main-footer').innerHTML = config.footerContent;
        
        const menuContainer = document.getElementById('main-menu');
        config.menuItems.forEach(item => {
            menuContainer.innerHTML += `<a href="${item.link}">${item.text}</a>`;
        });
        
        const routeContainer = document.getElementById('route-container');
        config.routes.forEach(route => {
            const iframe = document.createElement('iframe');
            iframe.src = route.url;
            iframe.className = 'route-window';
            iframe.style.position = 'absolute';
            iframe.style.left = `${route.position.x}px`;
            iframe.style.top = `${route.position.y}px`;
            iframe.style.width = `${route.size.width}px`;
            iframe.style.height = `${route.size.height}px`;
            routeContainer.appendChild(iframe);
        });
    } catch (error) {
        console.error(error);
        document.body.innerHTML = `<h1>Ошибка загрузки страницы</h1><p>${error.message}</p>`;
    }
});