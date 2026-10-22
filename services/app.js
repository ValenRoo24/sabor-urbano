import { CartService } from './cartService.js';
import { ScheduleService } from './scheduleService.js';
import { PaymentService } from './paymentService.js';
import { supabase } from './supabaseClient.js';

const cartService = new CartService();
const paymentService = new PaymentService();

let productos = [];
let categorias = [];
let negocioConfig = null;
let currentLocalId = null; 

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlValue = urlParams.get('local'); 

  if (!urlValue) {
    Swal.fire({ title: 'Atención', text: 'Ingresaste sin el enlace del local (?local=).', icon: 'warning', confirmButtonColor: '#f97316', customClass: { popup: 'rounded-3xl' } });
    return;
  }

  setupEventListeners();
  cartService.renderCartUI();
  if (window.lucide) lucide.createIcons();

  await checkPaymentReturn();
  await resolveLocalId(urlValue);

  if (currentLocalId) {
    await initConfig();
    await cargarCategoriasYProductos();
  }
});

async function resolveLocalId(value) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(value)) {
        currentLocalId = value;
        return;
    }

    const { data, error } = await supabase
        .from('configuracion')
        .select('local_id')
        .eq('slug', value.toLowerCase())
        .maybeSingle();

    if (data && data.local_id) {
        currentLocalId = data.local_id;
    } else {
        Swal.fire({ title: 'Comercio no encontrado', text: 'El enlace no es válido o el comercio no existe.', icon: 'error', confirmButtonColor: '#f97316', customClass: { popup: 'rounded-3xl' } });
    }
}

async function checkPaymentReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status') || urlParams.get('collection_status');
  const pedidoId = urlParams.get('external_reference');

  if ((status === 'approved' || status === 'success') && pedidoId) {
    try {
      const { error } = await supabase.from('pedidos').update({ estado: 'pendiente' }).eq('id', pedidoId);
      if (!error) {
        cartService.clear();
        window.history.replaceState({}, document.title, window.location.pathname);
        Swal.fire({ title: '¡Pago Acreditado!', text: 'Tu pedido ya está en la cocina.', icon: 'success', confirmButtonColor: '#f97316', customClass: { popup: 'rounded-3xl' } });
      }
    } catch (err) { console.error('Error procesando retorno:', err); }
  }
}

async function initConfig() {
  try {
    const { data, error } = await supabase.from('configuracion').select('*').eq('local_id', currentLocalId).maybeSingle();
    if (error && error.code !== 'PGRST116') return;
    if (data) {
      negocioConfig = data;
      if (data.alias_mp) paymentService.setAlias(data.alias_mp);
      if (data.mp_access_token) paymentService.setAccessToken(data.mp_access_token);
      renderTableOptions();
      if (data.horarios_semana) {
        const scheduleStatus = ScheduleService.evaluateStatus(data.horarios_semana);
        renderClosedBanner(!scheduleStatus.isOpen, scheduleStatus.text);
      }
    }
  } catch (err) { console.error('Error initConfig:', err); }
}

function renderTableOptions() {
  const floorSelect = document.getElementById('input-floor-select');
  const tableSelect = document.getElementById('input-mesa');
  if (!floorSelect || !tableSelect || !negocioConfig) return;

  floorSelect.innerHTML = ''; tableSelect.innerHTML = '';
  const llenarMesas = (cantidad) => {
    tableSelect.innerHTML = '';
    for (let i = 1; i <= cantidad; i++) {
      const opt = document.createElement('option');
      opt.value = i; opt.textContent = `Mesa ${i}`;
      tableSelect.appendChild(opt);
    }
  };

  if (negocioConfig.pisos_config && negocioConfig.pisos_config.length > 0) {
    negocioConfig.pisos_config.forEach((piso, index) => {
      const opt = document.createElement('option');
      opt.value = index; opt.textContent = piso.nombre;
      floorSelect.appendChild(opt);
    });
    floorSelect.addEventListener('change', (e) => llenarMesas(negocioConfig.pisos_config[e.target.value].mesas));
    llenarMesas(negocioConfig.pisos_config[0].mesas);
  } else {
    floorSelect.parentElement.classList.add('hidden');
    llenarMesas(negocioConfig.max_mesas || 15);
  }
}

function renderClosedBanner(isClosed, text) {
  const banner = document.getElementById('closed-banner');
  if (!banner) return;
  if (isClosed) { banner.classList.remove('hidden'); banner.innerText = "Comercio Cerrado - " + (text || 'Consultá horarios.'); } 
  else { banner.classList.add('hidden'); }
}

async function cargarCategoriasYProductos() {
  try {
    const [resCat, resProd] = await Promise.all([
      supabase.from('categorias').select('*').eq('local_id', currentLocalId).order('orden', { ascending: true }),
      supabase.from('productos').select('*').eq('local_id', currentLocalId).eq('disponible', true)
    ]);
    categorias = resCat.data || []; productos = resProd.data || [];
    renderCategoriasButtons(); renderProductos(productos);
  } catch (err) { console.error('Error cargar datos:', err); }
}

