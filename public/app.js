const state = {
  user: null,
  matches: [],
  myPredictions: {
    matches: [],
    preliminary: {}
  },
  adminUsers: [],
  options: {
    equipos: [],
    fases: []
  },
  adminPredictions: {
    matches: [],
    users: []
  },
  publicContent: {
    premios: [],
    noticias: []
  },
  adminContent: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderOptions(options, selectedValue, placeholder = 'Seleccionar') {
  const selected = String(selectedValue || '');

  return `
    <option value="">${escapeHTML(placeholder)}</option>
    ${options.map(option => `
      <option value="${escapeHTML(option)}" ${option === selected ? 'selected' : ''}>${escapeHTML(option)}</option>
    `).join('')}
  `;
}

function predictionText(prediction) {
  if (!prediction || prediction.golesA === null || prediction.golesA === undefined || prediction.golesB === null || prediction.golesB === undefined) {
    return '-';
  }

  return `${prediction.golesA}-${prediction.golesB}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    credentials: 'same-origin',
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Ocurrió un error inesperado.');
  }

  return data;
}

function showMessage(message, type = 'info', section = 'global') {
  const target = section === 'global'
    ? $('#globalMessage')
    : $(`#${section}Message`);

  const el = target || $('#globalMessage');
  el.textContent = message;
  el.className = `message ${type}`;
  el.style.display = 'block';

  setTimeout(() => {
    el.style.display = 'none';
  }, 4500);
}

function showSection(section) {
  $$('.section').forEach(el => el.classList.add('hidden'));
  $(`#${section}Section`)?.classList.remove('hidden');

  $$('.nav button').forEach(btn => btn.classList.remove('active'));
  $(`[data-section="${section}"]`)?.classList.add('active');

  if (section === 'home') loadHomeContent();
  if (section === 'prode') loadProde();
  if (section === 'ranking') loadRanking();
  if (section === 'admin') loadAdmin();
}

function updateNav() {
  const isLogged = Boolean(state.user);
  const isAdmin = Boolean(state.user?.esAdmin);

  $$('.auth-only').forEach(el => el.classList.toggle('hidden', !isLogged));
  $$('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));

  $('#btnLogin').classList.toggle('hidden', isLogged);
  $('#btnRegister').classList.toggle('hidden', isLogged);
  $('#logoutBtn').classList.toggle('hidden', !isLogged);

  $('#sessionInfo').textContent = isLogged
    ? `Sesión iniciada como ${state.user.usuario}${isAdmin ? ' · Administrador' : ''}`
    : '';
}

async function refreshSession() {
  const data = await api('/api/me');
  state.user = data.user;
  updateNav();
}


// ==================== INICIO: PREMIOS Y NOTICIAS ====================

function renderPublicItems(items, emptyText) {
  if (!items || !items.length) {
    return `<div class="empty-public-item">${escapeHTML(emptyText)}</div>`;
  }

  return items.map(item => `
    <article class="public-item">
      <h3>${escapeHTML(item.titulo)}</h3>
      ${item.cuerpo ? `<p>${escapeHTML(item.cuerpo).replaceAll('\n', '<br>')}</p>` : ''}
    </article>
  `).join('');
}

async function loadHomeContent() {
  try {
    const data = await api('/api/public-content');
    state.publicContent = data;

    const premiosEl = $('#homePremios');
    const noticiasEl = $('#homeNoticias');

    if (premiosEl) {
      premiosEl.innerHTML = renderPublicItems(data.premios, 'Todavía no hay premios publicados.');
    }

    if (noticiasEl) {
      noticiasEl.innerHTML = renderPublicItems(data.noticias, 'Todavía no hay noticias publicadas.');
    }
  } catch (error) {
    const premiosEl = $('#homePremios');
    const noticiasEl = $('#homeNoticias');

    if (premiosEl) premiosEl.innerHTML = '<div class="empty-public-item">No se pudieron cargar los premios.</div>';
    if (noticiasEl) noticiasEl.innerHTML = '<div class="empty-public-item">No se pudieron cargar las noticias.</div>';
  }
}

// ==================== AUTH ====================

async function handleLogin(event) {
  event.preventDefault();

  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        usuario: $('#loginUsuario').value.trim(),
        password: $('#loginPassword').value
      })
    });

    state.user = data.user;
    updateNav();
    $('#loginForm').reset();
    showMessage(`¡Bienvenido ${state.user.usuario}!`, 'success');
    showSection('home');
  } catch (error) {
    showMessage(error.message, 'error', 'login');
  }
}

async function handleRegister(event) {
  event.preventDefault();

  try {
    await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({
        usuario: $('#regUsuario').value.trim(),
        email: $('#regEmail').value.trim(),
        password: $('#regPassword').value
      })
    });

    $('#registerForm').reset();
    showMessage('Usuario registrado correctamente. Ya puede iniciar sesión.', 'success', 'register');
    showSection('login');
  } catch (error) {
    showMessage(error.message, 'error', 'register');
  }
}

