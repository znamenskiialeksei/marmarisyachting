// --- GITHUB API HELPER ---
class GitHubAPI {
    constructor(token, username, repo) {
        this.token = token;
        this.repoUrl = `https://api.github.com/repos/${username}/${repo}`;
    }

    async getFile(path) {
        const response = await fetch(`${this.repoUrl}/contents/${path}`, {
            headers: { 'Authorization': `token ${this.token}` }
        });
        if (!response.ok) throw new Error(`GitHub API Error: ${response.statusText}`);
        const data = await response.json();
        const content = atob(data.content);
        return { content: JSON.parse(content), sha: data.sha };
    }

    async updateFile(path, content, sha) {
        const encodedContent = btoa(JSON.stringify(content, null, 2));
        const response = await fetch(`${this.repoUrl}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `[Admin Panel] Update config.json`,
                content: encodedContent,
                sha: sha
            })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`GitHub Save Error: ${error.message}`);
        }
        return await response.json();
    }
}

// --- GLOBAL STATE ---
let config = null;
let configSha = null;
let githubApi = null;
let selectedElementId = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('githubToken');
    const user = localStorage.getItem('githubUser');
    const repo = localStorage.getItem('githubRepo');

    if (token && user && repo) {
        githubApi = new GitHubAPI(token, user, repo);
        loadAdminPanel();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
    }
    
    setupEventListeners();
});

// --- EVENT LISTENERS SETUP ---
function setupEventListeners() {
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('save-btn').addEventListener('click', saveChanges);

    // Toolbar buttons
    document.querySelectorAll('.add-element-btn').forEach(btn => {
        btn.addEventListener('click', () => addElement(btn.dataset.type));
    });
    
    // Panel toggles
    document.getElementById('toggle-global-btn').addEventListener('click', () => {
        document.getElementById('global-settings-panel').style.display = 'block';
    });
    document.getElementById('toggle-layout-btn').addEventListener('click', () => {
        document.getElementById('layout-settings-panel').style.display = 'block';
    });
    
    // Generic close button for all panels
    document.querySelectorAll('.panel-close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.floating-panel').style.display = 'none';
        });
    });
}


// --- AUTH & LOADING ---
async function handleLogin() {
    const token = document.getElementById('github-token').value;
    const user = document.getElementById('github-user').value;
    const repo = document.getElementById('github-repo').value;
    if (token && user && repo) {
        localStorage.setItem('githubToken', token);
        localStorage.setItem('githubUser', user);
        localStorage.setItem('githubRepo', repo);
        window.location.reload();
    } else {
        alert('Пожалуйста, заполните все поля.');
    }
}

async function loadAdminPanel() {
    try {
        const { content, sha } = await githubApi.getFile('config.json');
        config = content;
        configSha = sha;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        renderCanvas();
    } catch (error) {
        console.error('Login Error:', error);
        localStorage.clear();
        alert('Ошибка входа. Проверьте токен, имя пользователя, название репозитория и права доступа.');
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('admin-panel').style.display = 'none';
    }
}

// --- RENDERING CANVAS ---
function renderCanvas() {
    const canvas = document.getElementById('canvas-container');
    canvas.innerHTML = ''; // Full redraw

    // Render Header, Main, Footer sections
    const headerAdmin = createAdminSection('header', config.layout.header);
    const mainAdmin = createAdminSection('main', config.layout.main, true);
    const footerAdmin = createAdminSection('footer', config.layout.footer);
    
    canvas.append(headerAdmin, mainAdmin, footerAdmin);

    initDragAndDrop();
    initDraggablePanels();
    // Re-select if an element was selected
    if(selectedElementId) {
        const el = document.querySelector(`[data-element-id="${selectedElementId}"]`);
        if (el) el.classList.add('selected');
    }
}

function createAdminSection(name, data, isMain = false) {
    const section = document.createElement('div');
    section.className = 'admin-section';
    section.innerHTML = `<div class="admin-section-label">${name.toUpperCase()}</div>`;
    
    if (isMain) {
        const mainContent = document.createElement('div');
        mainContent.className = 'admin-main-content';
        data.columns.forEach(col => {
            const columnEl = document.createElement('div');
            columnEl.className = 'admin-column';
            columnEl.style.width = col.width;
            columnEl.dataset.columnId = col.id;
            
            col.elements.forEach(elId => {
                const elementData = config.elements.find(e => e.id === elId);
                if (elementData) {
                    columnEl.appendChild(createElementWrapper(elementData));
                }
            });
            mainContent.appendChild(columnEl);
        });
        section.appendChild(mainContent);
    } else {
        section.innerHTML += data.content;
    }
    return section;
}

function createElementWrapper(elementData) {
    const wrapper = document.createElement('div');
    wrapper.className = 'element-wrapper';
    wrapper.dataset.elementId = elementData.id;

    // Render a safe preview of the element
    const preview = document.createElement('div');
    preview.className = 'element-preview';
    // Use the same renderer as the public page, but inside the wrapper
    const renderedEl = createElement(elementData);
    preview.appendChild(renderedEl);
    wrapper.appendChild(preview);

    wrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        selectElement(elementData.id);
    });
    return wrapper;
}
// Re-use public createElement for previews
const createElement = window.createElement || function(elementData) {
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
};


// --- ELEMENT MANIPULATION & INSPECTOR ---
function selectElement(elementId) {
    if (selectedElementId === elementId) return;
    
    document.querySelectorAll('.element-wrapper.selected').forEach(el => el.classList.remove('selected'));
    const wrapper = document.querySelector(`[data-element-id="${elementId}"]`);
    if (wrapper) {
        wrapper.classList.add('selected');
        selectedElementId = elementId;
        renderInspector();
    }
}

function renderInspector() {
    const inspectorPanel = document.getElementById('inspector');
    const content = document.getElementById('inspector-content');
    const element = config.elements.find(el => el.id === selectedElementId);

    if (!element) {
        inspectorPanel.style.display = 'none';
        return;
    }
    
    content.innerHTML = ''; // Clear old fields
    
    // Generic fields
    content.appendChild(createInputField('text', 'Заголовок (в админке)', element.title, (val) => { element.title = val; }));
    
    // Type-specific fields
    switch(element.type) {
        case 'textBlock':
            content.appendChild(createTextArea('HTML контент', element.content, (val) => { element.content = val; }));
            break;
        case 'photo':
        case 'videoBlock':
        case 'reels':
        case 'externalBlock':
            content.appendChild(createInputField('text', 'URL контента', element.content.url, (val) => { element.content.url = val; }));
            break;
        case 'button':
            content.appendChild(createInputField('text', 'Текст кнопки', element.content.text, (val) => { element.content.text = val; }));
            content.appendChild(createSelect('Действие', element.content.action, [{val:'openLink', text:'Открыть ссылку'}, {val:'openModal', text:'Модальное окно'}], (val) => { element.content.action = val; renderInspector(); }));
            if (element.content.action === 'openLink') {
                 content.appendChild(createInputField('text', 'URL ссылки', element.content.link, (val) => { element.content.link = val; }));
            } else {
                 content.appendChild(createTextArea('HTML контент модального окна', element.content.modalContent, (val) => { element.content.modalContent = val; }));
            }
            break;
    }

    // Style fields (example for a few common ones)
    content.appendChild(createInputField('text', 'Ширина (width)', element.style.width || '', (val) => { element.style.width = val; }));
    content.appendChild(createInputField('text', 'Высота (height)', element.style.height || '', (val) => { element.style.height = val; }));
    content.appendChild(createInputField('color', 'Цвет фона (backgroundColor)', element.style.backgroundColor || '', (val) => { element.style.backgroundColor = val; }));
    content.appendChild(createInputField('text', 'Внутренние отступы (padding)', element.style.padding || '', (val) => { element.style.padding = val; }));
    content.appendChild(createInputField('text', 'Скругление углов (borderRadius)', element.style.borderRadius || '', (val) => { element.style.borderRadius = val; }));

    inspectorPanel.style.display = 'block';
}

// --- DYNAMIC FORM FIELD CREATORS ---
function createInputField(type, label, value, onUpdate) {
    const group = document.createElement('div');
    group.className = 'inspector-group';
    group.innerHTML = `<label>${label}</label>`;
    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.addEventListener('input', () => {
        onUpdate(input.value);
        // Live update on canvas (can be optimized)
        renderCanvas();
    });
    group.appendChild(input);
    return group;
}

function createTextArea(label, value, onUpdate) {
    const group = document.createElement('div');
    group.className = 'inspector-group';
    group.innerHTML = `<label>${label}</label>`;
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.addEventListener('input', () => {
        onUpdate(textarea.value);
        renderCanvas();
    });
    group.appendChild(textarea);
    return group;
}

function createSelect(label, value, options, onUpdate) {
    const group = document.createElement('div');
    group.className = 'inspector-group';
    group.innerHTML = `<label>${label}</label>`;
    const select = document.createElement('select');
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.val;
        option.textContent = opt.text;
        if (opt.val === value) option.selected = true;
        select.appendChild(option);
    });
    select.addEventListener('change', () => {
        onUpdate(select.value);
        renderCanvas();
    });
    group.appendChild(select);
    return group;
}

function addElement(type) {
    const newElement = {
        id: `el_${new Date().getTime()}`,
        type: type,
        title: `Новый элемент (${type})`,
        visible: true,
        content: {},
        style: {}
    };

    switch(type) {
        case 'textBlock':
            newElement.content = '<p>Новый текстовый блок.</p>';
            newElement.style = { padding: '15px', backgroundColor: '#fff' };
            break;
        case 'photo':
            newElement.content = { url: 'https://via.placeholder.com/400x250' };
            newElement.style = { width: '100%', height: '250px', objectFit: 'cover' };
            break;
        // ... add defaults for other types
        default:
            newElement.content = {};
            newElement.style = { width: '100%', height: '200px', border: '1px solid #ccc' };
    }

    config.elements.push(newElement);
    // Add to the first column
    config.layout.main.columns[0].elements.unshift(newElement.id);
    renderCanvas();
}


// --- INTERACTIVITY (DRAG & DROP) ---
function initDragAndDrop() {
    const columns = document.querySelectorAll('.admin-column');
    columns.forEach(column => {
        new Sortable(column, {
            group: 'shared',
            animation: 150,
            onEnd: (evt) => {
                const elementId = evt.item.dataset.elementId;
                const fromColId = evt.from.dataset.columnId;
                const toColId = evt.to.dataset.columnId;
                
                const fromColData = config.layout.main.columns.find(c => c.id === fromColId);
                const toColData = config.layout.main.columns.find(c => c.id === toColId);

                // Remove from old column in config
                fromColData.elements.splice(evt.oldIndex, 1);
                // Add to new column in config
                toColData.elements.splice(evt.newIndex, 0, elementId);
                
                // No need to re-render, SortableJS handles the DOM
            }
        });
    });
}

function initDraggablePanels() {
    interact('.floating-panel')
      .draggable({
        allowFrom: '.panel-header',
        inertia: true,
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: 'parent',
            endOnly: true
          })
        ],
        autoScroll: true,
        listeners: {
          move(event) {
            var target = event.target
            var x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx
            var y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy
            target.style.transform = 'translate(' + x + 'px, ' + y + 'px)'
            target.setAttribute('data-x', x)
            target.setAttribute('data-y', y)
          }
        }
      })
}

// --- SAVING ---
async function saveChanges() {
    const btn = document.getElementById('save-btn');
    btn.textContent = 'Сохранение...';
    btn.disabled = true;
    try {
        const result = await githubApi.updateFile('config.json', config, configSha);
        configSha = result.content.sha; // Update SHA to prevent conflicts
        alert('Изменения успешно сохранены!');
    } catch (error) {
        console.error(error);
        alert(`Ошибка сохранения: ${error.message}`);
    } finally {
        btn.textContent = '💾 Сохранить';
        btn.disabled = false;
    }
}