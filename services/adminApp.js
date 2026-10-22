import { supabase } from './supabaseClient.js';
import { AuthService } from './authService.js';
import { CategoryService } from './categoryService.js';

let currentUserEmail = '';
let currentLocalId = null; 
let scheduleState = {};

const DIAS_CLAVE = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIAS_LABEL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    try {
        const session = await AuthService.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }

        currentUserEmail = session.user.email;
        const { data: adminData, error: adminErr } = await supabase
            .from('admins')
            .select('rol, local_id')
            .eq('email', currentUserEmail)
            .single();

        if (adminErr || !adminData || adminData.rol !== 'admin') {
            await showAppAlert('Acceso denegado', 'Tu usuario no tiene permisos de administrador.', 'error');
            window.location.href = 'login.html';
            return;
        }

        if (!adminData.local_id) {
            await showAppAlert('Sin Local', 'Tu cuenta no está vinculada a ningún local.', 'warning');
            return;
        }

        currentLocalId = adminData.local_id;
        await loadCategories(); 
        await loadAdminProducts();
        await loadUsers();
        await loadConfig();
        setupAdminEventListeners();
    } catch (err) {
        console.error('Error al inicializar panel:', err);
    }
});

function setupAdminEventListeners() {
    document.querySelectorAll('.btn-toggle-config').forEach(btn => btn.addEventListener('click', toggleConfigModal));
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await AuthService.logout();
        window.location.href = 'login.html';
    });
    document.getElementById('form-config')?.addEventListener('submit', handleSaveConfig);
    document.getElementById('form-add-product')?.addEventListener('submit', handleAddProduct);
    document.getElementById('form-add-category')?.addEventListener('submit', handleAddCategory);
    document.getElementById('form-add-user')?.addEventListener('submit', handleAddUserRole);
    document.getElementById('btn-add-floor')?.addEventListener('click', () => addFloorRow());
}

function showAppAlert(title, text, icon = 'info') {
    const isDark = document.documentElement.classList.contains('dark');
    return Swal.fire({
        title, text, icon, confirmButtonColor: '#f97316',
        background: isDark ? '#1e293b' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: { popup: 'rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700' }
    });
}

function toggleConfigModal() {
    document.getElementById('config-modal')?.classList.toggle('hidden');
}

async function loadCategories() {
    try {
        const categorias = await CategoryService.getAll(currentLocalId);
        const select = document.getElementById('p-cat');
        const list = document.getElementById('categories-list');
        if (select) select.innerHTML = '';
        if (list) list.innerHTML = '';

        if (categorias.length > 0) {
            categorias.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.nombre.toLowerCase().trim();
                opt.textContent = cat.nombre;
                if (select) select.appendChild(opt);

                const badge = document.createElement('span');
                badge.className = 'px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 border border-slate-200 dark:border-slate-600 shadow-sm';
                badge.innerHTML = `${cat.nombre} <button type="button" data-id="${cat.id}" class="btn-delete-cat text-rose-500 hover:text-rose-700 ml-1 transition"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>`;
                if (list) list.appendChild(badge);
            });

            list.querySelectorAll('.btn-delete-cat').forEach(btn => {
                btn.addEventListener('click', async (e) => await deleteCategory(e.currentTarget.getAttribute('data-id')));
            });
        } else {
            if (list) list.innerHTML = '<span class="text-xs text-slate-400">No hay categorías creadas.</span>';
        }
        lucide.createIcons();
    } catch (error) { console.error("Error cargando categorías:", error); }
}

async function handleAddCategory(e) {
    e.preventDefault();
    const nombreInput = document.getElementById('cat-name');
    try {
        await CategoryService.create(nombreInput.value.trim(), currentLocalId);
        nombreInput.value = '';
        await loadCategories();
    } catch (error) { showAppAlert('Error', 'No se pudo crear: ' + error.message, 'error'); }
}