function renderCategoriasButtons() {
  document.querySelectorAll('.cat-btn, [data-cat]').forEach(btn => btn.parentNode.replaceChild(btn.cloneNode(true), btn));
  const freshButtons = document.querySelectorAll('.cat-btn, [data-cat]');
  freshButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      freshButtons.forEach(b => { b.classList.remove('bg-orange-500', 'text-white'); b.classList.add('bg-slate-200', 'text-slate-700', 'dark:bg-slate-800', 'dark:text-slate-300'); });
      const currentBtn = e.currentTarget;
      currentBtn.classList.remove('bg-slate-200', 'text-slate-700', 'dark:bg-slate-800', 'dark:text-slate-300');
      currentBtn.classList.add('bg-orange-500', 'text-white');
      const catAttr = currentBtn.getAttribute('data-cat');
      if (catAttr === 'todos') renderProductos(productos);
      else renderProductos(productos.filter(p => String(p.categoria).toLowerCase().trim() === String(catAttr).toLowerCase().trim()));
    });
  });
}

function renderProductos(lista) {
  let container = document.getElementById('products-grid');
  if (!container) {
    container = document.createElement('div'); container.id = 'products-grid'; container.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-8 w-full pb-20';
    const main = document.querySelector('main');
    if (main) main.appendChild(container); else document.body.appendChild(container);
  }
  container.innerHTML = '';

  if (!lista || lista.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400"><i data-lucide="inbox" class="w-12 h-12 mx-auto stroke-1 opacity-40 mb-2"></i><p class="text-sm font-medium mt-3">No hay productos disponibles.</p></div>';
    if (window.lucide) lucide.createIcons();
    return;
  }

  lista.forEach(prod => {
    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col justify-between hover:shadow-md transition';
    card.innerHTML = `<div>${prod.imagen_url ? '<img src="' + prod.imagen_url + '" alt="' + prod.nombre + '" class="w-full h-36 object-cover rounded-xl mb-3">' : ''}<h3 class="font-extrabold text-slate-800 dark:text-slate-100 text-sm mb-1">${prod.nombre}</h3><p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">${prod.descripcion || ''}</p></div><div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/50"><span class="font-black text-slate-800 dark:text-slate-100 text-sm">$${(prod.precio || 0).toLocaleString()}</span><button class="btn-add-cart bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-xl transition flex items-center justify-center" data-id="${prod.id}"><i data-lucide="plus" class="w-4 h-4"></i></button></div>`;
    container.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();

  document.querySelectorAll('.btn-add-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const prod = productos.find(p => String(p.id) === String(e.currentTarget.getAttribute('data-id')));
      if (prod) cartService.addItem(prod);
    });
  });
}

function setupEventListeners() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn && (btn.id === 'btn-checkout' || (btn.innerText && btn.innerText.includes('Enviar Pedido a Cocina')))) {
      e.preventDefault(); handleCheckoutProcess();
    }
  });

  const chkPickup = document.getElementById('chk-pickup'), addressContainer = document.getElementById('address-inputs-container');
  if (chkPickup && addressContainer) {
    chkPickup.addEventListener('change', (e) => e.target.checked ? addressContainer.classList.add('hidden') : addressContainer.classList.remove('hidden'));
  }

  const welcomeModal = document.getElementById('welcome-modal'), formMesaContainer = document.getElementById('form-mesa-container');
  const btnHeaderMesa = document.getElementById('current-mode-label')?.closest('button');
  
  if (btnHeaderMesa && welcomeModal) btnHeaderMesa.addEventListener('click', (e) => { e.preventDefault(); welcomeModal.classList.remove('hidden'); welcomeModal.style.display = ''; });
  
  if (welcomeModal) {
    welcomeModal.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const btnText = btn.innerText || '';

      if (btnText.includes('Pedido a Domicilio') || btnText.includes('Retiro')) {
        document.getElementById('field-address')?.classList.remove('hidden');
        document.getElementById('field-table')?.classList.add('hidden');
        if (document.getElementById('current-mode-label')) { document.getElementById('current-mode-label').innerText = 'Delivery / Retiro'; document.getElementById('current-mode-label').classList.remove('hidden', 'md:inline'); }
        if (document.getElementById('mode-badge')) document.getElementById('mode-badge').innerText = 'Delivery / Retiro';
        welcomeModal.classList.add('hidden'); welcomeModal.style.display = ''; 
      } 
      else if (btnText.includes('Comer en el Local')) {
        if (formMesaContainer) { formMesaContainer.classList.remove('hidden'); document.getElementById('input-mesa')?.focus(); } 
        else { welcomeModal.classList.add('hidden'); welcomeModal.style.display = ''; }
      }
      else if (btnText.includes('Confirmar')) {
        const mesaValue = document.getElementById('input-mesa')?.value || '';
        const floorSelect = document.getElementById('input-floor-select');
        let pisoText = (floorSelect && !floorSelect.parentElement.classList.contains('hidden')) ? floorSelect.options[floorSelect.selectedIndex].text + ' - ' : '';
        const mesaCompleta = pisoText + (mesaValue ? 'Mesa ' + mesaValue : '');
        
        if (document.getElementById('order-table') && document.getElementById('field-table')) { document.getElementById('order-table').value = mesaCompleta; document.getElementById('field-table').classList.remove('hidden'); }
        document.getElementById('field-address')?.classList.add('hidden');
        if (document.getElementById('current-mode-label')) { document.getElementById('current-mode-label').innerText = mesaCompleta; document.getElementById('current-mode-label').classList.remove('hidden', 'md:inline'); }
        if (document.getElementById('mode-badge')) document.getElementById('mode-badge').innerText = 'Comer en el Local';
        welcomeModal.classList.add('hidden'); welcomeModal.style.display = '';
      }
    });
  }
}

