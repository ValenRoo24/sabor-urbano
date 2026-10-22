import { supabase } from './supabaseClient.js';
import { AuthService } from './authService.js';

let currentUserEmail = '';
let currentLocalId = null;
let realtimeChannel = null;

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    try {
        const session = await AuthService.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }

        currentUserEmail = session.user.email;
        const { data: userData, error: userErr } = await supabase
            .from('admins')
            .select('rol, local_id')
            .eq('email', currentUserEmail)
            .single();

        if (userErr || !userData) {
            window.location.href = 'login.html';
            return;
        }

        currentLocalId = userData.local_id;

        // 1. Cargar solo pedidos confirmados/pagados al entrar
        await loadOrders();

        // 2. Escuchar pedidos confirmados en TIEMPO REAL
        setupRealtimeSubscription();

        // 3. Respaldo automático cada 15 segundos
        setInterval(() => {
            loadOrders();
        }, 15000);

        setupEventListeners();
    } catch (err) {
        console.error('Error al inicializar comandera:', err);
    }
});

function setupEventListeners() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
        await AuthService.logout();
        window.location.href = 'login.html';
    });
}

function playNewOrderSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); 
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); 
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
        console.log('Audio Context no disponible aún.');
    }
}

function setupRealtimeSubscription() {
    if (!currentLocalId) return;

    realtimeChannel = supabase
        .channel(`comandera-${currentLocalId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'pedidos',
                filter: `local_id=eq.${currentLocalId}`
            },
            async (payload) => {
                const newStatus = payload.new?.estado;
                const oldStatus = payload.old?.estado;

                // Sonar alarma solo si se crea un pedido confirmado en efectivo 
                // o si un pedido en 'pendiente_pago' (Mercado Pago) pasa a 'pendiente' (pago aprobado)
                const isNewCashOrder = payload.eventType === 'INSERT' && newStatus === 'pendiente';
                const isApprovedMPOrder = payload.eventType === 'UPDATE' && oldStatus === 'pendiente_pago' && newStatus === 'pendiente';

                if (isNewCashOrder || isApprovedMPOrder) {
                    playNewOrderSound();
                }

                await loadOrders();
            }
        )
        .subscribe();
}

async function loadOrders() {
    if (!currentLocalId) return;

    // Se filtran los pedidos para ignorar 'pendiente_pago' y 'entregado'
    const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select('*')
        .eq('local_id', currentLocalId)
        .in('estado', ['pendiente', 'en_preparacion', 'listo'])
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error al cargar pedidos:', error);
        return;
    }

    renderOrders(pedidos || []);
}

function renderOrders(pedidos) {
    const container = document.getElementById('pedidos-container');
    if (!container) return;

    container.innerHTML = '';

    if (pedidos.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 text-slate-400">
                <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                <p class="font-bold text-sm">No hay pedidos pendientes por el momento.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    pedidos.forEach(p => {
        const card = document.createElement('div');
        const isPendiente = p.estado === 'pendiente';
        const isEnPreparacion = p.estado === 'en_preparacion';
        const isListo = p.estado === 'listo';

        let statusColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
        if (isEnPreparacion) statusColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        if (isListo) statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

        const fechaObj = new Date(p.created_at);
        const horaStr = fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let itemsHtml = '';
        if (Array.isArray(p.items)) {
            p.items.forEach(item => {
                itemsHtml += `
                    <div class="flex justify-between items-center text-xs py-1 border-b border-slate-700/50 last:border-0">
                        <span class="font-bold text-slate-200"><span class="text-orange-400 font-extrabold mr-1.5">${item.cantidad}x</span> ${item.nombre}</span>
                        <span class="text-slate-400 font-mono">$${(item.precio * item.cantidad).toLocaleString()}</span>
                    </div>
                `;
            });
        }

        const medioPagoBadge = p.metodo_pago === 'mp' 
            ? '<span class="text-[9px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-md font-bold uppercase ml-1">MP Pagado</span>'
            : '<span class="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md font-bold uppercase ml-1">Efectivo</span>';

        card.className = `bg-slate-800 border ${isPendiente ? 'border-orange-500 shadow-lg shadow-orange-500/10' : 'border-slate-700'} rounded-2xl p-4 space-y-3 flex flex-col justify-between`;
        card.innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="flex items-center">
                            <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pedido #${p.id}</span>
                            ${medioPagoBadge}
                        </div>
                        <h3 class="font-bold text-sm text-slate-100">${p.nombre_cliente || 'Cliente'}</h3>
                        <p class="text-xs text-slate-400 font-medium">${p.tipo_entrega === 'mesa' ? `Mesa N° ${p.mesa_numero || '-'}` : 'Delivery / Takeaway'}</p>
                    </div>
                    <div class="text-right">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${statusColor} uppercase">${p.estado || 'pendiente'}</span>
                        <p class="text-[11px] font-bold text-slate-400 mt-1">${horaStr} hs</p>
                    </div>
                </div>

                <div class="bg-slate-900/60 rounded-xl p-3 space-y-1">
                    ${itemsHtml}
                </div>

                ${p.notas ? `<div class="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs p-2 rounded-xl italic"><strong>Nota:</strong> ${p.notas}</div>` : ''}
            </div>

            <div class="pt-2 border-t border-slate-700/60 flex justify-between items-center gap-2">
                <span class="font-extrabold text-sm text-orange-400">$${(p.total || 0).toLocaleString()}</span>
                <div class="flex gap-1.5">
                    ${isPendiente ? `<button data-id="${p.id}" data-estado="en_preparacion" class="btn-change-status px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition">Cocinar</button>` : ''}
                    ${isEnPreparacion ? `<button data-id="${p.id}" data-estado="listo" class="btn-change-status px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition">Listo</button>` : ''}
                    ${isListo ? `<button data-id="${p.id}" data-estado="entregado" class="btn-change-status px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-xs rounded-xl transition">Archivar</button>` : ''}
                </div>
            </div>
        `;

        container.appendChild(card);
    });

    container.querySelectorAll('.btn-change-status').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const nuevoEstado = e.currentTarget.getAttribute('data-estado');
            await changeOrderStatus(id, nuevoEstado);
        });
    });

    lucide.createIcons();
}

async function changeOrderStatus(id, nuevoEstado) {
    const { error } = await supabase
        .from('pedidos')
        .update({ estado: nuevoEstado })
        .eq('id', id);

    if (error) {
        console.error('Error cambiando estado:', error);
    } else {
        await loadOrders();
    }
}