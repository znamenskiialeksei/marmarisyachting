// --- GITHUB API HELPER ---
class GitHubAPI {
    constructor(token, username, repo) {
        this.token = token;
        this.repoUrl = `https://api.github.com/repos/${username}/${repo}`;
    }
    async getFile(path) { const response = await fetch(`${this.repoUrl}/contents/${path}`, { headers: { 'Authorization': `token ${this.token}` } }); if (!response.ok) throw new Error(`GitHub API Error: ${response.statusText}`); const data = await response.json(); const content = atob(data.content); return { content: JSON.parse(content), sha: data.sha }; }
    async updateFile(path, content, sha) { const encodedContent = btoa(JSON.stringify(content, null, 2)); const response = await fetch(`${this.repoUrl}/contents/${path}`, { method: 'PUT', headers: { 'Authorization': `token ${this.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `[Admin Panel] Update config.json`, content: encodedContent, sha: sha }) }); if (!response.ok) { const error = await response.json(); throw new Error(`GitHub Save Error: ${error.message}`); } return await response.json(); }
}

// --- GLOBAL STATE ---
let config = null;
let configSha = null;
let githubApi = null;
let selectedElementId = null;

// --- INITIALIZATION & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => { const token = localStorage.getItem('githubToken'); const user = localStorage.getItem('githubUser'); const repo = localStorage.getItem('githubRepo'); if (token && user && repo) { githubApi = new GitHubAPI(token, user, repo); loadAdminPanel(); } else { document.getElementById('login-screen').style.display = 'flex'; } setupEventListeners(); });

function setupEventListeners() {
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('save-btn').addEventListener('click', saveChanges);
    document.querySelectorAll('.add-element-btn').forEach(btn => { btn.addEventListener('click', () => addElement(btn.dataset.type)); });
    document.getElementById('toggle-global-btn').addEventListener('click', () => { renderGlobalSettingsPanel(); document.getElementById('global-settings-panel').style.display = 'block'; });
    document.getElementById('toggle-layout-btn').addEventListener('click', () => { renderLayoutSettingsPanel(); document.getElementById('layout-settings-panel').style.display = 'block'; });
    document.querySelectorAll('.panel-close-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.target.closest('.floating-panel').style.display = 'none'; }); });
    const canvasContainer = document.getElementById('canvas-container');
    const viewBtns = document.querySelectorAll('.view-btn');
    document.getElementById('view-desktop-btn').addEventListener('click', () => { canvasContainer.classList.remove('tablet-view', 'mobile-view'); canvasContainer.style.maxWidth = '100%'; setActiveViewBtn(document.getElementById('view-desktop-btn')); });
    document.getElementById('view-tablet-btn').addEventListener('click', () => { canvasContainer.classList.remove('mobile-view'); canvasContainer.classList.add('tablet-view'); canvasContainer.style.maxWidth = '768px'; setActiveViewBtn(document.getElementById('view-tablet-btn')); });
    document.getElementById('view-mobile-btn').addEventListener('click', () => { canvasContainer.classList.remove('tablet-view'); canvasContainer.classList.add('mobile-view'); canvasContainer.style.maxWidth = '420px'; setActiveViewBtn(document.getElementById('view-mobile-btn')); });
    function setActiveViewBtn(activeBtn) { viewBtns.forEach(btn => btn.classList.remove('active')); activeBtn.classList.add('active'); }
}

// --- AUTH & LOADING ---
async function handleLogin() { const token = document.getElementById('github-token').value; const user = document.getElementById('github-user').value; const repo = document.getElementById('github-repo').value; if (token && user && repo) { localStorage.setItem('githubToken', token); localStorage.setItem('githubUser', user); localStorage.setItem('githubRepo', repo); window.location.reload(); } else { alert('Пожалуйста, заполните все поля.'); } }
async function loadAdminPanel() { try { const { content, sha } = await githubApi.getFile('config.json'); config = content; configSha = sha; document.getElementById('login-screen').style.display = 'none'; document.getElementById('admin-panel').style.display = 'block'; renderCanvas(); } catch (error) { console.error('Login Error:', error); localStorage.clear(); alert('Ошибка входа. Проверьте токен, имя пользователя, название репозитория и права доступа.'); document.getElementById('login-screen').style.display = 'flex'; document.getElementById('admin-panel').style.display = 'none'; } }

// --- CANVAS & ELEMENT RENDERING ---
function renderCanvas() { const canvas = document.getElementById('canvas-container'); canvas.innerHTML = ''; const headerAdmin = createAdminSection('header', config.layout.header); const mainAdmin = createAdminSection('main', config.layout.main, true); const footerAdmin = createAdminSection('footer', config.layout.footer); canvas.append(headerAdmin, mainAdmin, footerAdmin); applyBackground(headerAdmin, config.layout.header.background); applyBackground(mainAdmin.querySelector('.admin-main-content'), config.layout.main.background); applyBackground(footerAdmin, config.layout.footer.background); initDragAndDrop(); initDraggablePanels(); if(selectedElementId) { const el = document.querySelector(`[data-element-id="${selectedElementId}"]`); if (el) el.classList.add('selected'); } }
function applyBackground(element, bgData) { if (!element || !bgData) return; element.style.backgroundColor = ''; element.style.backgroundImage = ''; if (bgData.type === 'color') { element.style.backgroundColor = bgData.value; } else if (bgData.type === 'image') { element.style.backgroundImage = `url(${bgData.value})`; element.style.backgroundSize = 'cover'; element.style.backgroundPosition = 'center'; } }
function createAdminSection(name, data, isMain = false) { const section = document.createElement('div'); section.className = 'admin-section'; section.dataset.sectionName = name; section.innerHTML = `<div class="admin-section-label">${name.toUpperCase()}</div>`; if (isMain) { const mainContent = document.createElement('div'); mainContent.className = 'admin-main-content'; data.columns.forEach(col => { const columnEl = document.createElement('div'); columnEl.className = 'admin-column'; columnEl.style.flexBasis = col.width; columnEl.style.flexGrow = '0'; columnEl.style.flexShrink = '0'; columnEl.dataset.columnId = col.id; col.elements.forEach(elId => { const elementData = config.elements.find(e => e.id === elId); if (elementData) { columnEl.appendChild(createElementWrapper(elementData)); } }); mainContent.appendChild(columnEl); }); section.appendChild(mainContent); } else { const contentDiv = document.createElement('div'); contentDiv.innerHTML = data.content; section.appendChild(contentDiv); } return section; }
function createElementWrapper(elementData) { const wrapper = document.createElement('div'); wrapper.className = 'element-wrapper'; wrapper.dataset.elementId = elementData.id; const preview = document.createElement('div'); preview.className = 'element-preview'; const renderedEl = createElement(elementData); preview.appendChild(renderedEl); wrapper.appendChild(preview); wrapper.addEventListener('click', (e) => { e.stopPropagation(); selectElement(elementData.id); }); return wrapper; }
const createElement = window.createElement || function(elementData) { const el = document.createElement('div'); el.classList.add('element'); el.id = elementData.id; switch (elementData.type) { case 'textBlock': el.innerHTML = elementData.content; break; case 'photo': if (elementData.content && elementData.content.url) { el.innerHTML = `<img src="${elementData.content.url}" alt="${elementData.title}" style="width:100%; height:100%;">`; } else { el.innerHTML = `<div class="element-error">Ошибка: URL для фото не задан</div>`; } break; case 'videoBlock': case 'reels': case 'externalBlock': if (elementData.content && elementData.content.url) { el.innerHTML = `<iframe src="${elementData.content.url}" style="width:100%; height:100%; border:none;" allowfullscreen></iframe>`; } else { el.innerHTML = `<div class="element-error">Ошибка: URL для блока не задан</div>`; } break; case 'button': const btn = document.createElement('button'); btn.textContent = (elementData.content && elementData.content.text) ? elementData.content.text : 'Кнопка'; el.appendChild(btn); break; } if (elementData.style) { for (const [key, value] of Object.entries(elementData.style)) { const cssKey = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`); el.style[cssKey] = value; } } return el; };

// --- ELEMENT MANIPULATION & INSPECTOR ---
function selectElement(elementId) { if (selectedElementId === elementId) return; document.querySelectorAll('.element-wrapper.selected').forEach(el => el.classList.remove('selected')); const wrapper = document.querySelector(`[data-element-id="${elementId}"]`); if (wrapper) { wrapper.classList.add('selected'); selectedElementId = elementId; renderInspector(); } }
function renderInspector() {
    const inspectorPanel = document.getElementById('inspector');
    const content = document.getElementById('inspector-content');
    const element = config.elements.find(el => el.id === selectedElementId);
    if (!element) { inspectorPanel.style.display = 'none'; return; }
    content.innerHTML = '';
    const actionsGroup = createGroupContainer('ДЕЙСТВИЯ С БЛОКОМ');
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Удалить элемент';
    deleteBtn.className = 'delete-element-btn';
    deleteBtn.onclick = () => {
        if (confirm(`Вы уверены, что хотите удалить элемент "${element.title}"?`)) {
            config.elements = config.elements.filter(el => el.id !== element.id);
            config.layout.main.columns.forEach(col => { col.elements = col.elements.filter(id => id !== element.id); });
            selectedElementId = null;
            inspectorPanel.style.display = 'none';
            renderCanvas();
        }
    };
    actionsGroup.appendChild(deleteBtn);
    content.appendChild(actionsGroup);
    const generalGroup = createGroupContainer('ОБЩИЕ');
    const idField = document.createElement('div');
    idField.innerHTML = `<label>ID (не изменять)</label><input type="text" value="${element.id}" readonly>`;
    generalGroup.appendChild(idField);
    generalGroup.appendChild(createInputField('text', 'Заголовок (для админки)', element.title, (val) => { element.title = val; }));
    content.appendChild(generalGroup);
    const contentGroup = createGroupContainer('СОДЕРЖИМОЕ');
    switch(element.type) {
        case 'externalBlock': case 'photo': case 'videoBlock': case 'reels': contentGroup.appendChild(createInputField('text', 'URL контента', element.content.url, (val) => { element.content.url = val; renderCanvas(); })); break;
        case 'textBlock': contentGroup.appendChild(createTextArea('HTML контент', element.content, (val) => { element.content = val; renderCanvas(); })); break;
        case 'button':
            contentGroup.appendChild(createInputField('text', 'Текст кнопки', element.content.text, (val) => { element.content.text = val; renderCanvas(); }));
            contentGroup.appendChild(createSelect('Действие', element.content.action, [{val:'openLink', text:'Открыть ссылку'}, {val:'openModal', text:'Модальное окно'}], (val) => { element.content.action = val; renderInspector(); }));
            if (element.content.action === 'openLink') { contentGroup.appendChild(createInputField('text', 'Ссылка', element.content.link, (val) => { element.content.link = val; }));
            } else { contentGroup.appendChild(createTextArea('Контент модального окна', element.content.modalContent, (val) => { element.content.modalContent = val; })); }
            break;
    }
    content.appendChild(contentGroup);
    const styleGroup = createGroupContainer('РАЗМЕРЫ И СТИЛИ');
    styleGroup.appendChild(createInputField('text', 'Ширина', element.style.width || '', (val) => { element.style.width = val; renderCanvas(); }));
    styleGroup.appendChild(createInputField('text', 'Высота', element.style.height || '', (val) => { element.style.height = val; renderCanvas(); }));
    styleGroup.appendChild(createInputField('text', 'Скругление углов', element.style.borderRadius || '', (val) => { element.style.borderRadius = val; renderCanvas(); }));
    styleGroup.appendChild(createInputField('text', 'Тень', element.style.boxShadow || '', (val) => { element.style.boxShadow = val; renderCanvas(); }));
    if (['textBlock', 'button'].includes(element.type)) {
        styleGroup.appendChild(createInputField('color', 'Цвет фона', element.style.backgroundColor || '#ffffff', (val) => { element.style.backgroundColor = val; renderCanvas(); }));
        styleGroup.appendChild(createInputField('color', 'Цвет текста', element.style.color || '#000000', (val) => { element.style.color = val; renderCanvas(); }));
        styleGroup.appendChild(createInputField('text', 'Размер шрифта', element.style.fontSize || '', (val) => { element.style.fontSize = val; renderCanvas(); }));
        styleGroup.appendChild(createInputField('text', 'Внутренние отступы', element.style.padding || '', (val) => { element.style.padding = val; renderCanvas(); }));
    }
    if (element.type === 'photo') { styleGroup.appendChild(createSelect('Вписывание фото', element.style['object-fit'] || 'cover', [{val:'cover', text:'Заполнить (cover)'}, {val:'contain', text:'Показать целиком (contain)'}], (val) => { element.style['object-fit'] = val; renderCanvas(); })); }
    content.appendChild(styleGroup);
    inspectorPanel.style.display = 'block';
}
function addElement(type) {
    const newElement = { id: `el_${Date.now()}`, type: type, title: `Новый блок: ${type}`, visible: true, content: {}, style: {} };
    switch(type) {
        case 'externalBlock': newElement.content = { url: '' }; newElement.style = { width: '100%', height: '650px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }; break;
        case 'textBlock': newElement.content = '<h2>Новый заголовок</h2><p>Это новый текстовый блок.</p>'; newElement.style = { width: '100%', padding: '20px', backgroundColor: '#ffffff', color: '#333333', borderRadius: '8px' }; break;
        case 'photo': newElement.content = { url: 'https://via.placeholder.com/600x400.png?text=Photo' }; newElement.style = { width: '100%', height: '300px', 'object-fit': 'cover', borderRadius: '8px' }; break;
        case 'videoBlock': newElement.content = { url: 'https://www.youtube.com/embed/' }; newElement.style = { width: '100%', 'aspect-ratio': '16 / 9', borderRadius: '8px' }; break;
        case 'reels': newElement.content = { url: '' }; newElement.style = { width: '350px', 'aspect-ratio': '9 / 16', borderRadius: '12px', margin: '0 auto' }; newElement.title = `Новый блок: Reels`; break;
        case 'button': newElement.content = { text: 'Нажми меня', action: 'openLink', link: '#', modalContent: '<h1>Заголовок</h1>' }; newElement.style = { width: 'auto', padding: '12px 24px', backgroundColor: '#3498db', color: '#ffffff', fontSize: '16px', borderRadius: '5px', border: 'none' }; break;
    }
    config.elements.push(newElement);
    if (config.layout.main.columns.length > 0) { config.layout.main.columns[0].elements.unshift(newElement.id); }
    renderCanvas();
    selectElement(newElement.id);
}

// --- PANELS & HELPERS ---
function renderGlobalSettingsPanel() { const content = document.getElementById('global-settings-content'); content.innerHTML = ''; const settings = config.globalSettings; const titleField = createInputField('text', 'Заголовок сайта (Title)', settings.title, (newValue) => { settings.title = newValue; }); content.appendChild(titleField); }
function renderLayoutSettingsPanel() { const content = document.getElementById('layout-settings-content'); content.innerHTML = ''; content.appendChild(createSectionEditor('header', config.layout.header)); content.appendChild(createSectionEditor('main', config.layout.main)); content.appendChild(createSectionEditor('footer', config.layout.footer)); }
function createSectionEditor(name, sectionData) { const container = document.createElement('div'); container.className = 'inspector-group layout-editor-section'; const title = document.createElement('h3'); title.textContent = name.charAt(0).toUpperCase() + name.slice(1); container.appendChild(title); if (name !== 'main') { const label = document.createElement('label'); label.textContent = 'HTML-контент'; const textarea = document.createElement('textarea'); textarea.value = sectionData.content; textarea.addEventListener('input', () => { sectionData.content = textarea.value; renderCanvas(); }); container.append(label, textarea); } const bg = sectionData.background || { type: 'color', value: '#ffffff' }; const bgTypeLabel = document.createElement('label'); bgTypeLabel.textContent = 'Тип фона'; const bgTypeSelect = document.createElement('select'); ['color', 'image', 'video'].forEach(type => { const option = document.createElement('option'); option.value = type; option.textContent = type.charAt(0).toUpperCase() + type.slice(1); if (bg.type === type) option.selected = true; bgTypeSelect.appendChild(option); }); bgTypeSelect.addEventListener('change', () => { bg.type = bgTypeSelect.value; renderLayoutSettingsPanel(); renderCanvas(); }); container.append(bgTypeLabel, bgTypeSelect); const bgValueLabel = document.createElement('label'); bgValueLabel.textContent = 'Значение (цвет или URL)'; const bgValueInput = document.createElement('input'); bgValueInput.type = bg.type === 'color' ? 'color' : 'text'; bgValueInput.value = bg.value; bgValueInput.addEventListener('input', () => { bg.value = bgValueInput.value; sectionData.background = bg; renderCanvas(); }); container.append(bgValueLabel, bgValueInput); if (name === 'main') { container.appendChild(createColumnEditor(sectionData)); } return container; }
function createColumnEditor(mainData) { const container = document.createElement('div'); container.className = 'column-editor'; const title = document.createElement('h4'); title.textContent = 'Колонки'; container.appendChild(title); mainData.columns.forEach((column, index) => { const columnRow = document.createElement('div'); columnRow.className = 'column-editor-row'; const widthInput = document.createElement('input'); widthInput.type = 'text'; widthInput.placeholder = 'e.g., 60% or 2fr'; widthInput.value = column.width; widthInput.addEventListener('input', () => { column.width = widthInput.value; renderCanvas(); }); const deleteBtn = document.createElement('button'); deleteBtn.textContent = '❌'; deleteBtn.title = 'Удалить колонку и все ее элементы'; deleteBtn.onclick = () => { if (confirm('Вы уверены? Все элементы в колонке будут удалены.')) { const elementIdsToRemove = new Set(column.elements); config.elements = config.elements.filter(el => !elementIdsToRemove.has(el.id)); mainData.columns.splice(index, 1); renderCanvas(); renderLayoutSettingsPanel(); } }; columnRow.append(`Колонка ${index + 1}: `, widthInput, deleteBtn); container.appendChild(columnRow); }); const addBtn = document.createElement('button'); addBtn.textContent = '+ Добавить колонку'; addBtn.className = 'add-column-btn'; addBtn.onclick = () => { mainData.columns.push({ id: `col_${Date.now()}`, width: '1fr', elements: [] }); renderCanvas(); renderLayoutSettingsPanel(); }; container.appendChild(addBtn); return container; }
function createGroupContainer(title) { const container = document.createElement('div'); container.className = 'inspector-group'; const h4 = document.createElement('h4'); h4.textContent = title; container.appendChild(h4); return container; }
function createInputField(type, label, value, onUpdate) { const div = document.createElement('div'); div.className = 'input-wrapper'; const labelEl = document.createElement('label'); labelEl.textContent = label; const input = document.createElement('input'); input.type = type; input.value = value; const eventType = type === 'color' ? 'input' : 'change'; input.addEventListener(eventType, () => { onUpdate(input.value); }); if (type === 'text') { input.addEventListener('input', () => onUpdate(input.value)); } div.append(labelEl, input); return div; }
function createTextArea(label, value, onUpdate) { const div = document.createElement('div'); div.className = 'input-wrapper'; div.innerHTML = `<label>${label}</label>`; const textarea = document.createElement('textarea'); textarea.value = value; textarea.addEventListener('input', () => { onUpdate(textarea.value); }); div.appendChild(textarea); return div; }
function createSelect(label, value, options, onUpdate) { const div = document.createElement('div'); div.className = 'input-wrapper'; div.innerHTML = `<label>${label}</label>`; const select = document.createElement('select'); options.forEach(opt => { const option = document.createElement('option'); option.value = opt.val; option.textContent = opt.text; if (opt.val === value) option.selected = true; select.appendChild(option); }); select.addEventListener('change', () => { onUpdate(select.value); }); div.appendChild(select); return div; }

// --- INTERACTIVITY & SAVING ---
function initDragAndDrop() { const columns = document.querySelectorAll('.admin-column'); columns.forEach(column => { new Sortable(column, { group: 'shared', animation: 150, onEnd: (evt) => { const elementId = evt.item.dataset.elementId; const fromColId = evt.from.dataset.columnId; const toColId = evt.to.dataset.columnId; const fromColData = config.layout.main.columns.find(c => c.id === fromColId); const toColData = config.layout.main.columns.find(c => c.id === toColId); fromColData.elements.splice(evt.oldIndex, 1); toColData.elements.splice(evt.newIndex, 0, elementId); } }); }); }
function initDraggablePanels() { interact('.floating-panel').draggable({ allowFrom: '.panel-header', inertia: true, modifiers: [interact.modifiers.restrictRect({ restriction: 'parent', endOnly: true })], listeners: { move(event) { var target = event.target; var x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx; var y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy; target.style.transform = 'translate(' + x + 'px, ' + y + 'px)'; target.setAttribute('data-x', x); target.setAttribute('data-y', y); } } }); }
async function saveChanges() { const btn = document.getElementById('save-btn'); btn.textContent = 'Сохранение...'; btn.disabled = true; try { const result = await githubApi.updateFile('config.json', config, configSha); configSha = result.content.sha; alert('Изменения успешно сохранены!'); } catch (error) { console.error(error); alert(`Ошибка сохранения: ${error.message}`); } finally { btn.textContent = '💾 Сохранить'; btn.disabled = false; } }