async function deleteCategory(id) {
    const res = await Swal.fire({ title: '¿Eliminar?', text: "Productos con esta categoría seguirán existiendo.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#e11d48', cancelButtonColor: '#64748b', confirmButtonText: 'Sí', cancelButtonText: 'No' });
    if (res.isConfirmed) {
        try { await CategoryService.delete(id); await loadCategories(); } 
        catch (error) { showAppAlert('Error', error.message, 'error'); }
    }
}

async function loadAdminProducts() {
    const { data: products } = await supabase.from('productos').select('*').eq('local_id', currentLocalId).order('id', { ascending: true });
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (products) {
        products.forEach(p => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition';
            tr.innerHTML = `<td class="p-2 font-bold">${p.nombre}</td><td class="p-2 text-slate-500 capitalize">${p.categoria}</td><td class="p-2 font-extrabold text-orange-600">$${p.precio.toLocaleString()}</td><td class="p-2"><span class="px-2 py-1 rounded-full text-[10px] font-bold ${p.disponible ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">${p.disponible ? 'En Stock' : 'Pausado'}</span></td><td class="p-2 text-right space-x-2"><button data-id="${p.id}" data-status="${p.disponible}" class="btn-toggle-stock p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 font-semibold text-xs">${p.disponible ? 'Pausar' : 'Activar'}</button><button data-id="${p.id}" class="btn-delete-product p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold text-xs">Eliminar</button></td>`;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.btn-toggle-stock').forEach(btn => btn.addEventListener('click', async (e) => await toggleStock(parseInt(e.currentTarget.getAttribute('data-id')), e.currentTarget.getAttribute('data-status') === 'true')));
        tbody.querySelectorAll('.btn-delete-product').forEach(btn => btn.addEventListener('click', async (e) => await deleteProduct(parseInt(e.currentTarget.getAttribute('data-id')))));
    }
    lucide.createIcons();
}

async function handleAddProduct(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-product');
    const originalText = btnSubmit.innerText;
    const nombre = document.getElementById('p-name').value;
    const precio = parseInt(document.getElementById('p-price').value);
    const categoria = document.getElementById('p-cat').value;
    const descripcion = document.getElementById('p-desc').value;
    const file = document.getElementById('p-img-file').files[0];
    let imagen_url = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80';

    btnSubmit.innerText = 'Guardando...';
    btnSubmit.disabled = true;

    try {
        if (file) {
            btnSubmit.innerText = 'Subiendo...';
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
            const { error: uploadError } = await supabase.storage.from('productos').upload(fileName, file);
            if (uploadError) throw uploadError;
            imagen_url = supabase.storage.from('productos').getPublicUrl(fileName).data.publicUrl;
        }
        btnSubmit.innerText = 'Registrando...';
        const { error } = await supabase.from('productos').insert([{ nombre, precio, categoria, descripcion, imagen_url, disponible: true, local_id: currentLocalId }]);
        if (error) throw error;
        e.target.reset();
        await loadAdminProducts();
        showAppAlert('Producto Creado', `Agregado al menú.`, 'success');
    } catch (err) { showAppAlert('Error', err.message, 'error'); } 
    finally { btnSubmit.innerText = originalText; btnSubmit.disabled = false; }
}

async function toggleStock(id, currentStatus) {
    await supabase.from('productos').update({ disponible: !currentStatus }).eq('id', id);
    await loadAdminProducts();
}

async function deleteProduct(id) {
    const res = await Swal.fire({ title: '¿Eliminar producto?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e11d48', confirmButtonText: 'Sí', cancelButtonText: 'No' });
    if (res.isConfirmed) {
        await supabase.from('productos').delete().eq('id', id);
        await loadAdminProducts();
        showAppAlert('Eliminado', 'Producto eliminado.', 'success');
    }
}

async function loadConfig() {
    const { data } = await supabase.from('configuracion').select('*').eq('local_id', currentLocalId).maybeSingle();
    const container = document.getElementById('floors-container');
    if (container) container.innerHTML = '';
    
    const btnMenu = document.getElementById('btn-ver-menu');

    if (data) {
        if (data.alias_mp) document.getElementById('cfg-alias-mp').value = data.alias_mp;
        
        if (data.mp_access_token) {
            const tokenEl = document.getElementById('cfg-mp-token');
            if(tokenEl) tokenEl.value = data.mp_access_token;
        }

        if (data.slug) {
            const slugEl = document.getElementById('cfg-slug');
            if(slugEl) slugEl.value = data.slug;
            if (btnMenu) btnMenu.href = `index.html?local=${data.slug}`;
        } else {
            if (btnMenu) btnMenu.href = `index.html`; 
        }

        if (data.horarios_semana) scheduleState = data.horarios_semana;
        else initializeDefaultSchedule();

        if (data.pisos_config && data.pisos_config.length > 0) data.pisos_config.forEach(f => addFloorRow(f.nombre, f.mesas));
        else addFloorRow('Planta Baja', 6);
    } else {
        if (btnMenu) btnMenu.href = `index.html`; 
        initializeDefaultSchedule();
        addFloorRow('Planta Baja', 6);
    }
    renderDaysSchedule();
}

async function handleSaveConfig(e) {
    e.preventDefault();
    const alias_mp = document.getElementById('cfg-alias-mp')?.value.trim() || 'SABORURBANO.MP';
    const mp_access_token = document.getElementById('cfg-mp-token')?.value.trim() || null;
    const rawSlug = document.getElementById('cfg-slug')?.value || '';
    const slug = rawSlug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || null;

    const pisos_config = [];
    document.querySelectorAll('.floor-row').forEach(r => {
        const nombre = r.querySelector('.floor-name')?.value.trim();
        const mesas = parseInt(r.querySelector('.floor-count')?.value);
        if (nombre && mesas > 0) pisos_config.push({ nombre, mesas });
    });

    if (pisos_config.length === 0) return showAppAlert('Atención', 'Agrega al menos un piso.', 'warning');

    const { error } = await supabase.from('configuracion').upsert({
        local_id: currentLocalId,
        alias_mp,
        mp_access_token,
        slug,
        horarios_semana: scheduleState,
        pisos_config
    }, { onConflict: 'local_id' });

    if (error) showAppAlert('Error', error.message, 'error');
    else {
        showAppAlert('¡Guardado!', 'Configuración actualizada.', 'success');
        document.getElementById('cfg-slug').value = slug;
        const btnMenu = document.getElementById('btn-ver-menu');
        if (btnMenu && slug) btnMenu.href = `index.html?local=${slug}`;
        toggleConfigModal();
    }
}

function initializeDefaultSchedule() {
    DIAS_CLAVE.forEach(d => scheduleState[d] = { activo: true, turnos: [{ inicio: '19:30', fin: '23:30' }] });
}

function create24hInput(timeValue) {
    let [h, m] = (timeValue || '00:00').split(':');
    return `<div class="inline-flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-1.5 shadow-xs"><input type="number" inputmode="numeric" min="0" max="23" value="${(h || '00').padStart(2, '0')}" class="time-h w-9 text-center font-bold text-xs bg-transparent text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-orange-50"><span class="font-bold text-xs text-slate-400">:</span><input type="number" inputmode="numeric" min="0" max="59" value="${(m || '00').padStart(2, '0')}" class="time-m w-9 text-center font-bold text-xs bg-transparent text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-orange-50"><span class="text-[10px] font-bold text-slate-400 pr-1">hs</span></div>`;
}

function renderDaysSchedule() {
    const container = document.getElementById('days-schedule-container');
    if (!container) return;
    container.innerHTML = '';
    DIAS_CLAVE.forEach((dia, idx) => {
        const dayData = scheduleState[dia] || { activo: true, turnos: [{ inicio: '19:30', fin: '23:30' }] };
        const card = document.createElement('div');
        card.className = 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-2xl space-y-2';
        let turnosHtml = '';
        dayData.turnos.forEach((t, tIdx) => turnosHtml += `<div class="flex items-center gap-2 flex-wrap">${create24hInput(t.inicio)}<span class="text-xs text-slate-400 font-semibold">a</span>${create24hInput(t.fin)}<button type="button" data-dia="${dia}" data-tidx="${tIdx}" class="btn-remove-shift p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg ml-auto transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`);
        card.innerHTML = `<div class="flex items-center justify-between"><label class="flex items-center space-x-2 cursor-pointer"><input type="checkbox" data-dia="${dia}" ${dayData.activo ? 'checked' : ''} class="chk-day-active w-4 h-4 text-orange-500 rounded focus:ring-orange-500"><span class="font-bold text-xs uppercase ${dayData.activo ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}">${DIAS_LABEL[idx]}</span></label>${dayData.activo ? `<button type="button" data-dia="${dia}" class="btn-add-shift text-[10px] bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 font-bold px-2.5 py-1 rounded-lg hover:bg-orange-200 transition">+ Turno</button>` : '<span class="text-[10px] text-rose-500 font-bold">Cerrado</span>'}</div>${dayData.activo ? `<div class="space-y-2 pt-1">${turnosHtml}</div>` : ''}`;
        container.appendChild(card);
    });
    container.querySelectorAll('.chk-day-active').forEach(chk => chk.addEventListener('change', (e) => toggleDayActive(e.target.getAttribute('data-dia'), e.target.checked)));
    container.querySelectorAll('.btn-add-shift').forEach(btn => btn.addEventListener('click', (e) => addShift(e.currentTarget.getAttribute('data-dia'))));
    container.querySelectorAll('.btn-remove-shift').forEach(btn => btn.addEventListener('click', (e) => removeShift(e.currentTarget.getAttribute('data-dia'), parseInt(e.currentTarget.getAttribute('data-tidx')))));
    container.querySelectorAll('.time-h, .time-m').forEach(input => {
        input.addEventListener('blur', (e) => { formatPaddedInput(e.target); updateShiftFromElement(e.target); });
        input.addEventListener('change', (e) => updateShiftFromElement(e.target));
    });
    lucide.createIcons();
}

function formatPaddedInput(input) {
    let val = parseInt(input.value);
    const max = parseInt(input.getAttribute('max'));
    if (isNaN(val) || val < 0) val = 0;
    if (val > max) val = max;
    input.value = String(val).padStart(2, '0');
}

function updateShiftFromElement(element) {
    const containerRow = element.closest('.flex');
    const btnRemove = containerRow?.querySelector('.btn-remove-shift');
    if (!btnRemove) return;
    const dia = btnRemove.getAttribute('data-dia'), index = parseInt(btnRemove.getAttribute('data-tidx'));
    const flexParent = element.closest('.inline-flex'), allFlex = Array.from(containerRow.querySelectorAll('.inline-flex'));
    const field = allFlex.indexOf(flexParent) === 0 ? 'inicio' : 'fin';
    let h = String(Math.min(23, Math.max(0, parseInt(flexParent.querySelector('.time-h').value) || 0))).padStart(2, '0');
    let m = String(Math.min(59, Math.max(0, parseInt(flexParent.querySelector('.time-m').value) || 0))).padStart(2, '0');
    if (scheduleState[dia] && scheduleState[dia].turnos[index]) scheduleState[dia].turnos[index][field] = `${h}:${m}`;
}

function toggleDayActive(dia, isChecked) {
    if (!scheduleState[dia]) scheduleState[dia] = { activo: true, turnos: [] };
    scheduleState[dia].activo = isChecked;
    if (isChecked && scheduleState[dia].turnos.length === 0) scheduleState[dia].turnos = [{ inicio: '19:30', fin: '23:30' }];
    renderDaysSchedule();
}

function addShift(dia) { scheduleState[dia].turnos.push({ inicio: '20:00', fin: '00:00' }); renderDaysSchedule(); }
function removeShift(dia, index) { scheduleState[dia].turnos.splice(index, 1); renderDaysSchedule(); }

function addFloorRow(name = '', count = 6) {
    const container = document.getElementById('floors-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 floor-row bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700';
    row.innerHTML = `<input type="text" value="${name}" required class="floor-name flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"><input type="number" value="${count}" min="1" max="100" required class="floor-count w-20 p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-center text-orange-500"><span class="text-[10px] font-bold text-slate-400">mesas</span><button type="button" class="btn-remove-floor p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;
    row.querySelector('.btn-remove-floor')?.addEventListener('click', () => row.remove());
    container.appendChild(row);
    lucide.createIcons();
}

async function loadUsers() {
    const { data: users } = await supabase.from('admins').select('*').eq('local_id', currentLocalId).order('id', { ascending: true });
    const tbody = document.getElementById('partners-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (users) {
        users.forEach(a => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition';
            const isMe = a.email === currentUserEmail;
            const roleBadge = a.rol === 'admin' ? '<span class="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Admin</span>' : '<span class="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Empleado</span>';
            tr.innerHTML = `<td class="p-2 font-semibold">${a.email} ${isMe ? '<span class="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold ml-1">(Vos)</span>' : ''}</td><td class="p-2">${roleBadge}</td><td class="p-2 text-right">${!isMe ? `<button data-id="${a.id}" data-email="${a.email}" class="btn-remove-user p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold text-xs">Revocar</button>` : '<span class="text-xs text-slate-400 italic">Activo</span>'}</td>`;
            tbody.appendChild(tr);
        });
        tbody.querySelectorAll('.btn-remove-user').forEach(btn => btn.addEventListener('click', async (e) => await removeUser(e.currentTarget.getAttribute('data-id'), e.currentTarget.getAttribute('data-email'))));
    }
}

async function handleAddUserRole(e) {
    e.preventDefault();
    const email = document.getElementById('user-email').value.trim();
    const rol = document.getElementById('user-role').value;
    const { error } = await supabase.from('admins').insert([{ email, rol, local_id: currentLocalId }]);
    
    if (error) {
        if (error.code === '23505') {
            showAppAlert('Correo ya registrado', 'Este usuario ya se encuentra registrado en el sistema.', 'warning');
        } else {
            showAppAlert('Error', error.message, 'error');
        }
    } else { 
        showAppAlert('Éxito', `Acceso otorgado a ${email}`, 'success'); 
        e.target.reset(); 
        await loadUsers(); 
    }
}

async function removeUser(id, email) {
    const res = await Swal.fire({ title: '¿Revocar?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e11d48', confirmButtonText: 'Sí' });
    if (res.isConfirmed) { await supabase.from('admins').delete().eq('id', id); await loadUsers(); }
}