async function logout() {
  if (!confirm('¿Cerrar sesión?')) return;

  await api('/api/logout', { method: 'POST' });
  state.user = null;
  updateNav();
  showMessage('Sesión cerrada.', 'success');
  showSection('home');
}

// ==================== PRODE ====================

function getPredictionForMatch(matchId) {
  return state.myPredictions.matches.find(p => Number(p.matchId) === Number(matchId)) || {};
}

function renderPreliminaryForm() {
  const p = state.myPredictions.preliminary || {};
  const equipos = state.options.equipos || [];
  const fases = state.options.fases || [];

  return `
    <div class="prediction-section previa">
      <h2>📋 a) Pronósticos previos al inicio del torneo</h2>
      <div class="grid-2">
        <div class="form-group">
          <label for="campeon">🏆 Campeón del Mundial</label>
          <select id="campeon">
            ${renderOptions(equipos, p.campeon, 'Seleccionar campeón')}
          </select>
        </div>

        <div class="form-group">
          <label for="subcampeon">🥈 Subcampeón del Mundial</label>
          <select id="subcampeon">
            ${renderOptions(equipos, p.subcampeon, 'Seleccionar subcampeón')}
          </select>
        </div>

        <div class="form-group">
          <label for="semi1">🏅 Semifinalista 1</label>
          <select id="semi1">
            ${renderOptions(equipos, (p.semifinalistas || '').split(',')[0]?.trim(), 'Seleccionar semifinalista')}
          </select>
        </div>

        <div class="form-group">
          <label for="semi2">🏅 Semifinalista 2</label>
          <select id="semi2">
            ${renderOptions(equipos, (p.semifinalistas || '').split(',')[1]?.trim(), 'Seleccionar semifinalista')}
          </select>
        </div>

        <div class="form-group">
          <label for="semi3">🏅 Semifinalista 3</label>
          <select id="semi3">
            ${renderOptions(equipos, (p.semifinalistas || '').split(',')[2]?.trim(), 'Seleccionar semifinalista')}
          </select>
        </div>

        <div class="form-group">
          <label for="semi4">🏅 Semifinalista 4</label>
          <select id="semi4">
            ${renderOptions(equipos, (p.semifinalistas || '').split(',')[3]?.trim(), 'Seleccionar semifinalista')}
          </select>
        </div>

        <div class="form-group">
          <label for="instanciaArgentina">🇦🇷 Instancia a la que llegará Argentina</label>
          <select id="instanciaArgentina">
            ${renderOptions(fases, p.instanciaArgentina, 'Seleccionar instancia')}
          </select>
        </div>
      </div>
    </div>
  `;
}

