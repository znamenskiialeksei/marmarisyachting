document.addEventListener('DOMContentLoaded', () => {
    // --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И КОНСТАНТЫ ---
    let githubToken = null;
    let currentConfig = null;
    let selectedElementId = null;
    const DOM = {
        loginView: document.getElementById('login-view'),
        adminView: document.getElementById('admin-view'),
        tokenInput: document.getElementById('github-token-input'),
        loginBtn: document.getElementById('login-btn'),
        saveBtn: document.getElementById('save-btn'),
        canvas: document.getElementById('admin-canvas'),
        panels: { inspector: document.getElementById('inspector-panel'), global: document.getElementById('global-settings-panel'), layout: document.getElementById('layout-settings-panel'), },
        panelBodies: { inspector: document.getElementById('inspector-body'), global: document.getElementById('global-settings-body'), layout: document.getElementById('layout-settings-body'), }
    };

    // --- ИНИЦИАЛИЗАЦИЯ ---
    initAuth();
    DOM.saveBtn.addEventListener('click', saveConfiguration);

    // --- АУТЕНТИФИКАЦИЯ ---
    function initAuth() {
        const savedToken = localStorage.getItem('githubToken');
        if (savedToken) { githubToken = savedToken; DOM.loginView.style.display = 'none'; DOM.adminView.style.display = 'flex'; loadAdminPanel(); }
        DOM.loginBtn.addEventListener('click', () => {
            const token = DOM.tokenInput.value.trim();
            if (token) { githubToken = token; localStorage.setItem('githubToken', token); DOM.loginView.style.display = 'none'; DOM.adminView.style.display = 'flex'; loadAdminPanel(); } 
            else { alert('Пожалуйста, введите токен доступа.'); }
        });
    }

    // --- ЗАГРУЗКА И ОСНОВНОЙ РЕНДЕРИНГ ---
    async function loadAdminPanel() {
        const cacheBust = `?v=${new Date().getTime()}`;
        try {
            const response = await fetch(`config.json${cacheBust}`);
            if (!response.ok) throw new Error(`Ошибка сети (статус: ${response.status})`);
            currentConfig = await response.json();
            renderAll();
            initInteractivity();
        } catch (error) { alert(`Критическая ошибка загрузки: ${error.message}`); }
    }
    
    // --- УПРАВЛЕНИЕ РЕНДЕРИНГОМ ---
    function renderAll() {
        renderCanvas();
        renderFloatingPanels();
    }

    function renderCanvas() {
        DOM.canvas.innerHTML = '';
        const canvasHeader = createSectionElement(currentConfig.layout.header, 'header');
        const canvasMain = document.createElement('main');
        canvasMain.id = 'element-container';
        const canvasFooter = createSectionElement(currentConfig.layout.footer, 'footer');

        const mainLayout = currentConfig.layout.main || {};
        if (mainLayout.background) { if (mainLayout.background.type === 'color') DOM.canvas.style.backgroundColor = mainLayout.background.value; } 
        else { DOM.canvas.style.backgroundColor = '#ffffff'; }

        currentConfig.layout.main.columns.forEach(column => {
            const columnDiv = document.createElement('div');
            columnDiv.className = 'layout-column sortable-column';
            columnDiv.style.flexBasis = column.width;
            columnDiv.dataset.columnId = column.id;
            column.elements.forEach(elementId => {
                const elementData = currentConfig.elements.find(el => el.id === elementId);
                if (elementData) columnDiv.appendChild(createAdminElement(elementData));
            });
            canvasMain.appendChild(columnDiv);
        });
        
        DOM.canvas.append(canvasHeader, canvasMain, canvasFooter);
        initDragAndDrop();
    }

    function createSectionElement(sectionConfig, tagName) {
        const element = document.createElement(tagName);
        element.id = `canvas-${tagName}`;
        element.innerHTML = sectionConfig.content || '';
        if (sectionConfig.styles) Object.assign(element.style, sectionConfig.styles);
        if (sectionConfig.background) {
            if (sectionConfig.background.type === 'color') element.style.backgroundColor = sectionConfig.background.value;
            else if (sectionConfig.background.type === 'image') { element.style.backgroundImage = `url('${sectionConfig.background.value}')`; element.style.backgroundSize = 'cover'; element.style.backgroundPosition = 'center'; }
        }
        return element;
    }

    function createAdminElement(elementData) {
        const wrapper = document.createElement('div');
        wrapper.className = 'admin-element-wrapper';
        wrapper.dataset.elementId = elementData.id;
        if (elementData.styles) Object.assign(wrapper.style, elementData.styles);
        
        const overlay = document.createElement('div');
        overlay.className = 'admin-element-overlay';
        wrapper.appendChild(overlay);

        const publicElement = createElement(elementData);
        const iframe = publicElement.querySelector('iframe');
        if (iframe) {
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
            iframe.setAttribute('allow', 'encrypted-media; picture-in-picture;');
            iframe.style.pointerEvents = 'none';
        }
        wrapper.appendChild(publicElement);
        wrapper.addEventListener('click', e => { e.stopPropagation(); selectElement(elementData.id); });
        return wrapper;
    }

    // --- ПАНЕЛИ НАСТРОЕК ---
    function renderFloatingPanels() {
        renderGlobalSettingsPanel();
        renderLayoutSettingsPanel();
    }
    
    function renderGlobalSettingsPanel() {
        const body = DOM.panelBodies.global;
        body.innerHTML = `<div class="inspector-group"><h4>Основные</h4><div class="inspector-field"><label>Заголовок сайта (Title)</label><input type="text" data-config-path="globalSettings.pageTitle" value="${currentConfig.globalSettings.pageTitle || ''}"></div></div>`;
        body.querySelector('input').addEventListener('input', updateConfigFromInput);
    }

    function renderLayoutSettingsPanel() {
        const body = DOM.panelBodies.layout;
        const { header, main, footer } = currentConfig.layout;
        body.innerHTML = `<div class="inspector-group"><h4>Шапка (Header)</h4>${createSectionEditor('header', header)}</div><div class="inspector-group"><h4>Основная часть (Main)</h4>${createSectionEditor('main', main)}<h5>Колонки</h5><div id="columns-editor">${main.columns.map(col => createColumnEditor(col)).join('')}</div><button id="add-column-btn" class="add-element-btn" style="width:100%; margin-top:10px;">+ Добавить колонку</button></div><div class="inspector-group"><h4>Подвал (Footer)</h4>${createSectionEditor('footer', footer)}</div>`;
        body.querySelectorAll('input, select, textarea').forEach(el => el.addEventListener('input', updateConfigFromInput));
        body.querySelectorAll('.delete-column-btn').forEach(btn => btn.addEventListener('click', deleteColumn));
        body.querySelector('#add-column-btn').addEventListener('click', addColumn);
    }

    function createSectionEditor(key, config) {
        return `${key !== 'main' ? `<div class="inspector-field"><label>HTML-контент</label><textarea data-config-path="layout.${key}.content">${config.content || ''}</textarea></div>` : ''}<div class="inspector-field"><label>Тип фона</label><select data-config-path="layout.${key}.background.type"><option value="color" ${config.background?.type === 'color' ? 'selected' : ''}>Цвет</option><option value="image" ${config.background?.type === 'image' ? 'selected' : ''}>Изображение</option></select></div><div class="inspector-field"><label>Значение (цвет или URL)</label><input type="text" data-config-path="layout.${key}.background.value" value="${config.background?.value || ''}"></div>`;
    }

    function createColumnEditor(column) {
        return `<div class="column-editor" data-column-id="${column.id}"><input type="text" data-path="width" value="${column.width}"><button class="delete-column-btn" data-column-id="${column.id}">❌</button></div>`;
    }
    
    // --- НОВАЯ ЛОГИКА ОБНОВЛЕНИЯ (БЕЗ ПЕРЕРИСОВКИ) ---
    function updateConfigFromInput(event) {
        const el = event.target;
        const path = el.dataset.configPath;
        if (!path) return;

        let keys = path.split('.');
        let last = keys.pop();
        let obj = keys.reduce((o, k) => o[k] = o[k] || {}, currentConfig);
        obj[last] = el.value;
        
        // Targeted DOM update
        updateDOMFromConfig(path, el.value);
    }

    function updateDOMFromConfig(path, value) {
        if (path === 'globalSettings.pageTitle') document.title = value;
        if (path.startsWith('layout.header')) updateSectionDOM('header');
        if (path.startsWith('layout.footer')) updateSectionDOM('footer');
        if (path.startsWith('layout.main.columns')) {
            const columnId = event.target.closest('.column-editor').dataset.columnId;
            const columnEl = DOM.canvas.querySelector(`.layout-column[data-column-id="${columnId}"]`);
            if(columnEl) columnEl.style.flexBasis = value;
        }
    }

    function updateSectionDOM(key) {
        const config = currentConfig.layout[key];
        const element = DOM.canvas.querySelector(`#canvas-${key}`);
        if(!element) return;
        if (config.content) element.innerHTML = config.content;
        if (config.background) {
             if (config.background.type === 'color') { element.style.backgroundColor = config.background.value; element.style.backgroundImage = 'none'; }
             else if (config.background.type === 'image') { element.style.backgroundImage = `url('${config.background.value}')`; }
        }
    }

    function updateElementFromInspector(event) {
        if (!selectedElementId) return;
        const elementData = currentConfig.elements.find(el => el.id === selectedElementId);
        const input = event.target;
        const value = input.value;
        let changedProperty;

        if (input.dataset.key) { elementData[input.dataset.key] = value; } 
        else if (input.dataset.contentKey) { elementData.content[input.dataset.contentKey] = value; changedProperty = 'content'; } 
        else if (input.dataset.styleKey) {
            if (!elementData.styles) elementData.styles = {};
            elementData.styles[input.dataset.styleKey] = value;
            changedProperty = 'style';
        }
        
        // FIX: Targeted update of the element on canvas
        const wrapper = DOM.canvas.querySelector(`.admin-element-wrapper[data-element-id="${selectedElementId}"]`);
        if (!wrapper) return;
        if (changedProperty === 'style') {
            Object.assign(wrapper.style, elementData.styles);
        }
        if (changedProperty === 'content') {
            wrapper.querySelector('.element-wrapper').remove();
            wrapper.appendChild(createElement(elementData));
        }
    }
    
    function addColumn() {
        currentConfig.layout.main.columns.push({ id: `col-${Date.now()}`, width: '1fr', elements: [] });
        renderAll(); // Full render is appropriate here
    }

    function deleteColumn(event) {
        const columnId = event.target.closest('.column-editor').dataset.columnId;
        currentConfig.layout.main.columns = currentConfig.layout.main.columns.filter(c => c.id !== columnId);
        renderAll(); // Full render is appropriate here
    }

    // --- ИНТЕРАКТИВНОСТЬ (DRAG-N-DROP, ПАНЕЛИ, RESIZE) ---
    function initInteractivity() {
        setupToolbarActions();
        makePanelsInteractive();
        makeElementsResizable(); // FIX: Инициализация изменения размера
    }

    function makeElementsResizable() {
        interact('.admin-element-wrapper').resizable({
            edges: { left: false, right: true, bottom: true, top: false },
            listeners: {
                move(event) {
                    let { x, y } = event.target.dataset;
                    x = (parseFloat(x) || 0); y = (parseFloat(y) || 0);
                    Object.assign(event.target.style, { width: `${event.rect.width}px`, height: `${event.rect.height}px`, transform: `translate(${x}px, ${y}px)` });
                },
                end(event) {
                    const elementId = event.target.dataset.elementId;
                    const elementData = currentConfig.elements.find(el => el.id === elementId);
                    if (elementData) {
                        if (!elementData.styles) elementData.styles = {};
                        elementData.styles.width = event.target.style.width;
                        elementData.styles.height = event.target.style.height;
                        renderInspector(elementId); // Update inspector fields
                    }
                }
            },
            modifiers: [ interact.modifiers.restrictSize({ min: { width: 50, height: 50 } }) ],
            inertia: true
        });
    }
    
    // --- ЗДЕСЬ ИДЕТ ОСТАЛЬНОЙ КОД ADMIN.JS (ФУНКЦИИ, КОТОРЫЕ ПОЧТИ НЕ ИЗМЕНИЛИСЬ) ---
    function setupToolbarActions(){document.querySelectorAll(".add-element-btn").forEach(btn=>{if(btn.id!=="add-column-btn")btn.onclick=()=>addNewElement(btn.dataset.type)});document.querySelectorAll(".preview-btn").forEach(btn=>{btn.onclick=()=>{if(btn.dataset.mode==="desktop")DOM.canvas.style.width="100%";if(btn.dataset.mode==="tablet")DOM.canvas.style.width="768px";if(btn.dataset.mode==="mobile")DOM.canvas.style.width="375px"}});document.querySelectorAll(".panel-toggle-btn").forEach(btn=>{btn.onclick=()=>{const panelId=btn.dataset.panel;const panel=document.getElementById(panelId);panel.style.display=panel.style.display==="none"?"block":"none"}})}
    function initDragAndDrop(){const columns=document.querySelectorAll(".sortable-column");columns.forEach(col=>{new Sortable(col,{group:"shared-elements",animation:150,ghostClass:"sortable-ghost",onEnd:updateStructureFromDOM})})}
    function makePanelsInteractive(){interact(".floating-panel").draggable({allowFrom:".panel-header",inertia:true,modifiers:[interact.modifiers.restrictRect({restriction:"parent",endOnly:true})],listeners:{move(event){const target=event.target;const x=(parseFloat(target.getAttribute("data-x"))||0)+event.dx;const y=(parseFloat(target.getAttribute("data-y"))||0)+event.dy;target.style.transform=`translate(${x}px, ${y}px)`;target.setAttribute("data-x",x);target.setAttribute("data-y",y)}}});document.querySelectorAll(".panel-action").forEach(btn=>{btn.addEventListener("click",function(){const panel=this.closest(".floating-panel");const action=this.dataset.action;if(action==="close")panel.style.display="none";if(action==="minimize")panel.querySelector(".panel-body").classList.toggle("minimized")})})}
    function selectElement(elementId){document.querySelector(".admin-element-wrapper.selected")?.classList.remove("selected");const newSelected=document.querySelector(`.admin-element-wrapper[data-element-id="${elementId}"]`);if(newSelected){newSelected.classList.add("selected");selectedElementId=elementId;renderInspector(elementId)}}
    function renderInspector(elementId){const elementData=currentConfig.elements.find(el=>el.id===elementId);if(!elementData)return;const inspectorBody=DOM.panelBodies.inspector;inspectorBody.innerHTML=`<div class="inspector-group"><h4>Действия</h4><button id="delete-element-btn">Удалить элемент</button></div><div class="inspector-group"><h4>Общие</h4><div class="inspector-field"><label>ID</label><input type="text" value="${elementData.id}" readonly></div><div class="inspector-field"><label>Заголовок</label><input type="text" data-key="adminTitle" value="${elementData.adminTitle||""}"></div></div><div class="inspector-group"><h4>Содержимое</h4>${generateContentFields(elementData)}</div><div class="inspector-group"><h4>Стили</h4>${generateStyleFields(elementData.styles||{})}</div>`;DOM.panels.inspector.style.display="block";inspectorBody.querySelectorAll("input, textarea, select").forEach(input=>{input.addEventListener("input",updateElementFromInspector)});document.getElementById("delete-element-btn").addEventListener("click",deleteSelectedElement)}
    function generateContentFields(element){switch(element.type){case"externalBlock":case"photo":case"videoBlock":return`<div class="inspector-field"><label>URL</label><input type="text" data-content-key="url" value="${element.content.url||""}"></div>`;case"textBlock":return`<div class="inspector-field"><label>HTML</label><textarea data-content-key="html">${element.content.html||""}</textarea></div>`;case"button":return`<div class="inspector-field"><label>Текст</label><input type="text" data-content-key="text" value="${element.content.text||""}"></div><div class="inspector-field"><label>Действие</label><select data-content-key="action"><option value="openLink" ${element.content.action==="openLink"?"selected":""}>Ссылка</option><option value="openModal" ${element.content.action==="openModal"?"selected":""}>Модальное окно</option></select></div><div class="inspector-field"><label>URL</label><input type="text" data-content-key="url" value="${element.content.url||""}"></div><div class="inspector-field"><label>HTML модального окна</label><textarea data-content-key="modalContent">${element.content.modalContent||""}</textarea></div>`;default:return"<p>Нет настроек.</p>"}}
    function generateStyleFields(styles){return`<div class="inspector-field"><label>Ширина</label><input type="text" data-style-key="width" value="${styles.width||""}"></div><div class="inspector-field"><label>Высота</label><input type="text" data-style-key="height" value="${styles.height||""}"></div><div class="inspector-field"><label>Цвет фона</label><input type="color" data-style-key="backgroundColor" value="${styles.backgroundColor||"#ffffff"}"></div><div class="inspector-field"><label>Цвет текста</label><input type="color" data-style-key="color" value="${styles.color||"#000000"}"></div><div class="inspector-field"><label>Отступы</label><input type="text" data-style-key="padding" value="${styles.padding||""}"></div><div class="inspector-field"><label>Скругление</label><input type="text" data-style-key="borderRadius" value="${styles.borderRadius||""}"></div><div class="inspector-field"><label>Тень</label><input type="text" data-style-key="boxShadow" value="${styles.boxShadow||""}"></div>`}
    function deleteSelectedElement(){if(!selectedElementId||!confirm("Вы уверены?"))return;currentConfig.elements=currentConfig.elements.filter(el=>el.id!==selectedElementId);currentConfig.layout.main.columns.forEach(col=>{col.elements=col.elements.filter(id=>id!==selectedElementId)});DOM.panels.inspector.style.display="none";selectedElementId=null;renderCanvas()}
    function addNewElement(type){if(currentConfig.layout.main.columns.length===0){return alert("Сначала добавьте колонку!")}const newElement={id:`el-${Date.now()}`,adminTitle:`Новый ${type}`,type:type,content:{},styles:{}};if(type==="textBlock")newElement.content.html="<p>Новый текст.</p>";if(type==="photo")newElement.content.url="https://via.placeholder.com/600x400.png?text=Фото";if(type==="button"){newElement.content.text="Кнопка";newElement.styles={padding:"15px",backgroundColor:"#3498db",color:"#ffffff",border:"none",cursor:"pointer"}}currentConfig.elements.push(newElement);currentConfig.layout.main.columns[0].elements.unshift(newElement.id);renderCanvas();selectElement(newElement.id)}
    function updateStructureFromDOM(){const newColumnsData=[];document.querySelectorAll(".sortable-column").forEach(columnDiv=>{const columnId=columnDiv.dataset.columnId;const originalColumn=currentConfig.layout.main.columns.find(c=>c.id===columnId);const elementIds=Array.from(columnDiv.querySelectorAll(".admin-element-wrapper")).map(el=>el.dataset.elementId);newColumnsData.push({...originalColumn,elements:elementIds})});currentConfig.layout.main.columns=newColumnsData}
    function createElement(elementData){const wrapper=document.createElement("div");wrapper.className=`element-wrapper type-${elementData.type}`;let element;switch(elementData.type){case"externalBlock":case"videoBlock":element=document.createElement("iframe");element.src=elementData.content.url;break;case"textBlock":element=document.createElement("div");element.innerHTML=elementData.content.html;break;case"photo":element=document.createElement("img");element.src=elementData.content.url;element.alt=elementData.adminTitle||"Изображение";break;case"button":element=document.createElement("button");element.textContent=elementData.content.text;element.style.pointerEvents="none";break;default:element=document.createElement("div");element.textContent=`Неизвестный тип элемента`}return wrapper}
    async function saveConfiguration(){DOM.saveBtn.textContent="Сохранение...";DOM.saveBtn.disabled=true;updateStructureFromDOM();try{if(!currentConfig||!currentConfig.github)throw new Error("Конфигурация не загружена");const{username,repo}=currentConfig.github;const url=`https://api.github.com/repos/${username}/${repo}/contents/config.json`;const getFileResponse=await fetch(url,{headers:{'Authorization':`token ${githubToken}`}});if(!getFileResponse.ok)throw new Error(`Не удалось получить SHA. Статус: ${getFileResponse.status}`);const fileData=await getFileResponse.json();const sha=fileData.sha;const contentToSave=JSON.stringify(currentConfig,null,2);const encodedContent=btoa(unescape(encodeURIComponent(contentToSave)));const body={message:`[Admin Panel] Update config.json at ${new Date().toISOString()}`,content:encodedContent,sha:sha};const saveResponse=await fetch(url,{method:'PUT',headers:{'Authorization':`token ${githubToken}`,'Content-Type':'application/json'},body:JSON.stringify(body)});if(saveResponse.ok){alert("Конфигурация успешно сохранена!")}else{throw new Error(`Ошибка сохранения. Статус: ${saveResponse.status}`)}}catch(error){console.error("ОШИБКА СОХРАНЕНИЯ:",error);alert(`Произошла ошибка: ${error.message}`)}finally{DOM.saveBtn.textContent="💾 Сохранить";DOM.saveBtn.disabled=false}}
});