import { supabase } from './supabaseClient.js';
import { AuthService } from './authService.js';

let orders = [];
let currentLocalId = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const session = await AuthService.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }

        const currentUserEmail = session.user.email;
        
        const { data: userData, error: userErr } = await supabase
            .from('admins')
            .select('rol, local_id')
            .eq('email', currentUserEmail)
            .single();

        if (userErr || !userData) {
            alert('Tu usuario no tiene permisos o no existe.');
            window.location.href = 'login.html';
            return;
        }

        if (!userData.local_id) {
            alert('Tu cuenta no está vinculada a ningún local.');
            return;
        }

        currentLocalId = userData.local_id;

        if (window.lucide) lucide.createIcons();

        initRealtimeOrders();
        await fetchOrders();
        setupEventListeners();
    } catch (error) {
        console.error('Error al inicializar la comandera:', error);
    }
});

function setupEventListeners() {
    const filterSelect = document.getElementById('filter-status');
    if (filterSelect) {
        filterSelect.addEventListener('change', renderOrders);
    }
}

function initRealtimeOrders() {
    supabase
        .channel('public:pedidos')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
            if (payload.new && payload.new.estado === 'pendiente_pago') {
                return;
            }
            fetchOrders();
        })
        .subscribe();
}

async function fetchOrders() {
    const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .eq('local_id', currentLocalId)
        .neq('estado', 'pendiente_pago')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error al obtener los pedidos:', error.message);
        return;
    }

    orders = data || [];
    renderOrders();
}

function renderOrders() {
    const container = document.getElementById('orders-container');
    if (!container) return;

    const filterStatus = document.getElementById('filter-status')?.value || 'todos';

    const filtered = filterStatus === 'todos' 
        ? orders 
        : orders.filter(o => o.estado === filterStatus);

    container.innerHTML = '';

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 text-slate-400">
                <i data-lucide="inbox" class="w-12 h-12 mx-auto stroke-1 opacity-40 mb-2"></i>
                <p class="text-sm font-medium">No hay comandas activas en esta categoría</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    filtered.forEach(order => {
        const card = document.createElement('div');
        card.className = `bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col justify-between transition-all`;

        const badgeColor = getStatusBadgeClass(order.estado);

        card.innerHTML = `
            <div class="space-y-4">
                <div class="flex justify-between items-start border-b border-slate-100 dark:border-slate-700/50 pb-3">
                    <div>
                        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Comanda #${order.id}</span>
                        <h3 class="font-extrabold text-base text-slate-800 dark:text-slate-100">${order.mesa ? order.mesa : 'Delivery / Retiro'}</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400">${new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs</p>
                    </div>
                    <span class="px-2.5 py-1 text-xs font-bold rounded-full ${badgeColor}">
                        ${order.estado ? order.estado.toUpperCase() : 'PENDIENTE'}
                    </span>
                </div>

                <div class="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <p><strong class="text-slate-700 dark:text-slate-200">Detalle:</strong></p>
                    <div class="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 font-mono text-xs leading-relaxed whitespace-pre-line">
                        ${order.detalle || 'Sin detalles'}
                    </div>
                    ${order.direccion ? `<p class="mt-2"><strong>Dirección:</strong> ${order.direccion}</p>` : ''}
                    <p class="mt-1"><strong>Medio de Pago:</strong> <span class="font-semibold text-orange-600 dark:text-orange-400">${order.medio_pago || 'No especificado'}</span></p>
                    <p class="text-sm font-black text-slate-800 dark:text-slate-100 pt-1">Total: $${(order.total || 0).toLocaleString()}</p>
                </div>
            </div>

            <div class="pt-4 mt-2 border-t border-slate-100 dark:border-slate-700/50 flex gap-2">
                ${renderStatusButtons(order)}
            </div>
        `;

        container.appendChild(card);
    });

    attachCardButtonListeners();
    if (window.lucide) lucide.createIcons();
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'pendiente':
            return 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400';
        case 'preparacion':
        case 'en preparacion':
            return 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400';
        case 'listo':
            return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400';
        case 'entregado':
            return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
        case 'cancelado':
            return 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400';
        default:
            return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    }
}

function renderStatusButtons(order) {
    const status = order.estado || 'pendiente';

    if (status === 'pendiente') {
        return `
            <button data-id="${order.id}" data-status="preparacion" class="btn-change-status flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-xl text-xs transition">
                Marcar En Preparación
            </button>
            <button data-id="${order.id}" data-status="cancelado" class="btn-change-status bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-400 font-bold py-2 px-3 rounded-xl text-xs transition">
                Cancelar
            </button>
        `;
    }

    if (status === 'preparacion' || status === 'en preparacion') {
        return `
            <button data-id="${order.id}" data-status="listo" class="btn-change-status flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-xl text-xs transition">
                Marcar Listo
            </button>
        `;
    }

    if (status === 'listo') {
        return `
            <button data-id="${order.id}" data-status="entregado" class="btn-change-status flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold py-2 px-3 rounded-xl text-xs transition">
                Entregar Pedido
            </button>
        `;
    }

    return `<span class="text-xs text-slate-400 font-medium italic">Pedido ${status}</span>`;
}

function attachCardButtonListeners() {
    document.querySelectorAll('.btn-change-status').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = e.target.getAttribute('data-id');
            const newStatus = e.target.getAttribute('data-status');

            if (!orderId || !newStatus) return;

            const { error } = await supabase
                .from('pedidos')
                .update({ estado: newStatus })
                .eq('id', orderId);

            if (error) {
                console.error('Error al actualizar el estado:', error.message);
                alert('No se pudo actualizar el estado del pedido');
                return;
            }

            fetchOrders();
        });
    });
}