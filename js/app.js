import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.33.1/+esm'

// Configuración de Supabase
const supabaseUrl = 'TU_URL_DE_SUPABASE';
const supabaseKey = 'TU_LLAVE_ANONIMA_DE_SUPABASE';
const supabase = createClient(supabaseUrl, supabaseKey);

// Estado Global
let currentUser = null;
let currentGroupId = null;
let currentMode = 'personal'; // 'personal' o 'compartido'
let chartInstance = null;
let realtimeSubscription = null;

// Elementos DOM
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const panelsContainer = document.getElementById('panels-container');
const panelGraficos = document.getElementById('panel-graficos');
const authError = document.getElementById('authError');
const userEmailDisplay = document.getElementById('userEmailDisplay');
const groupStatus = document.getElementById('groupStatus');
const groupActions = document.getElementById('groupActions');

// INICIALIZACIÓN
async function initApp() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        showApp();
    } else {
        showAuth();
    }

    // Escuchar cambios de autenticación
    supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
            currentUser = session.user;
            showApp();
        } else {
            currentUser = null;
            currentGroupId = null;
            showAuth();
        }
    });
}

// AUTENTICACIÓN
document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPass').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) showError(error.message);
});

document.getElementById('formRegister').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPass').value;
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) showError(error.message);
    else showError("Registro exitoso. Revisa tu correo o inicia sesión.", true);
});

document.getElementById('btnLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
});

function showError(msg, isSuccess = false) {
    authError.textContent = msg;
    authError.className = `mt-3 text-center ${isSuccess ? 'text-success' : 'text-danger'}`;
    authError.classList.remove('d-none');
}

// NAVEGACIÓN Y VISTAS
function showAuth() {
    authSection.classList.remove('d-none');
    appSection.classList.add('d-none');
    if (realtimeSubscription) supabase.removeChannel(realtimeSubscription);
}

async function showApp() {
    authSection.classList.add('d-none');
    appSection.classList.remove('d-none');
    userEmailDisplay.textContent = currentUser.email;
    
    await checkGroupStatus();
    loadData();
    setupRealtime();
}

// GESTIÓN DE GRUPOS (COMPARTIDO)
async function checkGroupStatus() {
    const { data, error } = await supabase
        .from('Grupo_Miembros')
        .select('grupo_id, Grupos(nombre)')
        .eq('user_id', currentUser.id)
        .limit(1);

    if (data && data.length > 0) {
        currentGroupId = data[0].grupo_id;
        const nombreGrupo = data[0].Grupos.nombre;
        groupStatus.innerHTML = `Grupo Activo: <strong>${nombreGrupo}</strong> <br><small class="text-muted">ID: ${currentGroupId}</small>`;
        groupActions.classList.add('d-none');
    } else {
        currentGroupId = null;
        groupStatus.textContent = 'No estás en ningún grupo compartido. Crea o únete a uno para usar el panel compartido.';
        groupActions.classList.remove('d-none');
    }
}

document.getElementById('btnCreateGroup').addEventListener('click', async () => {
    const nombre = prompt("Nombre del nuevo grupo:");
    if (!nombre) return;
    
    const { data: grupo, error: err1 } = await supabase.from('Grupos').insert([{ nombre }]).select().single();
    if (grupo) {
        await supabase.from('Grupo_Miembros').insert([{ grupo_id: grupo.id, user_id: currentUser.id }]);
        checkGroupStatus();
        loadData();
    }
});

document.getElementById('btnJoinGroup').addEventListener('click', async () => {
    const groupId = document.getElementById('joinGroupId').value;
    if (!groupId) return;
    
    const { error } = await supabase.from('Grupo_Miembros').insert([{ grupo_id: groupId, user_id: currentUser.id }]);
    if (error) alert("Error al unirse. Verifica el ID.");
    else { checkGroupStatus(); loadData(); }
});

// NAVEGACIÓN DE TABS
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        // Remover activos
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        e.target.classList.add('active');

        const target = e.target.getAttribute('data-target');
        
        if (target === 'panel-graficos') {
            panelsContainer.classList.add('d-none');
            panelGraficos.classList.remove('d-none');
            renderChart();
        } else {
            panelGraficos.classList.add('d-none');
            panelsContainer.classList.remove('d-none');
            currentMode = target === 'panel-personal' ? 'personal' : 'compartido';
            document.getElementById('gastosTitle').textContent = currentMode === 'personal' ? 'Gasto Personal' : 'Gasto Compartido';
            document.getElementById('tareasTitle').textContent = currentMode === 'personal' ? 'Tareas Personales' : 'Tareas Compartidas';
            loadData();
        }
    });
});

// DATOS: GASTOS Y TAREAS
async function loadData() {
    cargarGastos();
    cargarTareas();
}