async function handleCheckoutProcess() {
  if (!currentLocalId) return Swal.fire({ title: 'Error', text: 'Falta configurar el local.', icon: 'error', confirmButtonColor: '#f97316', customClass: { popup: 'rounded-3xl' } });

  const items = cartService.getItems();
  if (!items || items.length === 0) return Swal.fire({ title: 'Carrito Vacío', text: 'Agregá productos.', icon: 'info', confirmButtonColor: '#f97316', customClass: { popup: 'rounded-3xl' } });

  let medioPago = 'Efectivo', esMercadoPago = false;
  document.querySelectorAll('select').forEach(sel => { if (sel.selectedIndex >= 0) { const text = sel.options[sel.selectedIndex].text.toLowerCase(); if (text.includes('mercado') || text.includes('tarjeta')) { esMercadoPago = true; medioPago = 'Mercado Pago'; } } });

  let direccion = 'Retira en local', clienteNombre = 'Consumidor Final'; 
  const chkPickup = document.getElementById('chk-pickup'), inputStreet = document.getElementById('order-street');
  if (document.getElementById('field-address') && !document.getElementById('field-address').classList.contains('hidden') && chkPickup && !chkPickup.checked) {
      if (inputStreet && inputStreet.value.trim() !== '') {
          direccion = inputStreet.value.trim() + (document.getElementById('order-floor')?.value ? ` (Piso: ${document.getElementById('order-floor').value})` : '') + (document.getElementById('order-notes')?.value ? ` - Nota: ${document.getElementById('order-notes').value}` : '');
      } else {
          restaurarBotones();
          return Swal.fire({ title: 'Faltan Datos', text: 'Ingresá la calle de envío.', icon: 'warning', confirmButtonColor: '#f97316', customClass: { popup: 'rounded-3xl' } });
      }
  }

  let mesaFinal = document.getElementById('order-table')?.value || '';
  const detalleStr = items.map(i => i.cantidad + "x " + i.nombre).join(', '), total = cartService.getTotal();

  document.querySelectorAll('button').forEach(b => { if (b.innerText && b.innerText.includes('Enviar Pedido a Cocina')) { b.innerText = 'Procesando...'; b.disabled = true; } });
  const esLocal = window.location.href.includes('127.0.0.1') || window.location.href.includes('localhost');

  try {
    const { data: pedidoGuardado, error } = await supabase.from('pedidos').insert([{ local_id: currentLocalId, cliente_nombre: clienteNombre, direccion, mesa: mesaFinal, medio_pago: medioPago, detalle: detalleStr, total, estado: (esMercadoPago && !esLocal) ? 'pendiente_pago' : 'pendiente', items }]).select().single();
    if (error) throw error;

    if (esMercadoPago) {
      const preferencia = await paymentService.crearPreferenciaMercadoPago(pedidoGuardado);
      if (esLocal) cartService.clear(); 
      window.location.href = preferencia.sandbox_init_point || preferencia.init_point;
    } else {
      cartService.clear();
      Swal.fire({ title: '¡Pedido Confirmado!', text: 'Enviado a la cocina.', icon: 'success', confirmButtonColor: '#f97316', customClass: { popup: 'rounded-3xl' } }).then(() => location.reload());
    }
  } catch (err) {
    restaurarBotones();
    Swal.fire({ title: 'Error', text: 'Ocurrió un error al procesar.', icon: 'error', confirmButtonColor: '#f97316', customClass: { popup: 'rounded-3xl' } });
  }
}

function restaurarBotones() { document.querySelectorAll('button').forEach(b => { if (b.innerText && b.innerText.includes('Procesando...')) { b.innerText = 'Enviar Pedido a Cocina'; b.disabled = false; } }); }