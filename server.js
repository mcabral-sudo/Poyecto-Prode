require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const SQLiteStoreFactory = require('connect-sqlite3');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const SQLiteStore = SQLiteStoreFactory(session);

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || './data/prode.sqlite';
const SESSION_SECRET = process.env.SESSION_SECRET || 'CAMBIAR-ESTE-SECRETO';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function callback(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

const partidosIniciales = [
  { id: 1, grupo: 'A', equipoA: 'México', equipoB: 'Sudáfrica', fecha: '2026-06-11', fechaTexto: 'jueves 11/06/2026', hora: '16:00' },
  { id: 2, grupo: 'A', equipoA: 'Estados Unidos', equipoB: 'Paraguay', fecha: '2026-06-12', fechaTexto: 'viernes 12/06/2026', hora: '22:00' },
  { id: 3, grupo: 'A', equipoA: 'Brasil', equipoB: 'Marruecos', fecha: '2026-06-13', fechaTexto: 'sábado 13/06/2026', hora: '19:00' },
  { id: 4, grupo: 'B', equipoA: 'Países Bajos', equipoB: 'Japón', fecha: '2026-06-14', fechaTexto: 'domingo 14/06/2026', hora: '17:00' },
  { id: 5, grupo: 'B', equipoA: 'Bélgica', equipoB: 'Egipto', fecha: '2026-06-15', fechaTexto: 'lunes 15/06/2026', hora: '16:00' },
  { id: 6, grupo: 'C', equipoA: 'Francia', equipoB: 'Senegal', fecha: '2026-06-16', fechaTexto: 'martes 16/06/2026', hora: '16:00' },
  { id: 7, grupo: 'C', equipoA: 'Argentina', equipoB: 'Argelia', fecha: '2026-06-16', fechaTexto: 'martes 16/06/2026', hora: '22:00' },
  { id: 8, grupo: 'D', equipoA: 'Inglaterra', equipoB: 'Croacia', fecha: '2026-06-17', fechaTexto: 'miércoles 17/06/2026', hora: '17:00' },
  { id: 9, grupo: 'E', equipoA: 'España', equipoB: 'Uruguay', fecha: '2026-06-21', fechaTexto: 'domingo 21/06/2026', hora: '23:00' },
  { id: 10, grupo: 'C', equipoA: 'Argentina', equipoB: 'Austria', fecha: '2026-06-22', fechaTexto: 'lunes 22/06/2026', hora: '14:00' },
  { id: 11, grupo: 'F', equipoA: 'Alemania', equipoB: 'Ecuador', fecha: '2026-06-25', fechaTexto: 'jueves 25/06/2026', hora: '17:00' },
  { id: 12, grupo: 'D', equipoA: 'Portugal', equipoB: 'Colombia', fecha: '2026-06-27', fechaTexto: 'sábado 27/06/2026', hora: '20:30' },
  { id: 13, grupo: 'C', equipoA: 'Argentina', equipoB: 'Jordania', fecha: '2026-06-27', fechaTexto: 'sábado 27/06/2026', hora: '23:00' }
];


const equiposMundial = [
  'Alemania',
  'Argelia',
  'Argentina',
  'Australia',
  'Austria',
  'Bélgica',
  'Bosnia y Herzegovina',
  'Brasil',
  'Cabo Verde',
  'Canadá',
  'Colombia',
  'Corea del Sur',
  'Costa de Marfil',
  'Croacia',
  'Curaçao',
  'Ecuador',
  'Egipto',
  'Escocia',
  'España',
  'Estados Unidos',
  'Francia',
  'Ghana',
  'Haití',
  'Inglaterra',
  'Irak',
  'Irán',
  'Japón',
  'Jordania',
  'Marruecos',
  'México',
  'Noruega',
  'Nueva Zelanda',
  'Países Bajos',
  'Panamá',
  'Paraguay',
  'Portugal',
  'Qatar',
  'RD Congo',
  'República Checa',
  'Senegal',
  'Sudáfrica',
  'Suecia',
  'Suiza',
  'Túnez',
  'Turquía',
  'Uruguay',
  'Uzbekistán'
].sort((a, b) => a.localeCompare(b, 'es'));

const fasesMundial = [
  'Fase de Grupos',
  'Dieciseisavos de Final',
  'Octavos de Final',
  'Cuartos de Final',
  'Semifinal',
  'Final',
  'Campeón'
];


function calculateMatchPoints(prediction, result) {
  if (!prediction || !result) return { points: null, type: 'sin_resultado' };

  const predA = prediction.golesA;
  const predB = prediction.golesB;
  const realA = result.golesA;
  const realB = result.golesB;

  if (![predA, predB, realA, realB].every(Number.isInteger)) {
    return { points: null, type: 'sin_resultado' };
  }

  if (predA === realA && predB === realB) {
    return { points: 3, type: 'exacto' };
  }

  const predResult = predA > predB ? 'local' : predA < predB ? 'visitante' : 'empate';
  const realResult = realA > realB ? 'local' : realA < realB ? 'visitante' : 'empate';

  if (predResult === realResult) {
    return { points: 1, type: 'acierto_parcial' };
  }

  return { points: 0, type: 'fallo' };
}

function calculatePreliminaryPoints(preliminary, tournament) {
  const breakdown = {
    campeon: null,
    subcampeon: null,
    instanciaArgentina: null,
    semifinalistas: null,
    total: 0
  };

  if (tournament.campeon) {
    breakdown.campeon = normalizeText(preliminary.campeon) === normalizeText(tournament.campeon) ? 5 : 0;
    breakdown.total += breakdown.campeon;
  }

  if (tournament.subcampeon) {
    breakdown.subcampeon = normalizeText(preliminary.subcampeon) === normalizeText(tournament.subcampeon) ? 3 : 0;
    breakdown.total += breakdown.subcampeon;
  }

  if (tournament.instanciaArgentina) {
    breakdown.instanciaArgentina = normalizeText(preliminary.instanciaArgentina) === normalizeText(tournament.instanciaArgentina) ? 3 : 0;
    breakdown.total += breakdown.instanciaArgentina;
  }

  if (tournament.semifinalistas && preliminary.semifinalistas) {
    const reales = new Set(String(tournament.semifinalistas).split(',').map(normalizeText).filter(Boolean));
    const usuario = [...new Set(String(preliminary.semifinalistas).split(',').map(normalizeText).filter(Boolean))];
    let puntosSemis = 0;

    for (const semi of usuario) {
      if (reales.has(semi)) puntosSemis += 2;
    }

    breakdown.semifinalistas = puntosSemis;
    breakdown.total += puntosSemis;
  }

  return breakdown;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= 20;
}

function matchLockDate(match) {
  const [year, month, day] = match.fecha.split('-').map(Number);
  const [hours, minutes] = match.hora.split(':').map(Number);

  // Servidor en Argentina. Para una red interna alcanza si el reloj del servidor está bien.
  // Se bloquea 1 minuto antes del inicio del partido.
  return new Date(year, month - 1, day, hours, minutes - 1, 0, 0);
}

function canEditMatch(match) {
  return new Date() <= matchLockDate(match);
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.esAdmin) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  return next();
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      es_admin INTEGER NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'activo',
      fecha_registro TEXT NOT NULL,
      ultimo_acceso TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY,
      grupo TEXT NOT NULL,
      equipo_a TEXT NOT NULL,
      equipo_b TEXT NOT NULL,
      fecha TEXT NOT NULL,
      fecha_texto TEXT NOT NULL,
      hora TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS predictions (
      user_id INTEGER NOT NULL,
      match_id INTEGER NOT NULL,
      goles_a INTEGER,
      goles_b INTEGER,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, match_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS preliminary_predictions (
      user_id INTEGER PRIMARY KEY,
      campeon TEXT,
      subcampeon TEXT,
      semifinalistas TEXT,
      instancia_argentina TEXT,
      campeon_eliminatoria TEXT,
      subcampeon_eliminatoria TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS results (
      match_id INTEGER PRIMARY KEY,
      goles_a INTEGER,
      goles_b INTEGER,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS tournament_results (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      campeon TEXT,
      subcampeon TEXT,
      semifinalistas TEXT,
      instancia_argentina TEXT,
      updated_at TEXT NOT NULL
    )
  `);


  await run(`
    CREATE TABLE IF NOT EXISTS content_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL CHECK (tipo IN ('premio', 'noticia')),
      titulo TEXT NOT NULL,
      cuerpo TEXT NOT NULL DEFAULT '',
      publicado INTEGER NOT NULL DEFAULT 1,
      orden INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  for (const p of partidosIniciales) {
    await run(`
      INSERT INTO matches (id, grupo, equipo_a, equipo_b, fecha, fecha_texto, hora)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        grupo = excluded.grupo,
        equipo_a = excluded.equipo_a,
        equipo_b = excluded.equipo_b,
        fecha = excluded.fecha,
        fecha_texto = excluded.fecha_texto,
        hora = excluded.hora
    `, [p.id, p.grupo, p.equipoA, p.equipoB, p.fecha, p.fechaTexto, p.hora]);
  }

  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@empresa.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'CambiarEstaClave123!';

  const existingAdmin = await get('SELECT id FROM users WHERE usuario = ?', [adminUser]);
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await run(`
      INSERT INTO users (usuario, email, password_hash, es_admin, estado, fecha_registro, ultimo_acceso)
      VALUES (?, ?, ?, 1, 'activo', ?, ?)
    `, [adminUser, adminEmail, passwordHash, new Date().toISOString(), new Date().toISOString()]);
    console.log(`Administrador inicial creado: ${adminUser}`);
  }
}

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.sqlite',
    dir: './data'
  }),
  name: 'prode.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