async function cargarGastos() {
    let query = supabase.from('Gastos').select('*').order('creado_en', { ascending: false });
    
    if (currentMode === 'personal') {
        query = query.is('grupo_id', null).eq('user_id', currentUser.id);
    } else {
        if (!currentGroupId) { document.getElementById('listaGastos').innerHTML = '<em>Requiere un grupo</em>'; document.getElementById('totalGastos').textContent='$0'; return; }
        query = query.eq('grupo_id', currentGroupId);
    }

    const { data, error } = await query;
    if (!error && data) {
        let total = 0;
        document.getElementById('listaGastos').innerHTML = data.map(g => {
            total += Number(g.monto);
            return `
            <li class="list-group-item bg-transparent text-white d-flex justify-content-between px-0 align-items-center">
                <div>
                    <span>${g.descripcion}</span>
                </div>
                <div class="d-flex align-items-center">
                    <strong class="text-danger me-3">$${Number(g.monto).toLocaleString('es-CL')}</strong>
                    <button class="btn btn-sm btn-outline-danger py-0 px-2 btn-delete-gasto" data-id="${g.id}">&times;</button>
                </div>
            </li>`
        }).join('');
        document.getElementById('totalGastos').textContent = `$${total.toLocaleString('es-CL')}`;
        
        document.querySelectorAll('.btn-delete-gasto').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if(confirm("¿Eliminar gasto?")) await supabase.from('Gastos').delete().eq('id', id);
            });
        });
    }
}

document.getElementById('formGasto').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (currentMode === 'compartido' && !currentGroupId) return alert("Debes unirte a un grupo primero.");
    
    const desc = document.getElementById('descGasto').value;
    const monto = parseFloat(document.getElementById('montoGasto').value);
    
    const payload = {
        user_id: currentUser.id,
        descripcion: desc,
        monto: monto,
        grupo_id: currentMode === 'personal' ? null : currentGroupId
    };
    
    await supabase.from('Gastos').insert([payload]);
    e.target.reset();
});

async function cargarTareas() {
    let query = supabase.from('Tareas').select('*').order('completada', { ascending: true }).order('creado_en', { ascending: false });
    
    if (currentMode === 'personal') {
        query = query.is('grupo_id', null).eq('user_id', currentUser.id);
    } else {
        if (!currentGroupId) { document.getElementById('listaTareas').innerHTML = '<em>Requiere un grupo</em>'; return; }
        query = query.eq('grupo_id', currentGroupId);
    }

    const { data, error } = await query;
    if (!error && data) {
        document.getElementById('listaTareas').innerHTML = data.map(t => 
            `<li class="list-group-item bg-transparent text-white px-0 d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center w-100">
                    <input class="form-check-input me-3 check-tarea" type="checkbox" data-id="${t.id}" ${t.completada ? 'checked' : ''} style="transform: scale(1.3);">
                    <span style="text-decoration: ${t.completada ? 'line-through' : 'none'}; opacity: ${t.completada ? '0.5' : '1'}">${t.descripcion}</span>
                </div>
                <button class="btn btn-sm btn-outline-danger py-0 px-2 btn-delete-tarea" data-id="${t.id}">&times;</button>
            </li>`
        ).join('');
        
        document.querySelectorAll('.check-tarea').forEach(chk => {
            chk.addEventListener('change', async (e) => {
                const id = e.target.getAttribute('data-id');
                await supabase.from('Tareas').update({ completada: e.target.checked }).eq('id', id);
            });
        });
        
        document.querySelectorAll('.btn-delete-tarea').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                await supabase.from('Tareas').delete().eq('id', id);
            });
        });
    }
}

document.getElementById('formTarea').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (currentMode === 'compartido' && !currentGroupId) return alert("Debes unirte a un grupo primero.");
    
    const desc = document.getElementById('descTarea').value;
    const payload = {
        user_id: currentUser.id,
        descripcion: desc,
        grupo_id: currentMode === 'personal' ? null : currentGroupId
    };
    
    await supabase.from('Tareas').insert([payload]);
    e.target.reset();
});

// GRÁFICOS
async function renderChart() {
    // Traer todos los gastos (personales y del grupo activo si lo hay)
    let queryPers = supabase.from('Gastos').select('monto, creado_en').is('grupo_id', null).eq('user_id', currentUser.id);
    let { data: persData } = await queryPers;
    
    let compData = [];
    if (currentGroupId) {
        let queryComp = supabase.from('Gastos').select('monto, creado_en').eq('grupo_id', currentGroupId);
        let { data } = await queryComp;
        if(data) compData = data;
    }

    const agruparPorMes = (datos) => {
        const meses = {};
        (datos || []).forEach(d => {
            const date = new Date(d.creado_en);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            meses[key] = (meses[key] || 0) + Number(d.monto);
        });
        return meses;
    };

    const persAgrupado = agruparPorMes(persData);
    const compAgrupado = agruparPorMes(compData);
    
    const labels = Array.from(new Set([...Object.keys(persAgrupado), ...Object.keys(compAgrupado)])).sort();
    
    const persVals = labels.map(l => persAgrupado[l] || 0);
    const compVals = labels.map(l => compAgrupado[l] || 0);

    const ctx = document.getElementById('gastosChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Personal', data: persVals, backgroundColor: '#0d6efd' },
                { label: 'Compartido', data: compVals, backgroundColor: '#198754' }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, grid: { color: '#444' } },
                x: { grid: { color: '#444' } }
            },
            plugins: { legend: { labels: { color: '#fff' } } }
        }
    });
}

// REALTIME
function setupRealtime() {
    if (realtimeSubscription) supabase.removeChannel(realtimeSubscription);
    
    realtimeSubscription = supabase.channel('public:db_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'Gastos' }, () => {
            cargarGastos();
            if(!panelGraficos.classList.contains('d-none')) renderChart();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'Tareas' }, () => {
            cargarTareas();
        })
        .subscribe();
}

// START
initApp();
