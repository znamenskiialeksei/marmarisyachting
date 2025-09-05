document.addEventListener('DOMContentLoaded', () => {
    console.log('Запущен admin.js версии 2.0 (финальная).');
    // --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ СОСТОЯНИЯ ---
    let githubToken = null;
    let currentConfig = null;
    let selectedElementId = null;

    // --- DOM ЭЛЕМЕНТЫ ---
    const loginView = document.getElementById('login-view');
    const adminView = document.getElementById('admin-view');
    const tokenInput = document.getElementById('github-token-input');
    const loginBtn = document.getElementById('login-btn');
    const saveBtn = document.getElementById('save-btn');
    
    // --- ИНИЦИАЛИЗАЦИЯ ---

    const savedToken = localStorage.getItem('githubToken');
    if (savedToken) {
        githubToken = savedToken;
        loginView.style.display = 'none';
        adminView.style.display = 'flex';
        loadAdminPanel();
    }

    loginBtn.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        if (token) {
            githubToken = token;
            localStorage.setItem('githubToken', token);
            loginView.style.display = 'none';
            adminView.style.display = 'flex';
            loadAdminPanel();
        } else {
            alert('Пожалуйста, введите токен доступа.');
        }
    });
    
    saveBtn.addEventListener('click', saveConfiguration);

    async function loadAdminPanel() {
        const cacheBust = `?v=${new Date().getTime()}`;
        try {
            const response = await fetch(`config.json${cacheBust}`);
            if (!response.ok) throw new Error(`Ошибка сети при загрузке config.json (статус: ${response.status})`);
            currentConfig = await response.json();
            console.log('Конфигурация успешно загружена:', currentConfig);
            renderCanvas();
            setupToolbarActions();
            makePanelsInteractive();
        } catch (error) {
            console.error("Критическая ошибка загрузки панели:", error);
            alert(`Не удалось загрузить или разобрать config.json. Убедитесь, что он синтаксически корректен. Ошибка: ${error.message}`);
        }
    }
    
    async function saveConfiguration() {
        saveBtn.textContent = 'Сохранение...';
        saveBtn.disabled = true;
        updateStructureFromDOM();
        
        console.log('%c--- НАЧАЛО СОХРАНЕНИЯ ---', 'color: blue; font-weight: bold;');

        try {
            if (!currentConfig || !currentConfig.github || !currentConfig.github.username || !currentConfig.github.repo) {
                throw new Error('Файл config.json не загружен или не содержит секцию "github" с полями "username" и "repo".');
            }

            const { username, repo } = currentConfig.github;
            const filePath = 'config.json';
            const url = `https://api.github.com/repos/${username}/${repo}/contents/${filePath}`;

            console.log(`Шаг 1: Запрашиваем SHA файла по адресу: ${url}`);

            const getFileResponse = await fetch(url, {
                headers: { 'Authorization': `token ${githubToken}` }
            });

            if (!getFileResponse.ok) {
                throw new Error(`Не удалось получить SHA файла. Статус ответа от GitHub: ${getFileResponse.status} ${getFileResponse.statusText}`);
            }
            
            const fileData = await getFileResponse.json();
            const sha = fileData.sha;
            console.log(`Шаг 2: SHA успешно получен: ${sha}`);
            
            const contentToSave = JSON.stringify(currentConfig, null, 2);
            const encodedContent = btoa(unescape(encodeURIComponent(contentToSave)));
            
            const body = {
                message: `[Admin Panel] Update config.json at ${new Date().toISOString()}`,
                content: encodedContent,
                sha: sha
            };
            
            console.log('Шаг 3: Отправляем PUT-запрос на сохранение...');
            const saveResponse = await fetch(url, {
                method: 'PUT',
                headers: { 'Authorization': `token ${githubToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            if (saveResponse.ok) {
                console.log('%cУСПЕХ! Файл сохранен.', 'color: green; font-weight: bold;');
                alert('Конфигурация успешно сохранена!');
            } else {
                throw new Error(`Ошибка сохранения на GitHub. Статус ответа: ${saveResponse.status} ${saveResponse.statusText}`);
            }

        } catch (error) {
            console.error('ОШИБКА В ПРОЦЕССЕ СОХРАНЕНИЯ:', error);
            alert(`Произошла ошибка при сохранении: ${error.message}. Подробности в консоли.`);
        } finally {
            console.log('%c--- КОНЕЦ ОПЕРАЦИИ ---', 'color: blue; font-weight: bold;');
            saveBtn.textContent = '💾 Сохранить';
            saveBtn.disabled = false;
        }
    }

    // --- ВСЕ ОСТАЛЬНЫЕ ФУНКЦИИ БЕЗ ИЗМЕНЕНИЙ ---
    function renderCanvas(){const canvas=document.getElementById("admin-canvas");canvas.innerHTML="";const elementContainer=document.createElement("div");elementContainer.id="element-container";currentConfig.layout.main.columns.forEach(column=>{const columnDiv=document.createElement("div");columnDiv.className="layout-column sortable-column";columnDiv.style.flexBasis=column.width;columnDiv.dataset.columnId=column.id;column.elements.forEach(elementId=>{const elementData=currentConfig.elements.find(el=>el.id===elementId);if(elementData){columnDiv.appendChild(createAdminElement(elementData))}});elementContainer.appendChild(columnDiv)});canvas.appendChild(elementContainer);initDragAndDrop()}
    function createAdminElement(elementData){const wrapper=document.createElement("div");wrapper.className="admin-element-wrapper";wrapper.dataset.elementId=elementData.id;const overlay=document.createElement("div");overlay.className="admin-element-overlay";wrapper.appendChild(overlay);const publicElement=createElement(elementData);const iframe=publicElement.querySelector("iframe");if(iframe){iframe.setAttribute("sandbox","");iframe.style.pointerEvents="none"}wrapper.appendChild(publicElement);wrapper.addEventListener("click",e=>{e.stopPropagation();selectElement(elementData.id)});return wrapper}
    function initDragAndDrop(){const columns=document.querySelectorAll(".sortable-column");columns.forEach(col=>{new Sortable(col,{group:"shared-elements",animation:150,ghostClass:"sortable-ghost",onEnd:updateStructureFromDOM})})}
    function makePanelsInteractive(){interact(".floating-panel").draggable({allowFrom:".panel-header",inertia:true,modifiers:[interact.modifiers.restrictRect({restriction:"parent",endOnly:true})],autoScroll:true,listeners:{move(event){const target=event.target;const x=(parseFloat(target.getAttribute("data-x"))||0)+event.dx;const y=(parseFloat(target.getAttribute("data-y"))||0)+event.dy;target.style.transform=`translate(${x}px, ${y}px)`;target.setAttribute("data-x",x);target.setAttribute("data-y",y)}}});document.querySelectorAll(".panel-action").forEach(btn=>{btn.addEventListener("click",function(){const panel=this.closest(".floating-panel");const action=this.dataset.action;if(action==="close")panel.style.display="none";if(action==="minimize")panel.querySelector(".panel-body").classList.toggle("minimized")})})}
    function selectElement(elementId){document.querySelector(".admin-element-wrapper.selected")?.classList.remove("selected");const newSelected=document.querySelector(`.admin-element-wrapper[data-element-id="${elementId}"]`);if(newSelected){newSelected.classList.add("selected");selectedElementId=elementId;renderInspector(elementId)}}
    function renderInspector(elementId){const elementData=currentConfig.elements.find(el=>el.id===elementId);if(!elementData)return;const inspectorBody=document.getElementById("inspector-body");inspectorBody.innerHTML=`<div class="inspector-group"><h4>Действия</h4><button id="delete-element-btn">Удалить элемент</button></div><div class="inspector-group"><h4>Общие</h4><div class="inspector-field"><label>ID</label><input type="text" value="${elementData.id}" readonly></div><div class="inspector-field"><label>Заголовок (в админке)</label><input type="text" data-key="adminTitle" value="${elementData.adminTitle||""}"></div></div><div class="inspector-group"><h4>Содержимое</h4>${generateContentFields(elementData)}</div><div class="inspector-group"><h4>Стили</h4>${generateStyleFields(elementData.styles||{})}</div>`;document.getElementById("inspector-panel").style.display="block";inspectorBody.querySelectorAll("input, textarea, select").forEach(input=>{input.addEventListener("input",updateElementFromInspector)});document.getElementById("delete-element-btn").addEventListener("click",deleteSelectedElement)}
    function generateContentFields(element){switch(element.type){case"externalBlock":case"photo":case"videoBlock":return`<div class="inspector-field"><label>URL контента</label><input type="text" data-content-key="url" value="${element.content.url||""}"></div>`;case"textBlock":return`<div class="inspector-field"><label>HTML контент</label><textarea data-content-key="html">${element.content.html||""}</textarea></div>`;case"button":return`<div class="inspector-field"><label>Текст кнопки</label><input type="text" data-content-key="text" value="${element.content.text||""}"></div><div class="inspector-field"><label>Действие</label><select data-content-key="action"><option value="openLink" ${element.content.action==="openLink"?"selected":""}>Открыть ссылку</option><option value="openModal" ${element.content.action==="openModal"?"selected":""}>Модальное окно</option></select></div><div class="inspector-field"><label>URL ссылки</label><input type="text" data-content-key="url" value="${element.content.url||""}"></div><div class="inspector-field"><label>Контент модального окна (HTML)</label><textarea data-content-key="modalContent">${element.content.modalContent||""}</textarea></div>`;default:return"<p>Нет настраиваемого контента.</p>"}}
    function generateStyleFields(styles){return`<div class="inspector-field"><label>Ширина (width)</label><input type="text" data-style-key="width" value="${styles.width||""}"></div><div class="inspector-field"><label>Высота (height)</label><input type="text" data-style-key="height" value="${styles.height||""}"></div><div class="inspector-field"><label>Цвет фона</label><input type="color" data-style-key="backgroundColor" value="${styles.backgroundColor||"#ffffff"}"></div><div class="inspector-field"><label>Цвет текста</label><input type="color" data-style-key="color" value="${styles.color||"#000000"}"></div><div class="inspector-field"><label>Отступы (padding)</label><input type="text" data-style-key="padding" value="${styles.padding||""}"></div><div class="inspector-field"><label>Скругление (borderRadius)</label><input type="text" data-style-key="borderRadius" value="${styles.borderRadius||""}"></div><div class="inspector-field"><label>Тень (boxShadow)</label><input type="text" data-style-key="boxShadow" value="${styles.boxShadow||""}"></div>`}
    function updateElementFromInspector(event){if(!selectedElementId)return;const elementData=currentConfig.elements.find(el=>el.id===selectedElementId);const input=event.target;const value=input.value;if(input.dataset.key)elementData[input.dataset.key]=value;else if(input.dataset.contentKey)elementData.content[input.dataset.contentKey]=value;else if(input.dataset.styleKey){if(!elementData.styles)elementData.styles={};elementData.styles[input.dataset.styleKey]=value}const oldElement=document.querySelector(`.admin-element-wrapper[data-element-id="${selectedElementId}"]`);if(oldElement){oldElement.replaceWith(createAdminElement(elementData));document.querySelector(`.admin-element-wrapper[data-element-id="${selectedElementId}"]`).classList.add("selected")}}
    function deleteSelectedElement(){if(!selectedElementId||!confirm("Вы уверены, что хотите удалить этот элемент? Действие необратимо."))return;currentConfig.elements=currentConfig.elements.filter(el=>el.id!==selectedElementId);currentConfig.layout.main.columns.forEach(col=>{col.elements=col.elements.filter(id=>id!==selectedElementId)});document.getElementById("inspector-panel").style.display="none";selectedElementId=null;renderCanvas()}
    function addNewElement(type){if(currentConfig.layout.main.columns.length===0){return alert("Сначала нужно добавить хотя бы одну колонку в макете!")}const newElement={id:`el-${Date.now()}`,adminTitle:`Новый ${type}`,type:type,content:{},styles:{}};if(type==="textBlock")newElement.content.html="<p>Введите ваш текст здесь.</p>";if(type==="photo")newElement.content.url="https://via.placeholder.com/600x400.png?text=Новое+фото";if(type==="button"){newElement.content.text="Новая кнопка";newElement.styles={padding:"15px",backgroundColor:"#3498db",color:"#ffffff",border:"none",cursor:"pointer"}}currentConfig.elements.push(newElement);currentConfig.layout.main.columns[0].elements.unshift(newElement.id);renderCanvas();selectElement(newElement.id)}
    function setupToolbarActions(){document.querySelectorAll(".add-element-btn").forEach(btn=>{btn.onclick=()=>addNewElement(btn.dataset.type)});document.querySelectorAll(".preview-btn").forEach(btn=>{btn.onclick=()=>{const canvas=document.getElementById("admin-canvas");const wrapper=document.getElementById("canvas-wrapper");const mode=btn.dataset.mode;if(mode==="desktop")canvas.style.width="100%";if(mode==="tablet")canvas.style.width="768px";if(mode==="mobile")canvas.style.width="375px";wrapper.scrollTo({top:0,behavior:"smooth"})}})}
    function updateStructureFromDOM(){console.log("Структура обновлена после перетаскивания.");const newColumnsData=[];document.querySelectorAll(".sortable-column").forEach(columnDiv=>{const columnId=columnDiv.dataset.columnId;const originalColumn=currentConfig.layout.main.columns.find(c=>c.id===columnId);const elementIds=Array.from(columnDiv.querySelectorAll(".admin-element-wrapper")).map(el=>el.dataset.elementId);newColumnsData.push({...originalColumn,elements:elementIds})});currentConfig.layout.main.columns=newColumnsData}
    function createElement(elementData){const wrapper=document.createElement("div");wrapper.className=`element-wrapper type-${elementData.type}`;let element;switch(elementData.type){case"externalBlock":case"videoBlock":element=document.createElement("iframe");element.src=elementData.content.url;break;case"textBlock":element=document.createElement("div");element.innerHTML=elementData.content.html;break;case"photo":element=document.createElement("img");element.src=elementData.content.url;element.alt=elementData.adminTitle||"Изображение";break;case"button":element=document.createElement("button");element.textContent=elementData.content.text;element.style.pointerEvents="none";break;default:element=document.createElement("div");element.textContent=`Неизвестный тип элемента`}if(elementData.styles){Object.assign(element.style,elementData.styles)}wrapper.appendChild(element);return wrapper}
});