// ==================== AUTH ====================

app.get('/api/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post('/api/register', async (req, res) => {
  const usuario = String(req.body.usuario || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!usuario || usuario.length < 3) {
    return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres.' });
  }

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email inválido.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  const exists = await get('SELECT id FROM users WHERE usuario = ? OR email = ?', [usuario, email]);
  if (exists) {
    return res.status(409).json({ error: 'El usuario o email ya está registrado.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();

  await run(`
    INSERT INTO users (usuario, email, password_hash, es_admin, estado, fecha_registro, ultimo_acceso)
    VALUES (?, ?, ?, 0, 'activo', ?, ?)
  `, [usuario, email, passwordHash, now, now]);

  res.status(201).json({ ok: true });
});

app.post('/api/login', async (req, res) => {
  const usuario = String(req.body.usuario || '').trim();
  const password = String(req.body.password || '');

  const user = await get('SELECT * FROM users WHERE usuario = ?', [usuario]);
  if (!user) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  if (user.estado !== 'activo') {
    return res.status(403).json({ error: 'Usuario bloqueado. Contactá al administrador.' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  const now = new Date().toISOString();
  await run('UPDATE users SET ultimo_acceso = ? WHERE id = ?', [now, user.id]);

  req.session.user = {
    id: user.id,
    usuario: user.usuario,
    email: user.email,
    esAdmin: Boolean(user.es_admin)
  };

  res.json({ user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('prode.sid');
    res.json({ ok: true });
  });
});


app.get('/api/options', requireAuth, (req, res) => {
  res.json({
    equipos: equiposMundial,
    fases: fasesMundial
  });
});


// ==================== CONTENIDO PÚBLICO DEL INICIO ====================

app.get('/api/public-content', async (req, res) => {
  const rows = await all(`
    SELECT id, tipo, titulo, cuerpo, orden, updated_at AS updatedAt
    FROM content_items
    WHERE publicado = 1
    ORDER BY tipo ASC, orden ASC, updated_at DESC, id DESC
  `);

  res.json({
    premios: rows.filter(row => row.tipo === 'premio'),
    noticias: rows.filter(row => row.tipo === 'noticia')
  });
});

app.get('/api/admin/content', requireAdmin, async (req, res) => {
  const rows = await all(`
    SELECT id, tipo, titulo, cuerpo, publicado, orden, created_at AS createdAt, updated_at AS updatedAt
    FROM content_items
    ORDER BY tipo ASC, orden ASC, updated_at DESC, id DESC
  `);

  res.json(rows.map(row => ({
    ...row,
    publicado: Boolean(row.publicado)
  })));
});

app.post('/api/admin/content', requireAdmin, async (req, res) => {
  const tipo = String(req.body.tipo || '').trim();
  const titulo = String(req.body.titulo || '').trim();
  const cuerpo = String(req.body.cuerpo || '').trim();
  const publicado = req.body.publicado ? 1 : 0;
  const orden = Number.isInteger(Number(req.body.orden)) ? Number(req.body.orden) : 0;

  if (!['premio', 'noticia'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo inválido. Debe ser premio o noticia.' });
  }

  if (!titulo) {
    return res.status(400).json({ error: 'El título es obligatorio.' });
  }

  const now = new Date().toISOString();
  const result = await run(`
    INSERT INTO content_items (tipo, titulo, cuerpo, publicado, orden, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [tipo, titulo, cuerpo, publicado, orden, now, now]);

  res.status(201).json({ ok: true, id: result.lastID });
});

app.put('/api/admin/content/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const tipo = String(req.body.tipo || '').trim();
  const titulo = String(req.body.titulo || '').trim();
  const cuerpo = String(req.body.cuerpo || '').trim();
  const publicado = req.body.publicado ? 1 : 0;
  const orden = Number.isInteger(Number(req.body.orden)) ? Number(req.body.orden) : 0;

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'ID inválido.' });
  }

  if (!['premio', 'noticia'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo inválido. Debe ser premio o noticia.' });
  }

  if (!titulo) {
    return res.status(400).json({ error: 'El título es obligatorio.' });
  }

  const item = await get('SELECT id FROM content_items WHERE id = ?', [id]);
  if (!item) {
    return res.status(404).json({ error: 'Publicación no encontrada.' });
  }

  await run(`
    UPDATE content_items
    SET tipo = ?, titulo = ?, cuerpo = ?, publicado = ?, orden = ?, updated_at = ?
    WHERE id = ?
  `, [tipo, titulo, cuerpo, publicado, orden, new Date().toISOString(), id]);

  res.json({ ok: true });
});

app.delete('/api/admin/content/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'ID inválido.' });
  }

  await run('DELETE FROM content_items WHERE id = ?', [id]);
  res.json({ ok: true });
});

// ==================== MATCHES ====================

app.get('/api/matches', requireAuth, async (req, res) => {
  const rows = await all(`
    SELECT id, grupo, equipo_a AS equipoA, equipo_b AS equipoB, fecha, fecha_texto AS fechaTexto, hora
    FROM matches
    ORDER BY fecha ASC, hora ASC, id ASC
  `);

  const enriched = rows.map(row => ({
    ...row,
    editable: canEditMatch(row)
  }));

  res.json(enriched);
});

// ==================== PREDICTIONS ====================

app.get('/api/predictions/my', requireAuth, async (req, res) => {
  const userId = req.session.user.id;

  const matchPredictions = await all(`
    SELECT match_id AS matchId, goles_a AS golesA, goles_b AS golesB
    FROM predictions
    WHERE user_id = ?
  `, [userId]);

  const preliminary = await get(`
    SELECT campeon, subcampeon, semifinalistas, instancia_argentina AS instanciaArgentina,
           campeon_eliminatoria AS campeonEliminatoria,
           subcampeon_eliminatoria AS subcampeonEliminatoria
    FROM preliminary_predictions
    WHERE user_id = ?
  `, [userId]);

  res.json({
    matches: matchPredictions,
    preliminary: preliminary || {}
  });
});

app.put('/api/predictions/my', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const now = new Date().toISOString();

  const preliminary = req.body.preliminary || {};
  const predictions = Array.isArray(req.body.matches) ? req.body.matches : [];

  await run(`
    INSERT INTO preliminary_predictions
      (user_id, campeon, subcampeon, semifinalistas, instancia_argentina, campeon_eliminatoria, subcampeon_eliminatoria, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      campeon = excluded.campeon,
      subcampeon = excluded.subcampeon,
      semifinalistas = excluded.semifinalistas,
      instancia_argentina = excluded.instancia_argentina,
      campeon_eliminatoria = excluded.campeon_eliminatoria,
      subcampeon_eliminatoria = excluded.subcampeon_eliminatoria,
      updated_at = excluded.updated_at
  `, [
    userId,
    String(preliminary.campeon || '').trim(),
    String(preliminary.subcampeon || '').trim(),
    String(preliminary.semifinalistas || '').trim(),
    String(preliminary.instanciaArgentina || '').trim(),
    String(preliminary.campeonEliminatoria || '').trim(),
    String(preliminary.subcampeonEliminatoria || '').trim(),
    now
  ]);

  let saved = 0;
  let blocked = 0;
  let invalid = 0;

  for (const pred of predictions) {
    const matchId = Number(pred.matchId);
    const golesA = Number(pred.golesA);
    const golesB = Number(pred.golesB);

    if (!Number.isInteger(matchId) || !isValidScore(golesA) || !isValidScore(golesB)) {
      invalid += 1;
      continue;
    }

    const match = await get('SELECT id, fecha, hora FROM matches WHERE id = ?', [matchId]);
    if (!match) {
      invalid += 1;
      continue;
    }

    if (!canEditMatch(match)) {
      blocked += 1;
      continue;
    }

    await run(`
      INSERT INTO predictions (user_id, match_id, goles_a, goles_b, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, match_id) DO UPDATE SET
        goles_a = excluded.goles_a,
        goles_b = excluded.goles_b,
        updated_at = excluded.updated_at
    `, [userId, matchId, golesA, golesB, now]);

    saved += 1;
  }

  res.json({ ok: true, saved, blocked, invalid });
});

// ==================== RANKING ====================

async function getTournamentResults() {
  return await get(`
    SELECT campeon, subcampeon, semifinalistas, instancia_argentina AS instanciaArgentina
    FROM tournament_results
    WHERE id = 1
  `) || {};
}

async function calculateScore(userId) {
  let points = 0;
  let exactos = 0;
  let aciertosParciales = 0;

  const matchPredictions = await all(`
    SELECT p.match_id, p.goles_a AS predA, p.goles_b AS predB,
           r.goles_a AS realA, r.goles_b AS realB
    FROM predictions p
    JOIN results r ON r.match_id = p.match_id
    WHERE p.user_id = ?
      AND p.goles_a IS NOT NULL
      AND p.goles_b IS NOT NULL
      AND r.goles_a IS NOT NULL
      AND r.goles_b IS NOT NULL
  `, [userId]);

  for (const row of matchPredictions) {
    if (row.predA === row.realA && row.predB === row.realB) {
      points += 3;
      exactos += 1;
    } else {
      const predResult = row.predA > row.predB ? 'local' : row.predA < row.predB ? 'visitante' : 'empate';
      const realResult = row.realA > row.realB ? 'local' : row.realA < row.realB ? 'visitante' : 'empate';

      if (predResult === realResult) {
        points += 1;
        aciertosParciales += 1;
      }
    }
  }

  const preliminary = await get(`
    SELECT campeon, subcampeon, semifinalistas, instancia_argentina AS instanciaArgentina
    FROM preliminary_predictions
    WHERE user_id = ?
  `, [userId]) || {};

  const tournament = await getTournamentResults();

  if (tournament.campeon && normalizeText(preliminary.campeon) === normalizeText(tournament.campeon)) {
    points += 5;
  }

  if (tournament.subcampeon && normalizeText(preliminary.subcampeon) === normalizeText(tournament.subcampeon)) {
    points += 3;
  }

  if (tournament.instanciaArgentina && normalizeText(preliminary.instanciaArgentina) === normalizeText(tournament.instanciaArgentina)) {
    points += 3;
  }

  if (tournament.semifinalistas && preliminary.semifinalistas) {
    const reales = new Set(tournament.semifinalistas.split(',').map(normalizeText).filter(Boolean));
    const usuario = [...new Set(preliminary.semifinalistas.split(',').map(normalizeText).filter(Boolean))];

    for (const semi of usuario) {
      if (reales.has(semi)) {
        points += 2;
      }
    }
  }

  return { points, exactos, aciertosParciales };
}

app.get('/api/ranking', requireAuth, async (req, res) => {
  const users = await all(`
    SELECT id, usuario
    FROM users
    WHERE es_admin = 0
    ORDER BY usuario ASC
  `);

  const ranking = [];
  for (const user of users) {
    const score = await calculateScore(user.id);
    ranking.push({
      usuario: user.usuario,
      puntos: score.points,
      exactos: score.exactos,
      aciertosParciales: score.aciertosParciales
    });
  }

  ranking.sort((a, b) =>
    b.puntos - a.puntos ||
    b.exactos - a.exactos ||
    a.usuario.localeCompare(b.usuario)
  );

  res.json(ranking);
});

// ==================== ADMIN ====================

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const users = await all(`
    SELECT id, usuario, email, estado, es_admin AS esAdmin, fecha_registro AS fechaRegistro, ultimo_acceso AS ultimoAcceso
    FROM users
    ORDER BY usuario ASC
  `);

  const result = [];
  for (const user of users) {
    const score = await calculateScore(user.id);
    result.push({
      ...user,
      esAdmin: Boolean(user.esAdmin),
      puntaje: score.points,
      exactos: score.exactos
    });
  }

  res.json(result);
});

app.patch('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
  const estado = req.body.estado ? String(req.body.estado) : null;

  const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  if (email) {
    const exists = await get('SELECT id FROM users WHERE email = ? AND id <> ?', [email, userId]);
    if (exists) {
      return res.status(409).json({ error: 'El email ya está en uso.' });
    }
    await run('UPDATE users SET email = ? WHERE id = ?', [email, userId]);
  }

  if (estado) {
    if (!['activo', 'bloqueado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido.' });
    }
    await run('UPDATE users SET estado = ? WHERE id = ?', [estado, userId]);
  }

  res.json({ ok: true });
});

app.post('/api/admin/users/:id/reset-password', requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const password = String(req.body.password || '');

  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  const hash = await bcrypt.hash(password, 12);
  await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);

  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);

  if (req.session.user.id === userId) {
    return res.status(400).json({ error: 'No podés eliminar tu propio usuario.' });
  }

  await run('DELETE FROM users WHERE id = ?', [userId]);
  res.json({ ok: true });
});

app.get('/api/admin/results', requireAdmin, async (req, res) => {
  const matchResults = await all(`
    SELECT match_id AS matchId, goles_a AS golesA, goles_b AS golesB
    FROM results
  `);

  const tournament = await getTournamentResults();

  res.json({
    matches: matchResults,
    tournament
  });
});

app.put('/api/admin/results', requireAdmin, async (req, res) => {
  const now = new Date().toISOString();
  const matches = Array.isArray(req.body.matches) ? req.body.matches : [];
  const tournament = req.body.tournament || {};

  for (const result of matches) {
    const matchId = Number(result.matchId);

    if (!Number.isInteger(matchId)) {
      continue;
    }

    const golesA = result.golesA === null || result.golesA === '' ? null : Number(result.golesA);
    const golesB = result.golesB === null || result.golesB === '' ? null : Number(result.golesB);

    if ((golesA !== null && !isValidScore(golesA)) || (golesB !== null && !isValidScore(golesB))) {
      continue;
    }

    await run(`
      INSERT INTO results (match_id, goles_a, goles_b, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(match_id) DO UPDATE SET
        goles_a = excluded.goles_a,
        goles_b = excluded.goles_b,
        updated_at = excluded.updated_at
    `, [matchId, golesA, golesB, now]);
  }

  await run(`
    INSERT INTO tournament_results
      (id, campeon, subcampeon, semifinalistas, instancia_argentina, updated_at)
    VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      campeon = excluded.campeon,
      subcampeon = excluded.subcampeon,
      semifinalistas = excluded.semifinalistas,
      instancia_argentina = excluded.instancia_argentina,
      updated_at = excluded.updated_at
  `, [
    String(tournament.campeon || '').trim(),
    String(tournament.subcampeon || '').trim(),
    String(tournament.semifinalistas || '').trim(),
    String(tournament.instanciaArgentina || '').trim(),
    now
  ]);

  res.json({ ok: true });
});



app.get('/api/admin/predictions', requireAdmin, async (req, res) => {
  const users = await all(`
    SELECT id, usuario, email
    FROM users
    WHERE es_admin = 0
    ORDER BY usuario ASC
  `);

  const matches = await all(`
    SELECT id, grupo, equipo_a AS equipoA, equipo_b AS equipoB, fecha_texto AS fechaTexto, hora
    FROM matches
    ORDER BY fecha ASC, hora ASC, id ASC
  `);

  const matchResultsRows = await all(`
    SELECT match_id AS matchId, goles_a AS golesA, goles_b AS golesB
    FROM results
  `);

  const resultsByMatch = {};
  for (const result of matchResultsRows) {
    resultsByMatch[result.matchId] = {
      golesA: result.golesA,
      golesB: result.golesB
    };
  }

  const tournament = await getTournamentResults();
  const rows = [];

  for (const user of users) {
    const preliminary = await get(`
      SELECT campeon, subcampeon, semifinalistas, instancia_argentina AS instanciaArgentina,
             campeon_eliminatoria AS campeonEliminatoria,
             subcampeon_eliminatoria AS subcampeonEliminatoria,
             updated_at AS updatedAt
      FROM preliminary_predictions
      WHERE user_id = ?
    `, [user.id]) || {};

    const predictionsRows = await all(`
      SELECT match_id AS matchId, goles_a AS golesA, goles_b AS golesB, updated_at AS updatedAt
      FROM predictions
      WHERE user_id = ?
    `, [user.id]);

    const predictionsByMatch = {};
    const pointsByMatch = {};
    let matchPointsTotal = 0;
    let exactos = 0;
    let aciertosParciales = 0;

    for (const prediction of predictionsRows) {
      predictionsByMatch[prediction.matchId] = {
        golesA: prediction.golesA,
        golesB: prediction.golesB,
        updatedAt: prediction.updatedAt
      };

      const result = resultsByMatch[prediction.matchId];
      const calc = calculateMatchPoints(prediction, result);
      pointsByMatch[prediction.matchId] = calc;

      if (Number.isInteger(calc.points)) {
        matchPointsTotal += calc.points;
        if (calc.type === 'exacto') exactos += 1;
        if (calc.type === 'acierto_parcial') aciertosParciales += 1;
      }
    }

    const preliminaryPoints = calculatePreliminaryPoints(preliminary, tournament);

    rows.push({
      usuario: user.usuario,
      email: user.email,
      preliminary,
      predictionsByMatch,
      pointsByMatch,
      resumen: {
        puntosPartidos: matchPointsTotal,
        puntosPrevios: preliminaryPoints.total,
        puntosTotal: matchPointsTotal + preliminaryPoints.total,
        exactos,
        aciertosParciales,
        puntosPreviosDetalle: preliminaryPoints
      }
    });
  }

  res.json({
    tournament,
    matches,
    resultsByMatch,
    users: rows
  });
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const totalUsuarios = await get('SELECT COUNT(*) AS total FROM users WHERE es_admin = 0');
  const bloqueados = await get("SELECT COUNT(*) AS total FROM users WHERE estado = 'bloqueado' AND es_admin = 0");
  const totalPartidos = await get('SELECT COUNT(*) AS total FROM matches');
  const partidosConResultados = await get(`
    SELECT COUNT(*) AS total
    FROM results
    WHERE goles_a IS NOT NULL AND goles_b IS NOT NULL
  `);

  const rankingResponse = [];
  const users = await all('SELECT id FROM users WHERE es_admin = 0');
  for (const user of users) {
    rankingResponse.push(await calculateScore(user.id));
  }

  const promedio = rankingResponse.length
    ? rankingResponse.reduce((sum, s) => sum + s.points, 0) / rankingResponse.length
    : 0;

  res.json({
    totalUsuarios: totalUsuarios.total,
    usuariosBloqueados: bloqueados.total,
    totalPartidos: totalPartidos.total,
    partidosConResultados: partidosConResultados.total,
    puntajePromedio: Number(promedio.toFixed(1))
  });
});

// Fallback para frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Prode corriendo en http://localhost:${PORT}`);
      console.log(`En red interna: http://IP-DEL-SERVIDOR:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Error inicializando la base de datos:', err);
    process.exit(1);
  });