function renderMatchesForm() {
  const groupedByDate = {};

  for (const match of state.matches) {
    if (!groupedByDate[match.fechaTexto]) {
      groupedByDate[match.fechaTexto] = [];
    }
    groupedByDate[match.fechaTexto].push(match);
  }

  const daysHtml = Object.entries(groupedByDate).map(([date, matches]) => `
    <div class="match-day">
      <h3>📅 ${escapeHTML(date)}</h3>
      <div class="grid-2">
        ${matches.map(match => {
          const pred = getPredictionForMatch(match.id);
          const locked = !match.editable;
          return `
            <div class="match-card ${locked ? 'locked' : ''}">
              <div class="match-title">
                <div>
                  <strong>${escapeHTML(match.equipoA)}</strong> vs <strong>${escapeHTML(match.equipoB)}</strong>
                  <div>Grupo ${escapeHTML(match.grupo)} · 🕐 ${escapeHTML(match.hora)}</div>
                </div>
                <span class="badge ${locked ? 'bloqueado' : 'activo'}">${locked ? 'Bloqueado' : 'Editable'}</span>
              </div>

              <div class="score-inputs">
                <input class="score-input" type="number" min="0" max="20"
                  id="golA_${match.id}" data-match-id="${match.id}"
                  value="${pred.golesA ?? ''}" ${locked ? 'disabled' : ''}>
                <strong>-</strong>
                <input class="score-input" type="number" min="0" max="20"
                  id="golB_${match.id}" data-match-id="${match.id}"
                  value="${pred.golesB ?? ''}" ${locked ? 'disabled' : ''}>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');

  return `
    <div class="prediction-section grupos">
      <h2>⚽ b) Pronósticos de fase de grupos</h2>
      <p><strong>Incluye:</strong> partidos de Argentina y partidos destacados definidos por la organización.</p>
      ${daysHtml}
    </div>
  `;
}

async function loadProde() {
  if (!state.user) {
    showSection('login');
    return;
  }

  try {
    const [matches, predictions, options] = await Promise.all([
      api('/api/matches'),
      api('/api/predictions/my'),
      api('/api/options')
    ]);

    state.matches = matches;
    state.myPredictions = predictions;
    state.options = options;

    $('#partidosList').innerHTML = `
      ${renderPreliminaryForm()}
      ${renderMatchesForm()}
    `;
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

function readScoreInput(id) {
  const value = $(id)?.value;

  if (value === '') return null;

  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 20) {
    throw new Error('Los goles deben ser números enteros entre 0 y 20.');
  }

  return number;
}

async function savePredictions() {
  try {
    const matchPredictions = [];

    for (const match of state.matches) {
      if (!match.editable) continue;

      const golesA = readScoreInput(`#golA_${match.id}`);
      const golesB = readScoreInput(`#golB_${match.id}`);

      if (golesA === null && golesB === null) continue;
      if (golesA === null || golesB === null) {
        throw new Error(`Falta completar un resultado en ${match.equipoA} vs ${match.equipoB}.`);
      }

      matchPredictions.push({
        matchId: match.id,
        golesA,
        golesB
      });
    }

    const result = await api('/api/predictions/my', {
      method: 'PUT',
      body: JSON.stringify({
        preliminary: {
          campeon: $('#campeon').value,
          subcampeon: $('#subcampeon').value,
          semifinalistas: [$('#semi1').value, $('#semi2').value, $('#semi3').value, $('#semi4').value].filter(Boolean).join(', '),
          instanciaArgentina: $('#instanciaArgentina').value
        },
        matches: matchPredictions
      })
    });

    showMessage(`Predicciones guardadas. Partidos guardados: ${result.saved}. Bloqueados: ${result.blocked}.`, 'success', 'prode');
    await loadProde();
  } catch (error) {
    showMessage(error.message, 'error', 'prode');
  }
}

// ==================== RANKING ====================

async function loadRanking() {
  try {
    const ranking = await api('/api/ranking');

    if (!ranking.length) {
      $('#rankingList').innerHTML = '<p>Todavía no hay participantes registrados.</p>';
      return;
    }

    $('#rankingList').innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Posición</th>
              <th>Usuario</th>
              <th>Puntaje</th>
              <th>Exactos</th>
              <th>Aciertos parciales</th>
            </tr>
          </thead>
          <tbody>
            ${ranking.map((row, index) => {
              const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
              return `
                <tr>
                  <td>${medal} ${index + 1}</td>
                  <td><strong>${escapeHTML(row.usuario)}</strong></td>
                  <td><strong>${row.puntos} pts</strong></td>
                  <td>${row.exactos}</td>
                  <td>${row.aciertosParciales}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// ==================== ADMIN ====================

function showAdminTab(tab) {
  $$('.admin-content').forEach(el => el.classList.remove('active'));
  $$('.admin-tabs button').forEach(el => el.classList.remove('active'));

  $(`#${tab}Tab`).classList.add('active');
  $(`[data-admin-tab="${tab}"]`).classList.add('active');

  if (tab === 'resultados') loadAdminResults();
  if (tab === 'usuarios') loadAdminUsers();
  if (tab === 'estadisticas') loadAdminStats();
  if (tab === 'pronosticos') loadAdminPredictions();
  if (tab === 'publicaciones') loadAdminContent();
}

async function loadAdmin() {
  if (!state.user?.esAdmin) {
    showMessage('No tenés permisos de administrador.', 'error');
    showSection('home');
    return;
  }

  showAdminTab('resultados');
}

async function loadAdminResults() {
  try {
    const [matches, results, options] = await Promise.all([
      api('/api/matches'),
      api('/api/admin/results'),
      api('/api/options')
    ]);

    state.matches = matches;
    state.options = options;
    const matchResults = results.matches || [];
    const tournament = results.tournament || {};

    const getResult = (matchId) => matchResults.find(r => Number(r.matchId) === Number(matchId)) || {};

    $('#resultadosReales').innerHTML = `
      <div class="panel-card">
        <h4>Resultados finales del torneo</h4>
        <div class="grid-2">
          <div class="form-group">
            <label for="realCampeon">🏆 Campeón</label>
            <select id="realCampeon">${renderOptions(state.options.equipos, tournament.campeon, 'Seleccionar campeón')}</select>
          </div>
          <div class="form-group">
            <label for="realSubcampeon">🥈 Subcampeón</label>
            <select id="realSubcampeon">${renderOptions(state.options.equipos, tournament.subcampeon, 'Seleccionar subcampeón')}</select>
          </div>
          <div class="form-group">
            <label for="realSemi1">🏅 Semifinalista 1</label>
            <select id="realSemi1">${renderOptions(state.options.equipos, (tournament.semifinalistas || '').split(',')[0]?.trim(), 'Seleccionar semifinalista')}</select>
          </div>
          <div class="form-group">
            <label for="realSemi2">🏅 Semifinalista 2</label>
            <select id="realSemi2">${renderOptions(state.options.equipos, (tournament.semifinalistas || '').split(',')[1]?.trim(), 'Seleccionar semifinalista')}</select>
          </div>
          <div class="form-group">
            <label for="realSemi3">🏅 Semifinalista 3</label>
            <select id="realSemi3">${renderOptions(state.options.equipos, (tournament.semifinalistas || '').split(',')[2]?.trim(), 'Seleccionar semifinalista')}</select>
          </div>
          <div class="form-group">
            <label for="realSemi4">🏅 Semifinalista 4</label>
            <select id="realSemi4">${renderOptions(state.options.equipos, (tournament.semifinalistas || '').split(',')[3]?.trim(), 'Seleccionar semifinalista')}</select>
          </div>
          <div class="form-group">
            <label for="realInstanciaArgentina">🇦🇷 Instancia Argentina</label>
            <select id="realInstanciaArgentina">${renderOptions(state.options.fases, tournament.instanciaArgentina, 'Seleccionar instancia')}</select>
          </div>
        </div>
      </div>

      <h4>Resultados de partidos</h4>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Grupo</th>
              <th>Partido</th>
              <th>Goles A</th>
              <th>Goles B</th>
            </tr>
          </thead>
          <tbody>
            ${matches.map(match => {
              const result = getResult(match.id);
              return `
                <tr>
                  <td>${escapeHTML(match.fechaTexto)}</td>
                  <td>${escapeHTML(match.hora)}</td>
                  <td>${escapeHTML(match.grupo)}</td>
                  <td><strong>${escapeHTML(match.equipoA)}</strong> vs <strong>${escapeHTML(match.equipoB)}</strong></td>
                  <td><input class="score-input" type="number" min="0" max="20" id="realA_${match.id}" value="${result.golesA ?? ''}"></td>
                  <td><input class="score-input" type="number" min="0" max="20" id="realB_${match.id}" value="${result.golesB ?? ''}"></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    showMessage(error.message, 'error', 'admin');
  }
}

function readOptionalScore(id) {
  const value = $(id).value;
  if (value === '') return null;

  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 20) {
    throw new Error('Los resultados deben ser enteros entre 0 y 20.');
  }

  return number;
}

async function saveResults() {
  try {
    const matches = state.matches.map(match => ({
      matchId: match.id,
      golesA: readOptionalScore(`#realA_${match.id}`),
      golesB: readOptionalScore(`#realB_${match.id}`)
    }));

    await api('/api/admin/results', {
      method: 'PUT',
      body: JSON.stringify({
        tournament: {
          campeon: $('#realCampeon').value,
          subcampeon: $('#realSubcampeon').value,
          semifinalistas: [$('#realSemi1').value, $('#realSemi2').value, $('#realSemi3').value, $('#realSemi4').value].filter(Boolean).join(', '),
          instanciaArgentina: $('#realInstanciaArgentina').value
        },
        matches
      })
    });

    showMessage('Resultados guardados correctamente.', 'success', 'admin');
    await loadAdminStats();
  } catch (error) {
    showMessage(error.message, 'error', 'admin');
  }
}

async function loadAdminUsers() {
  try {
    state.adminUsers = await api('/api/admin/users');
    renderAdminUsers();
  } catch (error) {
    showMessage(error.message, 'error', 'admin');
  }
}

function renderAdminUsers() {
  const search = $('#searchUsuario').value.trim().toLowerCase();
  const estado = $('#filterEstado').value;
  const orderBy = $('#orderBy').value;

  let users = state.adminUsers.filter(u => !u.esAdmin);

  if (search) {
    users = users.filter(u =>
      u.usuario.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search)
    );
  }

  if (estado) {
    users = users.filter(u => u.estado === estado);
  }

  users.sort((a, b) => {
    if (orderBy === 'email') return a.email.localeCompare(b.email);
    if (orderBy === 'registro') return new Date(b.fechaRegistro) - new Date(a.fechaRegistro);
    if (orderBy === 'puntaje') return b.puntaje - a.puntaje;
    return a.usuario.localeCompare(b.usuario);
  });

  $('#listaUsuarios').innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Email</th>
            <th>Estado</th>
            <th>Puntaje</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td><strong>${escapeHTML(user.usuario)}</strong></td>
              <td>${escapeHTML(user.email)}</td>
              <td>
                <span class="badge ${user.estado === 'activo' ? 'activo' : 'bloqueado'}">
                  ${user.estado === 'activo' ? 'Activo' : 'Bloqueado'}
                </span>
              </td>
              <td>${user.puntaje} pts</td>
              <td>
                <button type="button" class="secondary" data-user-action="edit" data-id="${user.id}">Editar</button>
                <button type="button" class="${user.estado === 'activo' ? 'danger' : 'secondary'}" data-user-action="toggle" data-id="${user.id}" data-estado="${user.estado}">
                  ${user.estado === 'activo' ? 'Bloquear' : 'Desbloquear'}
                </button>
                <button type="button" class="secondary" data-user-action="password" data-id="${user.id}">Reset pass</button>
                <button type="button" class="danger" data-user-action="delete" data-id="${user.id}">Eliminar</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function loadAdminStats() {
  try {
    const stats = await api('/api/admin/stats');

    $('#estadisticasGenerales').innerHTML = `
      <div class="stats-card"><strong>👥 Total de usuarios:</strong> ${stats.totalUsuarios}</div>
      <div class="stats-card"><strong>🚫 Usuarios bloqueados:</strong> ${stats.usuariosBloqueados}</div>
      <div class="stats-card"><strong>⚽ Total de partidos:</strong> ${stats.totalPartidos}</div>
      <div class="stats-card"><strong>✅ Partidos con resultado:</strong> ${stats.partidosConResultados}/${stats.totalPartidos}</div>
      <div class="stats-card"><strong>📊 Puntaje promedio:</strong> ${stats.puntajePromedio} pts</div>
    `;
  } catch (error) {
    showMessage(error.message, 'error', 'admin');
  }
}

function openModal(html) {
  $('#modalBody').innerHTML = html;
  $('#modal').classList.add('show');
  $('#modal').setAttribute('aria-hidden', 'false');
}

function closeModal() {
  $('#modal').classList.remove('show');
  $('#modal').setAttribute('aria-hidden', 'true');
  $('#modalBody').innerHTML = '';
}

function getAdminUser(id) {
  return state.adminUsers.find(u => Number(u.id) === Number(id));
}

async function handleUserAction(event) {
  const button = event.target.closest('[data-user-action]');
  if (!button) return;

  const action = button.dataset.userAction;
  const id = Number(button.dataset.id);
  const user = getAdminUser(id);

  if (!user) return;

  if (action === 'edit') {
    openModal(`
      <h2>Editar usuario</h2>
      <form id="editUserForm">
        <div class="form-group">
          <label>Usuario</label>
          <input type="text" value="${escapeHTML(user.usuario)}" disabled>
        </div>
        <div class="form-group">
          <label for="editEmail">Email</label>
          <input type="email" id="editEmail" value="${escapeHTML(user.email)}" required>
        </div>
        <button type="submit">Guardar</button>
      </form>
    `);

    $('#editUserForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      try {
        await api(`/api/admin/users/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ email: $('#editEmail').value })
        });

        closeModal();
        showMessage('Usuario actualizado.', 'success', 'admin');
        await loadAdminUsers();
      } catch (error) {
        showMessage(error.message, 'error', 'admin');
      }
    });
  }

  if (action === 'toggle') {
    const newEstado = user.estado === 'activo' ? 'bloqueado' : 'activo';
    if (!confirm(`¿${newEstado === 'bloqueado' ? 'Bloquear' : 'Desbloquear'} a ${user.usuario}?`)) return;

    await api(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado: newEstado })
    });

    showMessage('Estado actualizado.', 'success', 'admin');
    await loadAdminUsers();
  }

  if (action === 'password') {
    openModal(`
      <h2>Resetear contraseña</h2>
      <p>Usuario: <strong>${escapeHTML(user.usuario)}</strong></p>
      <form id="resetPasswordForm">
        <div class="form-group">
          <label for="newPassword">Nueva contraseña</label>
          <input type="password" id="newPassword" minlength="8" required>
        </div>
        <button type="submit">Cambiar contraseña</button>
      </form>
    `);

    $('#resetPasswordForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      try {
        await api(`/api/admin/users/${id}/reset-password`, {
          method: 'POST',
          body: JSON.stringify({ password: $('#newPassword').value })
        });

        closeModal();
        showMessage('Contraseña actualizada.', 'success', 'admin');
      } catch (error) {
        showMessage(error.message, 'error', 'admin');
      }
    });
  }

  if (action === 'delete') {
    if (!confirm(`¿Eliminar definitivamente a ${user.usuario}?`)) return;

    await api(`/api/admin/users/${id}`, { method: 'DELETE' });
    showMessage('Usuario eliminado.', 'success', 'admin');
    await loadAdminUsers();
  }
}

function exportCsv() {
  const rows = [
    ['Usuario', 'Email', 'Estado', 'Fecha registro', 'Puntaje'],
    ...state.adminUsers
      .filter(u => !u.esAdmin)
      .map(u => [u.usuario, u.email, u.estado, new Date(u.fechaRegistro).toLocaleDateString('es-AR'), u.puntaje])
  ];

  const csv = rows
    .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `usuarios_prode_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


async function loadAdminPredictions() {
  try {
    state.adminPredictions = await api('/api/admin/predictions');
    renderAdminPredictions();
  } catch (error) {
    showMessage(error.message, 'error', 'admin');
  }
}


function resultText(result) {
  if (!result || result.golesA === null || result.golesA === undefined || result.golesB === null || result.golesB === undefined) {
    return '-';
  }
  return `${result.golesA}-${result.golesB}`;
}

function pointsText(pointsInfo) {
  if (!pointsInfo || pointsInfo.points === null || pointsInfo.points === undefined) {
    return '';
  }

  const label = pointsInfo.type === 'exacto'
    ? 'exacto'
    : pointsInfo.type === 'acierto_parcial'
      ? 'acierto parcial'
      : 'fallo';

  return `${pointsInfo.points} pt${pointsInfo.points === 1 ? '' : 's'} · ${label}`;
}

function predictionWithPointsText(user, match) {
  const prediction = user.predictionsByMatch?.[match.id];
  const pointsInfo = user.pointsByMatch?.[match.id];
  const pred = predictionText(prediction);
  const pts = pointsText(pointsInfo);

  if (pred === '-') return '-';
  return pts ? `${pred} (${pts})` : pred;
}

function renderRealResultsSummary(matches, resultsByMatch, tournament) {
  const semis = tournament.semifinalistas || '-';

  return `
    <div class="panel-card control-results-card">
      <h4>✅ Resultados cargados para controlar puntuación</h4>
      <p class="muted">Estos son los datos reales que el sistema está usando para calcular los puntos.</p>

      <div class="grid-2">
        <div><strong>Campeón:</strong> ${escapeHTML(tournament.campeon || '-')}</div>
        <div><strong>Subcampeón:</strong> ${escapeHTML(tournament.subcampeon || '-')}</div>
        <div><strong>Semifinalistas:</strong> ${escapeHTML(semis)}</div>
        <div><strong>Instancia Argentina:</strong> ${escapeHTML(tournament.instanciaArgentina || '-')}</div>
      </div>

      <div class="table-wrap mini-results-table">
        <table>
          <thead>
            <tr>
              <th>Partido</th>
              <th>Fecha</th>
              <th>Resultado cargado</th>
            </tr>
          </thead>
          <tbody>
            ${matches.map(match => `
              <tr>
                <td><strong>${escapeHTML(match.equipoA)}</strong> vs <strong>${escapeHTML(match.equipoB)}</strong></td>
                <td>${escapeHTML(match.fechaTexto)} ${escapeHTML(match.hora)}</td>
                <td><strong>${escapeHTML(resultText(resultsByMatch[match.id]))}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAdminPredictions() {
  const search = ($('#searchPronosticos')?.value || '').trim().toLowerCase();
  const matches = state.adminPredictions.matches || [];
  const resultsByMatch = state.adminPredictions.resultsByMatch || {};
  const tournament = state.adminPredictions.tournament || {};
  let users = state.adminPredictions.users || [];

  if (search) {
    users = users.filter(user =>
      user.usuario.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search)
    );
  }

  const resultsSummary = renderRealResultsSummary(matches, resultsByMatch, tournament);

  if (!users.length) {
    $('#tablaPronosticos').innerHTML = `${resultsSummary}<p>No hay pronósticos para mostrar.</p>`;
    return;
  }

  $('#tablaPronosticos').innerHTML = `
    ${resultsSummary}

    <div class="panel-card">
      <h4>🧾 Matriz de control de pronósticos y puntajes</h4>
      <p class="muted">La primera fila muestra el resultado real cargado. Cada celda de usuario muestra pronóstico + puntos obtenidos en ese partido.</p>
      <div class="table-wrap admin-predictions-wrap">
        <table class="admin-predictions-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Total</th>
              <th>Pts. partidos</th>
              <th>Pts. previos</th>
              <th>Exactos</th>
              <th>Aciertos parciales</th>
              <th>Campeón</th>
              <th>Subcampeón</th>
              <th>Semifinalistas</th>
              <th>Instancia Argentina</th>
              ${matches.map(match => `<th>${escapeHTML(match.equipoA)} vs ${escapeHTML(match.equipoB)}<br><small>${escapeHTML(match.fechaTexto)} ${escapeHTML(match.hora)}</small></th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr class="real-results-row">
              <td><strong>RESULTADO CARGADO</strong></td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td><strong>${escapeHTML(tournament.campeon || '-')}</strong></td>
              <td><strong>${escapeHTML(tournament.subcampeon || '-')}</strong></td>
              <td><strong>${escapeHTML(tournament.semifinalistas || '-')}</strong></td>
              <td><strong>${escapeHTML(tournament.instanciaArgentina || '-')}</strong></td>
              ${matches.map(match => `<td><strong>${escapeHTML(resultText(resultsByMatch[match.id]))}</strong></td>`).join('')}
            </tr>

            ${users.map(user => {
              const resumen = user.resumen || {};
              const previos = resumen.puntosPreviosDetalle || {};

              return `
                <tr>
                  <td><strong>${escapeHTML(user.usuario)}</strong></td>
                  <td>${escapeHTML(user.email)}</td>
                  <td><strong>${Number(resumen.puntosTotal || 0)} pts</strong></td>
                  <td>${Number(resumen.puntosPartidos || 0)}</td>
                  <td title="Campeón: ${previos.campeon ?? '-'} · Subcampeón: ${previos.subcampeon ?? '-'} · Semifinalistas: ${previos.semifinalistas ?? '-'} · Argentina: ${previos.instanciaArgentina ?? '-'}">${Number(resumen.puntosPrevios || 0)}</td>
                  <td>${Number(resumen.exactos || 0)}</td>
                  <td>${Number(resumen.aciertosParciales || 0)}</td>
                  <td>${escapeHTML(user.preliminary?.campeon || '-')} <small>${previos.campeon !== null && previos.campeon !== undefined ? `(${previos.campeon} pts)` : ''}</small></td>
                  <td>${escapeHTML(user.preliminary?.subcampeon || '-')} <small>${previos.subcampeon !== null && previos.subcampeon !== undefined ? `(${previos.subcampeon} pts)` : ''}</small></td>
                  <td>${escapeHTML(user.preliminary?.semifinalistas || '-')} <small>${previos.semifinalistas !== null && previos.semifinalistas !== undefined ? `(${previos.semifinalistas} pts)` : ''}</small></td>
                  <td>${escapeHTML(user.preliminary?.instanciaArgentina || '-')} <small>${previos.instanciaArgentina !== null && previos.instanciaArgentina !== undefined ? `(${previos.instanciaArgentina} pts)` : ''}</small></td>
                  ${matches.map(match => `<td>${escapeHTML(predictionWithPointsText(user, match))}</td>`).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}


function exportPredictionsCsv() {
  const matches = state.adminPredictions.matches || [];
  const users = state.adminPredictions.users || [];
  const resultsByMatch = state.adminPredictions.resultsByMatch || {};
  const tournament = state.adminPredictions.tournament || {};

  const header = [
    'Tipo de fila',
    'Usuario',
    'Email',
    'Total puntos',
    'Puntos partidos',
    'Puntos previos',
    'Exactos',
    'Aciertos parciales',
    'Campeon',
    'Subcampeon',
    'Semifinalistas',
    'Instancia Argentina',
    ...matches.map(match => `${match.equipoA} vs ${match.equipoB}`)
  ];

  const realRow = [
    'RESULTADO CARGADO',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    tournament.campeon || '',
    tournament.subcampeon || '',
    tournament.semifinalistas || '',
    tournament.instanciaArgentina || '',
    ...matches.map(match => resultText(resultsByMatch[match.id]))
  ];

  const rows = users.map(user => {
    const resumen = user.resumen || {};

    return [
      'PRONOSTICO USUARIO',
      user.usuario,
      user.email,
      resumen.puntosTotal || 0,
      resumen.puntosPartidos || 0,
      resumen.puntosPrevios || 0,
      resumen.exactos || 0,
      resumen.aciertosParciales || 0,
      user.preliminary?.campeon || '',
      user.preliminary?.subcampeon || '',
      user.preliminary?.semifinalistas || '',
      user.preliminary?.instanciaArgentina || '',
      ...matches.map(match => predictionWithPointsText(user, match))
    ];
  });

  const csv = [header, realRow, ...rows]
    .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `control_pronosticos_prode_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


// ==================== ADMIN: PREMIOS Y NOTICIAS ====================

function resetContentForm() {
  $('#contentId').value = '';
  $('#contentTipo').value = 'premio';
  $('#contentTitulo').value = '';
  $('#contentCuerpo').value = '';
  $('#contentOrden').value = '0';
  $('#contentPublicado').checked = true;
  $('#saveContentBtn').textContent = '💾 Guardar publicación';
}

async function loadAdminContent() {
  try {
    state.adminContent = await api('/api/admin/content');
    renderAdminContent();
  } catch (error) {
    showMessage(error.message, 'error', 'admin');
  }
}

function renderAdminContent() {
  const premios = state.adminContent.filter(item => item.tipo === 'premio');
  const noticias = state.adminContent.filter(item => item.tipo === 'noticia');

  $('#adminContentList').innerHTML = `
    <div class="grid-2 admin-content-grid">
      <div class="panel-card">
        <h4>🎁 Premios cargados</h4>
        ${renderAdminContentList(premios, 'premio')}
      </div>

      <div class="panel-card">
        <h4>📣 Noticias cargadas</h4>
        ${renderAdminContentList(noticias, 'noticia')}
      </div>
    </div>
  `;
}

function renderAdminContentList(items, tipo) {
  if (!items.length) {
    return `<p class="muted">Todavía no hay ${tipo === 'premio' ? 'premios' : 'noticias'} cargados.</p>`;
  }

  return `
    <div class="admin-public-list">
      ${items.map(item => `
        <article class="admin-public-item">
          <div>
            <div class="admin-public-title">
              <strong>${escapeHTML(item.titulo)}</strong>
              <span class="badge ${item.publicado ? 'activo' : 'bloqueado'}">${item.publicado ? 'Publicado' : 'Oculto'}</span>
            </div>
            ${item.cuerpo ? `<p>${escapeHTML(item.cuerpo).replaceAll('\n', '<br>')}</p>` : ''}
            <small>Orden: ${Number(item.orden || 0)}</small>
          </div>

          <div class="admin-public-actions">
            <button type="button" class="secondary" data-content-action="edit" data-id="${item.id}">Editar</button>
            <button type="button" class="danger" data-content-action="delete" data-id="${item.id}">Eliminar</button>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

async function saveContent(event) {
  event.preventDefault();

  const id = $('#contentId').value;
  const payload = {
    tipo: $('#contentTipo').value,
    titulo: $('#contentTitulo').value.trim(),
    cuerpo: $('#contentCuerpo').value.trim(),
    orden: Number($('#contentOrden').value || 0),
    publicado: $('#contentPublicado').checked
  };

  try {
    if (id) {
      await api(`/api/admin/content/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showMessage('Publicación actualizada.', 'success', 'admin');
    } else {
      await api('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showMessage('Publicación creada.', 'success', 'admin');
    }

    resetContentForm();
    await loadAdminContent();
    await loadHomeContent();
  } catch (error) {
    showMessage(error.message, 'error', 'admin');
  }
}

async function handleContentAction(event) {
  const button = event.target.closest('[data-content-action]');
  if (!button) return;

  const id = Number(button.dataset.id);
  const item = state.adminContent.find(row => Number(row.id) === id);
  if (!item) return;

  if (button.dataset.contentAction === 'edit') {
    $('#contentId').value = item.id;
    $('#contentTipo').value = item.tipo;
    $('#contentTitulo').value = item.titulo;
    $('#contentCuerpo').value = item.cuerpo || '';
    $('#contentOrden').value = item.orden || 0;
    $('#contentPublicado').checked = Boolean(item.publicado);
    $('#saveContentBtn').textContent = '💾 Actualizar publicación';
    showAdminTab('publicaciones');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (button.dataset.contentAction === 'delete') {
    if (!confirm(`¿Eliminar "${item.titulo}"?`)) return;

    try {
      await api(`/api/admin/content/${id}`, { method: 'DELETE' });
      showMessage('Publicación eliminada.', 'success', 'admin');
      resetContentForm();
      await loadAdminContent();
      await loadHomeContent();
    } catch (error) {
      showMessage(error.message, 'error', 'admin');
    }
  }
}

// ==================== EVENTS ====================

function bindEvents() {
  $$('.nav button[data-section]').forEach(button => {
    button.addEventListener('click', () => {
      const section = button.dataset.section;

      if (['prode', 'ranking'].includes(section) && !state.user) {
        showSection('login');
        return;
      }

      if (section === 'admin' && !state.user?.esAdmin) {
        showMessage('No tenés permisos de administrador.', 'error');
        return;
      }

      showSection(section);
    });
  });

  $('#startBtn').addEventListener('click', () => {
    showSection(state.user ? 'prode' : 'login');
  });

  $('#loginForm').addEventListener('submit', handleLogin);
  $('#registerForm').addEventListener('submit', handleRegister);
  $('#logoutBtn').addEventListener('click', logout);
  $('#savePredictionsBtn').addEventListener('click', savePredictions);
  $('#saveResultsBtn').addEventListener('click', saveResults);

  $$('.admin-tabs button').forEach(button => {
    button.addEventListener('click', () => showAdminTab(button.dataset.adminTab));
  });

  $('#searchUsuario').addEventListener('input', renderAdminUsers);
  $('#filterEstado').addEventListener('change', renderAdminUsers);
  $('#orderBy').addEventListener('change', renderAdminUsers);
  $('#listaUsuarios').addEventListener('click', handleUserAction);
  $('#exportCsvBtn').addEventListener('click', exportCsv);
  $('#searchPronosticos').addEventListener('input', renderAdminPredictions);
  $('#exportPredictionsCsvBtn').addEventListener('click', exportPredictionsCsv);
  $('#contentForm').addEventListener('submit', saveContent);
  $('#clearContentFormBtn').addEventListener('click', resetContentForm);
  $('#adminContentList').addEventListener('click', handleContentAction);

  $('#closeModalBtn').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', (event) => {
    if (event.target.id === 'modal') closeModal();
  });
}

// ==================== INIT ====================

(async function init() {
  bindEvents();

  try {
    await refreshSession();
  } catch {
    state.user = null;
    updateNav();
  }

  showSection('home');
})();
