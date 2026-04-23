import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { APP_CONFIG } from './config.js';
import { STICKERS } from './stickers.js';

const root = document.getElementById('app');
const scoreboardAnimState = new Map();
const stickerMap = Object.fromEntries(STICKERS.map((s) => [s.id, s]));
const TOTAL_QUESTIONS = APP_CONFIG.QUESTIONS.length;
const STORAGE_KEYS = {
  playerId: 'feli-game-player-id',
  adminAuth: 'feli-game-admin-auth'
};

const hasSupabase =
  APP_CONFIG.SUPABASE_URL &&
  APP_CONFIG.SUPABASE_ANON_KEY &&
  !APP_CONFIG.SUPABASE_URL.includes('PEGA_AQUI') &&
  !APP_CONFIG.SUPABASE_ANON_KEY.includes('PEGA_AQUI');

const supabase = hasSupabase
  ? createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

const state = {
  loading: true,
  busy: false,
  view: getViewFromHash(),
  playerId: localStorage.getItem(STORAGE_KEYS.playerId) || '',
  adminAuthed: localStorage.getItem(STORAGE_KEYS.adminAuth) === '1',
  setupError: '',
  game: null,
  players: [],
  guesses: [],
  subscriptionsReady: false
};

window.addEventListener('hashchange', () => {
  state.view = getViewFromHash();
  render();
});

init().catch((error) => {
  console.error(error);
  state.setupError = error.message || 'No se pudo inicializar la app.';
  state.loading = false;
  render();
});

async function init() {
  if (hasSupabase) {
    await ensureRealtime();
    subscribeRealtime();
    await refreshData();
  }
  state.loading = false;
  render();
}

async function ensureRealtime() {
  const { error } = await supabase.from('game_state').select('id').eq('id', 1).single();
  if (error) {
    throw new Error('No encuentro la base del juego. Ejecutá primero el archivo supabase-schema.sql en Supabase.');
  }
}

function subscribeRealtime() {
  if (state.subscriptionsReady || !supabase) return;

  const channel = supabase
    .channel('baby-shower-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, refreshData)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, refreshData)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'guesses' }, refreshData)
    .subscribe();

  state.subscriptionsReady = true;
  state.channel = channel;
}

async function refreshData() {
  if (!supabase) return;

  const [{ data: game }, { data: players }, { data: guesses }] = await Promise.all([
    supabase.from('game_state').select('*').eq('id', 1).single(),
    supabase.from('players').select('*').order('created_at', { ascending: true }),
    supabase.from('guesses').select('*').order('created_at', { ascending: true })
  ]);

  state.game = game || null;
  state.players = players || [];
  state.guesses = guesses || [];

  if (state.playerId && !state.players.some((p) => p.id === state.playerId)) {
    localStorage.removeItem(STORAGE_KEYS.playerId);
    state.playerId = '';
  }

  render();
}

function getViewFromHash() {
  const raw = window.location.hash.replace('#', '').trim();
  if (['guest', 'admin', 'board'].includes(raw)) return raw;
  return 'home';
}

function render() {
  if (!root) return;

  if (!hasSupabase) {
    root.innerHTML = renderSetupScreen();
    bindCommonEvents();
    return;
  }

  if (state.loading) {
    root.innerHTML = renderShell(`<section class="loading-screen glass"><div class="spinner"></div><h2>Cargando juego...</h2><p>Preparando invitados, ranking y resultados en vivo.</p></section>`);
    return;
  }

  const content = {
    home: renderHome(),
    guest: renderGuestView(),
    admin: renderAdminView(),
    board: renderBoardView()
  }[state.view] || renderHome();

  root.innerHTML = renderShell(content);
  bindCommonEvents();

  if (state.view === 'board') {
    animateLeaderboard();
  }
}

function renderShell(content) {
  const game = state.game || {};
  const round = game.current_round || 1;
  return `
    <div class="app-shell">
      <div class="ambient ambient-a"></div>
      <div class="ambient ambient-b"></div>
      <header class="topbar glass">
        <div>
          <div class="eyebrow">Felipe Fidel</div>
          <h1>${escapeHtml(APP_CONFIG.EVENT_NAME)}</h1>
          <p>${escapeHtml(APP_CONFIG.EVENT_SUBTITLE)}</p>
        </div>
        <div class="topbar-meta">
          <span class="status-pill ${state.game?.phase || 'waiting'}">${labelPhase(state.game?.phase)}</span>
          <span class="round-pill">Pregunta ${round} / ${TOTAL_QUESTIONS}</span>
        </div>
      </header>
      <main class="main-wrap">${content}</main>
    </div>
  `;
}

function renderSetupScreen() {
  return renderShell(`
    <section class="hero-card glass setup-card">
      <div class="hero-copy">
        <span class="section-badge">Código listo</span>
        <h2>Solo falta conectar Supabase</h2>
        <p>La app ya está preparada para GitHub Pages, pero para que funcione entre todos los celulares y la tele necesita una base en tiempo real.</p>
        <ol class="setup-list">
          <li>Creá un proyecto en Supabase.</li>
          <li>Ejecutá el archivo <strong>supabase-schema.sql</strong>.</li>
          <li>Completá <strong>config.js</strong> con tu URL, ANON KEY y PIN de papás.</li>
          <li>Subí esta carpeta a GitHub Pages.</li>
        </ol>
        <div class="setup-actions">
          <a class="btn btn-primary" href="./README.md" target="_blank" rel="noreferrer">Ver guía</a>
          <button class="btn btn-ghost" data-copy-config="1">Copiar estructura de config</button>
        </div>
        ${state.setupError ? `<p class="error-text">${escapeHtml(state.setupError)}</p>` : ''}
      </div>
    </section>
  `);
}

function renderHome() {
  const sorted = getSortedPlayers();
  const topThree = sorted.slice(0, 3);
  return `
    <section class="hero-grid">
      <article class="hero-card glass">
        <div class="hero-copy">
          <span class="section-badge">Baby shower game</span>
          <h2>Una app en vivo para jugar, responder y ver quién va puntero</h2>
          <p>Los invitados se registran con nombre y sticker, responden desde el celu y los papás de Felipe Fidel controlan cada ronda. La tele muestra el ranking con movimiento en tiempo real.</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#guest">Entrar como invitado</a>
            <a class="btn btn-soft" href="#board">Pantalla de resultados</a>
            <a class="btn btn-ghost" href="#admin">Perfil de papás de Felipe Fidel</a>
          </div>
        </div>
        <div class="hero-side">
          <div class="mini-stage">
            <div class="mini-stage-title">Top actual</div>
            ${topThree.length ? topThree.map((player, index) => renderTopCard(player, index + 1)).join('') : '<div class="empty-state compact">Todavía no hay ranking cargado.</div>'}
          </div>
        </div>
      </article>

      <article class="info-card glass">
        <h3>Cómo funciona</h3>
        <div class="steps">
          <div class="step"><span>1</span><p>Cada invitado se registra con nombre, sticker y un número de desempate para la medición de la panza.</p></div>
          <div class="step"><span>2</span><p>Los papás abren cada pregunta. En el celu aparece un cuadro grande para escribir solo números.</p></div>
          <div class="step"><span>3</span><p>Al revelar, cada invitado ve cuánto le faltó o cuánto se pasó. La tele muestra ganador y tabla animada.</p></div>
        </div>
      </article>
    </section>
  `;
}

function renderTopCard(player, place) {
  const sticker = stickerMap[player.sticker_id] || STICKERS[0];
  return `
    <div class="top-mini-card">
      <div class="rank-bubble">${place}</div>
      <div class="sticker-chip" style="--sticker-bg:${sticker.colors.bg}; --sticker-soft:${sticker.colors.bgSoft}; --sticker-accent:${sticker.colors.accent};">
        <span>${sticker.emoji}</span>
      </div>
      <div>
        <strong>${escapeHtml(player.name)}</strong>
        <small>${player.points || 0} punto${(player.points || 0) === 1 ? '' : 's'}</small>
      </div>
    </div>
  `;
}

function renderGuestView() {
  const guest = state.players.find((p) => p.id === state.playerId);
  const round = state.game?.current_round || 1;
  const answerEnabled = state.game?.phase === 'collecting';
  const currentGuess = getGuessForPlayerRound(state.playerId, round);

  if (!guest) {
    return `
      <section class="split-layout">
        <article class="panel glass registration-panel">
          <div class="panel-head">
            <span class="section-badge">Invitados</span>
            <h2>Alta para jugar</h2>
            <p>Elegí tu nombre, tu sticker y cargá tu número para el desempate de la medición de la panza.</p>
          </div>
          ${!state.game?.registration_open ? '<div class="notice warning">La inscripción está cerrada por ahora. Cuando los papás la abran, desde acá vas a poder entrar.</div>' : ''}
          <form id="register-form" class="stack-form">
            <label>
              <span>Nombre</span>
              <input name="playerName" maxlength="28" placeholder="Ej: Sofi" required ${!state.game?.registration_open ? 'disabled' : ''} />
            </label>
            <label>
              <span>Desempate · ¿Cuánto medirá la panza?</span>
              <input name="tieGuess" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="Solo números" required ${!state.game?.registration_open ? 'disabled' : ''} />
            </label>
            <div>
              <div class="label-row"><span>Elegí tu sticker</span><small>Hay 50 para elegir</small></div>
              <div class="sticker-grid">
                ${STICKERS.map((sticker) => renderStickerOption(sticker)).join('')}
              </div>
            </div>
            <input type="hidden" name="stickerId" value="${STICKERS[0].id}" />
            <button class="btn btn-primary full" type="submit" ${!state.game?.registration_open ? 'disabled' : ''}>Entrar al juego</button>
          </form>
        </article>
        <aside class="panel glass aside-panel">
          <h3>Así vas a jugar</h3>
          <ul class="pretty-list">
            <li>Vas a responder una pregunta por vez.</li>
            <li>Solo se aceptan números.</li>
            <li>Cuando los papás revelen, te diremos la correcta y la diferencia.</li>
            <li>Si empatás con otra persona, define quién estuvo más cerca de la medición de la panza.</li>
          </ul>
        </aside>
      </section>
    `;
  }

  const sticker = stickerMap[guest.sticker_id] || STICKERS[0];
  const resultCard = renderCurrentRoundResultForGuest(guest, round);
  const topPreview = getSortedPlayers().slice(0, APP_CONFIG.SHOW_TOP_ON_GUEST || 5);

  return `
    <section class="split-layout guest-live-layout">
      <article class="panel glass play-panel">
        <div class="player-header">
          <div class="sticker-chip large" style="--sticker-bg:${sticker.colors.bg}; --sticker-soft:${sticker.colors.bgSoft}; --sticker-accent:${sticker.colors.accent};"><span>${sticker.emoji}</span></div>
          <div>
            <span class="section-badge">Hola, ${escapeHtml(guest.name)}</span>
            <h2>Pregunta ${round}</h2>
            <p>${answerEnabled ? 'Ya podés responder. Guardá tu número cuando quieras.' : labelGuestStatus()}</p>
          </div>
        </div>

        <div class="answer-panel ${answerEnabled ? 'enabled' : 'disabled'}">
          <div class="answer-caption">Tu respuesta numérica</div>
          <form id="answer-form" class="answer-form">
            <input id="answerInput" name="answerValue" class="mega-input" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" value="${currentGuess?.guess_value ?? ''}" ${answerEnabled ? '' : 'disabled'} />
            <button class="btn btn-primary answer-btn" type="submit" ${answerEnabled ? '' : 'disabled'}>${currentGuess ? 'Actualizar respuesta' : 'Enviar respuesta'}</button>
          </form>
        </div>

        <div class="live-feedback-row">
          <div class="live-kpi glass-soft"><strong>${currentGuess?.guess_value ?? '—'}</strong><span>Tu número cargado</span></div>
          <div class="live-kpi glass-soft"><strong>${countCurrentRoundResponses()}</strong><span>Respuestas recibidas</span></div>
          <div class="live-kpi glass-soft"><strong>${state.players.length}</strong><span>Invitados jugando</span></div>
        </div>

        ${resultCard}
      </article>

      <aside class="panel glass aside-panel">
        <h3>Ranking parcial</h3>
        <div class="top-preview-list">
          ${topPreview.length ? topPreview.map((player, index) => renderPreviewRank(player, index + 1)).join('') : '<div class="empty-state compact">Todavía nadie sumó puntos.</div>'}
        </div>
      </aside>
    </section>
  `;
}

function renderStickerOption(sticker) {
  return `
    <button type="button" class="sticker-option ${sticker.id === STICKERS[0].id ? 'selected' : ''}" data-sticker-id="${sticker.id}" style="--sticker-bg:${sticker.colors.bg}; --sticker-soft:${sticker.colors.bgSoft}; --sticker-accent:${sticker.colors.accent};">
      <span class="sticker-emoji">${sticker.emoji}</span>
      <span class="sticker-name">${escapeHtml(sticker.label)}</span>
    </button>
  `;
}

function renderCurrentRoundResultForGuest(guest, round) {
  const currentResult = state.game?.current_result;
  const currentGuess = getGuessForPlayerRound(guest.id, round);

  if (state.game?.phase !== 'revealed' || !currentResult) {
    return `
      <section class="result-panel muted">
        <h3>Resultado de la ronda</h3>
        <p>Cuando los papás revelen la respuesta, acá vas a ver el número correcto, tu diferencia y quién ganó la pregunta.</p>
      </section>
    `;
  }

  if (!currentGuess) {
    return `
      <section class="result-panel muted">
        <h3>Resultado revelado</h3>
        <p>En esta ronda no cargaste respuesta.</p>
        <div class="result-pill-row"><span class="result-pill">Correcta: ${currentResult.correctAnswer}</span></div>
      </section>
    `;
  }

  const signedDiff = Number(currentGuess.signed_diff ?? Number(currentGuess.guess_value) - Number(currentResult.correctAnswer));
  const exact = signedDiff === 0;
  const didWin = currentResult.winnerId === guest.id;

  return `
    <section class="result-panel ${didWin ? 'winner' : ''}">
      <div class="result-title-row">
        <h3>${didWin ? '¡Ganaste esta pregunta!' : 'Respuesta revelada'}</h3>
        <span class="result-pill ${didWin ? 'winner' : ''}">Correcta: ${currentResult.correctAnswer}</span>
      </div>
      <div class="result-stats">
        <div class="result-stat"><strong>${currentGuess.guess_value}</strong><span>Tu respuesta</span></div>
        <div class="result-stat"><strong>${exact ? '0' : Math.abs(signedDiff)}</strong><span>Diferencia</span></div>
        <div class="result-stat"><strong>${didWin ? '+1' : '—'}</strong><span>Puntos esta ronda</span></div>
      </div>
      <p class="result-copy">${exact ? 'La pegaste exacta.' : signedDiff > 0 ? `Te pasaste por ${Math.abs(signedDiff)}.` : `Te faltaron ${Math.abs(signedDiff)}.`} ${didWin ? 'Te llevaste el punto de esta ronda.' : `Ganó ${escapeHtml(currentResult.winnerName)}.`}</p>
    </section>
  `;
}

function renderPreviewRank(player, index) {
  const sticker = stickerMap[player.sticker_id] || STICKERS[0];
  return `
    <div class="preview-rank-row">
      <span class="preview-rank-index">${index}</span>
      <div class="sticker-chip small" style="--sticker-bg:${sticker.colors.bg}; --sticker-soft:${sticker.colors.bgSoft}; --sticker-accent:${sticker.colors.accent};"><span>${sticker.emoji}</span></div>
      <div class="preview-rank-name">${escapeHtml(player.name)}</div>
      <strong>${player.points || 0}</strong>
    </div>
  `;
}

function renderAdminView() {
  if (!state.adminAuthed) {
    return `
      <section class="centered-card">
        <article class="panel glass admin-login-panel">
          <span class="section-badge">Perfil de papás de Felipe Fidel</span>
          <h2>Ingresar al panel de control</h2>
          <p>Desde acá abren cada pregunta, revelan resultados y controlan el ranking en vivo.</p>
          <form id="admin-login-form" class="stack-form compact">
            <label>
              <span>PIN de acceso</span>
              <input name="adminPin" type="password" placeholder="Ingresá el PIN" required />
            </label>
            <button class="btn btn-primary full" type="submit">Entrar</button>
          </form>
        </article>
      </section>
    `;
  }

  const round = state.game?.current_round || 1;
  const currentAnswer = APP_CONFIG.QUESTIONS[round - 1];
  const roundGuesses = getCurrentRoundGuesses();
  const revealedList = getRoundResolvedList(round, currentAnswer);

  return `
    <section class="admin-grid">
      <article class="panel glass admin-main-panel">
        <div class="panel-head inline-head">
          <div>
            <span class="section-badge">Control general</span>
            <h2>Pregunta ${round} de ${TOTAL_QUESTIONS}</h2>
            <p>Los papás habilitan, revelan y avanzan la partida desde acá.</p>
          </div>
          <button class="btn btn-ghost" data-admin-logout="1">Salir</button>
        </div>

        <div class="admin-kpis">
          <div class="kpi-card glass-soft"><strong>${state.players.length}</strong><span>Invitados</span></div>
          <div class="kpi-card glass-soft"><strong>${countCurrentRoundResponses()}</strong><span>Respuestas cargadas</span></div>
          <div class="kpi-card glass-soft"><strong>${state.game?.belly_actual ?? '—'}</strong><span>Medición real panza</span></div>
        </div>

        <div class="control-group glass-soft">
          <div class="label-row"><span>Registro de invitados</span><small>Abrir o cerrar altas</small></div>
          <div class="action-row">
            <button class="btn ${state.game?.registration_open ? 'btn-soft' : 'btn-primary'}" data-toggle-registration="1">${state.game?.registration_open ? 'Cerrar inscripción' : 'Abrir inscripción'}</button>
            <button class="btn btn-ghost" data-reset-event="1">Reiniciar evento completo</button>
          </div>
        </div>

        <form id="belly-form" class="control-group glass-soft inline-form">
          <div>
            <div class="label-row"><span>Desempate por medición de la panza</span><small>Se usa solo si hay empate</small></div>
            <input name="bellyActual" type="text" inputmode="numeric" pattern="[0-9]*" value="${state.game?.belly_actual ?? ''}" placeholder="Ej: 104" />
          </div>
          <button class="btn btn-soft" type="submit">Guardar medida real</button>
        </form>

        <div class="control-group glass-soft">
          <div class="label-row"><span>Control de ronda</span><small>Respuesta correcta de esta pregunta: ${currentAnswer}</small></div>
          <div class="action-row wrap">
            ${state.game?.phase !== 'collecting' ? `<button class="btn btn-primary" data-open-round="${round}">Abrir pregunta ${round}</button>` : `<button class="btn btn-primary" data-reveal-round="${round}">Revelar resultado</button>`}
            ${round < TOTAL_QUESTIONS ? `<button class="btn btn-soft" data-next-round="1">Pasar a pregunta ${round + 1}</button>` : ''}
            <button class="btn btn-ghost" data-open-board="1">Abrir pantalla de TV</button>
          </div>
        </div>

        <div class="control-group glass-soft">
          <div class="label-row"><span>Respuestas de la ronda</span><small>${state.game?.phase === 'revealed' ? 'Ordenadas por cercanía' : 'Listado recibido hasta ahora'}</small></div>
          <div class="answers-list">
            ${state.game?.phase === 'revealed'
              ? (revealedList.length ? revealedList.map((entry, index) => renderAdminResolvedRow(entry, index + 1)).join('') : '<div class="empty-state compact">Todavía no hay respuestas cargadas.</div>')
              : (roundGuesses.length ? roundGuesses.map((guess) => renderAdminGuessRow(guess)).join('') : '<div class="empty-state compact">Todavía nadie respondió esta pregunta.</div>')}
          </div>
        </div>
      </article>

      <aside class="panel glass admin-side-panel">
        <h3>Tabla de posiciones</h3>
        <div class="mini-scoreboard">
          ${getSortedPlayers().length ? getSortedPlayers().map((player, index) => renderScoreboardRow(player, index + 1)).join('') : '<div class="empty-state compact">Sin puntos por ahora.</div>'}
        </div>
      </aside>
    </section>
  `;
}

function renderAdminGuessRow(guess) {
  const player = state.players.find((p) => p.id === guess.player_id);
  if (!player) return '';
  const sticker = stickerMap[player.sticker_id] || STICKERS[0];
  return `
    <div class="answer-row">
      <div class="answer-player">
        <div class="sticker-chip tiny" style="--sticker-bg:${sticker.colors.bg}; --sticker-soft:${sticker.colors.bgSoft}; --sticker-accent:${sticker.colors.accent};"><span>${sticker.emoji}</span></div>
        <span>${escapeHtml(player.name)}</span>
      </div>
      <strong>${guess.guess_value}</strong>
    </div>
  `;
}

function renderAdminResolvedRow(entry, index) {
  const player = state.players.find((p) => p.id === entry.player_id);
  if (!player) return '';
  const sticker = stickerMap[player.sticker_id] || STICKERS[0];
  const lead = index === 1 ? 'winner-mark' : '';
  return `
    <div class="answer-row ${lead}">
      <div class="answer-player">
        <span class="answer-place">${index}</span>
        <div class="sticker-chip tiny" style="--sticker-bg:${sticker.colors.bg}; --sticker-soft:${sticker.colors.bgSoft}; --sticker-accent:${sticker.colors.accent};"><span>${sticker.emoji}</span></div>
        <span>${escapeHtml(player.name)}</span>
      </div>
      <div class="resolved-meta">
        <strong>${entry.guess_value}</strong>
        <small>${describeSignedDiff(entry.signed_diff)}</small>
      </div>
    </div>
  `;
}

function renderScoreboardRow(player, place) {
  const sticker = stickerMap[player.sticker_id] || STICKERS[0];
  return `
    <div class="score-mini-row">
      <span class="score-mini-place">${place}</span>
      <div class="sticker-chip tiny" style="--sticker-bg:${sticker.colors.bg}; --sticker-soft:${sticker.colors.bgSoft}; --sticker-accent:${sticker.colors.accent};"><span>${sticker.emoji}</span></div>
      <span class="score-mini-name">${escapeHtml(player.name)}</span>
      <strong>${player.points || 0}</strong>
    </div>
  `;
}

function renderBoardView() {
  const round = state.game?.current_round || 1;
  const currentResult = state.game?.current_result;
  const ranking = getSortedPlayers();
  const winnerPlayer = currentResult?.winnerId ? state.players.find((player) => player.id === currentResult.winnerId) : null;
  const winnerSticker = winnerPlayer ? stickerMap[winnerPlayer.sticker_id] || STICKERS[0] : null;

  return `
    <section class="board-layout">
      <article class="board-hero glass">
        <div>
          <span class="section-badge">Pantalla de resultados</span>
          <h2>Pregunta ${round}</h2>
          <p>${state.game?.phase === 'revealed' ? `Respuesta correcta: ${currentResult?.correctAnswer}` : 'Esperando que los papás revelen la respuesta.'}</p>
        </div>
        <div class="board-state-badge ${state.game?.phase || 'waiting'}">${labelPhase(state.game?.phase)}</div>
      </article>

      <section class="board-grid">
        <article class="board-winner glass ${state.game?.phase === 'revealed' && winnerPlayer ? 'live' : ''}">
          ${state.game?.phase === 'revealed' && winnerPlayer ? `
            <div class="winner-topline">Ganó esta pregunta</div>
            <div class="winner-sticker" style="--sticker-bg:${winnerSticker.colors.bg}; --sticker-soft:${winnerSticker.colors.bgSoft}; --sticker-accent:${winnerSticker.colors.accent};"><span>${winnerSticker.emoji}</span></div>
            <h3>${escapeHtml(winnerPlayer.name)}</h3>
            <p>${describeSignedDiff(currentResult.signedDiff)} · +1 punto</p>
          ` : `
            <div class="winner-placeholder">
              <div class="winner-topline">Todavía sin ganador</div>
              <h3>Ranking en espera</h3>
              <p>Cuando se revele la pregunta, acá aparece quién estuvo más cerca.</p>
            </div>
          `}
        </article>

        <article class="board-score glass">
          <div class="board-score-head">
            <h3>Tabla de posiciones</h3>
            <small>Se ordena automáticamente y anima cada subida o bajada.</small>
          </div>
          <div id="leaderboard" class="leaderboard-list">
            ${ranking.length ? ranking.map((player, index) => renderBoardRow(player, index + 1)).join('') : '<div class="empty-state">Esperando jugadores.</div>'}
          </div>
        </article>
      </section>
    </section>
  `;
}

function renderBoardRow(player, place) {
  const sticker = stickerMap[player.sticker_id] || STICKERS[0];
  const tieDiff = tieBreakDistance(player);
  return `
    <div class="leader-row" data-player-id="${player.id}">
      <div class="leader-left">
        <div class="leader-place">${place}</div>
        <div class="sticker-chip board" style="--sticker-bg:${sticker.colors.bg}; --sticker-soft:${sticker.colors.bgSoft}; --sticker-accent:${sticker.colors.accent};"><span>${sticker.emoji}</span></div>
        <div class="leader-meta">
          <strong>${escapeHtml(player.name)}</strong>
          <small>${Number.isFinite(tieDiff) ? `Desempate panza: ${tieDiff}` : 'Desempate sin medir'}</small>
        </div>
      </div>
      <div class="leader-points">${player.points || 0}</div>
    </div>
  `;
}

function bindCommonEvents() {
  document.querySelectorAll('[data-sticker-id]').forEach((button) => {
    button.addEventListener('click', () => selectSticker(button.dataset.stickerId));
  });

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', onRegisterPlayer);
  }

  const answerForm = document.getElementById('answer-form');
  if (answerForm) {
    answerForm.addEventListener('submit', onSubmitAnswer);
  }

  const adminLoginForm = document.getElementById('admin-login-form');
  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', onAdminLogin);
  }

  const bellyForm = document.getElementById('belly-form');
  if (bellyForm) {
    bellyForm.addEventListener('submit', onSaveBellyActual);
  }

  document.querySelectorAll('input[inputmode="numeric"]').forEach((input) => {
    input.addEventListener('input', () => {
      input.value = (input.value || '').replace(/\D+/g, '');
    });
  });

  document.querySelector('[data-toggle-registration="1"]')?.addEventListener('click', onToggleRegistration);
  document.querySelector('[data-reset-event="1"]')?.addEventListener('click', onResetEvent);
  document.querySelector('[data-admin-logout="1"]')?.addEventListener('click', onAdminLogout);
  document.querySelector('[data-open-board="1"]')?.addEventListener('click', () => {
    window.open(`${window.location.origin}${window.location.pathname}#board`, '_blank');
  });

  document.querySelector('[data-copy-config="1"]')?.addEventListener('click', async () => {
    const snippet = `export const APP_CONFIG = {\n  EVENT_NAME: 'Felipe Fidel · Baby Shower Quiz',\n  EVENT_SUBTITLE: '¿Quién estuvo más cerca?',\n  ADMIN_PIN: 'FELI2026',\n  SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',\n  SUPABASE_ANON_KEY: 'TU_ANON_KEY',\n  QUESTIONS: [40, 44, 2013, 18299, 1934, 2001, 7, 151, 7, 39, 700, 3350],\n  SHOW_TOP_ON_GUEST: 5\n};`;
    try {
      await navigator.clipboard.writeText(snippet);
      toast('Copié la estructura de config.');
    } catch {
      toast('No pude copiarla automáticamente.');
    }
  });

  const openRoundButton = document.querySelector('[data-open-round]');
  if (openRoundButton) openRoundButton.addEventListener('click', onOpenRound);

  const revealRoundButton = document.querySelector('[data-reveal-round]');
  if (revealRoundButton) revealRoundButton.addEventListener('click', onRevealRound);

  const nextRoundButton = document.querySelector('[data-next-round="1"]');
  if (nextRoundButton) nextRoundButton.addEventListener('click', onNextRound);
}

function selectSticker(stickerId) {
  const hidden = document.querySelector('input[name="stickerId"]');
  if (hidden) hidden.value = stickerId;
  document.querySelectorAll('.sticker-option').forEach((button) => {
    button.classList.toggle('selected', button.dataset.stickerId === stickerId);
  });
}

async function onRegisterPlayer(event) {
  event.preventDefault();
  if (state.busy || !state.game?.registration_open) return;
  state.busy = true;

  const formData = new FormData(event.currentTarget);
  const name = String(formData.get('playerName') || '').trim();
  const tieGuess = String(formData.get('tieGuess') || '').replace(/\D+/g, '');
  const stickerId = String(formData.get('stickerId') || STICKERS[0].id);

  if (!name) {
    toast('Escribí un nombre para jugar.');
    state.busy = false;
    return;
  }

  if (!tieGuess) {
    toast('Necesitamos el número para el desempate de la panza.');
    state.busy = false;
    return;
  }

  const exists = state.players.some((player) => player.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    toast('Ese nombre ya está usado. Probá con nombre y apellido o un apodo.');
    state.busy = false;
    return;
  }

  const { data, error } = await supabase
    .from('players')
    .insert({
      name,
      sticker_id: stickerId,
      tie_break_guess: Number(tieGuess),
      points: 0
    })
    .select()
    .single();

  state.busy = false;

  if (error || !data) {
    toast('No pude darte de alta.');
    return;
  }

  state.playerId = data.id;
  localStorage.setItem(STORAGE_KEYS.playerId, data.id);
  window.location.hash = 'guest';
  toast('¡Ya estás adentro del juego!');
}

async function onSubmitAnswer(event) {
  event.preventDefault();
  if (state.busy || !state.playerId || state.game?.phase !== 'collecting') return;
  state.busy = true;

  const formData = new FormData(event.currentTarget);
  const raw = String(formData.get('answerValue') || '').replace(/\D+/g, '');
  if (!raw) {
    toast('Escribí un número antes de enviar.');
    state.busy = false;
    return;
  }

  const payload = {
    player_id: state.playerId,
    round_number: state.game.current_round,
    guess_value: Number(raw)
  };

  const { error } = await supabase.from('guesses').upsert(payload, { onConflict: 'player_id,round_number' });
  state.busy = false;

  if (error) {
    toast('No pude guardar tu respuesta.');
    return;
  }

  toast('Respuesta guardada.');
}

function onAdminLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const pin = String(formData.get('adminPin') || '');
  if (pin !== APP_CONFIG.ADMIN_PIN) {
    toast('PIN incorrecto.');
    return;
  }
  state.adminAuthed = true;
  localStorage.setItem(STORAGE_KEYS.adminAuth, '1');
  render();
}

async function onSaveBellyActual(event) {
  event.preventDefault();
  if (state.busy) return;
  state.busy = true;
  const formData = new FormData(event.currentTarget);
  const raw = String(formData.get('bellyActual') || '').replace(/\D+/g, '');
  const { error } = await supabase.from('game_state').update({ belly_actual: raw ? Number(raw) : null }).eq('id', 1);
  state.busy = false;
  if (error) {
    toast('No pude guardar la medición real.');
    return;
  }
  toast('Medición real guardada.');
}

async function onToggleRegistration() {
  if (state.busy) return;
  state.busy = true;
  const { error } = await supabase
    .from('game_state')
    .update({ registration_open: !state.game?.registration_open })
    .eq('id', 1);
  state.busy = false;
  if (error) {
    toast('No pude cambiar la inscripción.');
    return;
  }
  toast(state.game?.registration_open ? 'Inscripción cerrada.' : 'Inscripción abierta.');
}

async function onOpenRound() {
  if (state.busy) return;
  state.busy = true;
  const round = Number(document.querySelector('[data-open-round]')?.dataset.openRound || state.game?.current_round || 1);
  const { error } = await supabase
    .from('game_state')
    .update({ phase: 'collecting', current_round: round, current_result: null })
    .eq('id', 1);
  state.busy = false;
  if (error) {
    toast('No pude abrir la ronda.');
    return;
  }
  toast(`Pregunta ${round} habilitada.`);
}

async function onRevealRound() {
  if (state.busy) return;
  const round = Number(document.querySelector('[data-reveal-round]')?.dataset.revealRound || state.game?.current_round || 1);
  const correctAnswer = APP_CONFIG.QUESTIONS[round - 1];
  const roundGuesses = state.guesses.filter((guess) => Number(guess.round_number) === round);

  if (!roundGuesses.length) {
    toast('No hay respuestas cargadas para esta pregunta.');
    return;
  }

  state.busy = true;

  const resolved = roundGuesses
    .map((guess) => {
      const player = state.players.find((entry) => entry.id === guess.player_id);
      const signedDiff = Number(guess.guess_value) - Number(correctAnswer);
      return {
        ...guess,
        player,
        signed_diff: signedDiff,
        absolute_diff: Math.abs(signedDiff),
        tie_break_distance: player ? tieBreakDistance(player) : Number.POSITIVE_INFINITY
      };
    })
    .sort((a, b) => {
      if (a.absolute_diff !== b.absolute_diff) return a.absolute_diff - b.absolute_diff;
      if (a.tie_break_distance !== b.tie_break_distance) return a.tie_break_distance - b.tie_break_distance;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const winner = resolved[0];
  const winnerPlayer = winner.player;

  const guessUpdates = resolved.map((entry) =>
    supabase
      .from('guesses')
      .update({ signed_diff: entry.signed_diff, absolute_diff: entry.absolute_diff })
      .eq('id', entry.id)
  );

  const playerPoints = (winnerPlayer?.points || 0) + 1;
  const resultPayload = {
    correctAnswer,
    winnerId: winnerPlayer?.id || null,
    winnerName: winnerPlayer?.name || 'Sin ganador',
    winnerAnswer: winner.guess_value,
    signedDiff: winner.signed_diff,
    absoluteDiff: winner.absolute_diff,
    tieBreakDistance: Number.isFinite(winner.tie_break_distance) ? winner.tie_break_distance : null
  };

  const operations = [
    ...guessUpdates,
    supabase.from('game_state').update({ phase: 'revealed', current_result: resultPayload }).eq('id', 1)
  ];

  if (winnerPlayer) {
    operations.push(supabase.from('players').update({ points: playerPoints }).eq('id', winnerPlayer.id));
  }

  const results = await Promise.all(operations);
  state.busy = false;

  if (results.some((entry) => entry.error)) {
    toast('No pude revelar la ronda correctamente.');
    return;
  }

  toast(`Ganó ${winnerPlayer?.name || 'nadie'} en la pregunta ${round}.`);
}

async function onNextRound() {
  if (state.busy) return;
  const next = Math.min((state.game?.current_round || 1) + 1, TOTAL_QUESTIONS);
  if (next === state.game?.current_round && state.game?.current_round === TOTAL_QUESTIONS) {
    toast('Ya están en la última pregunta.');
    return;
  }
  state.busy = true;
  const { error } = await supabase
    .from('game_state')
    .update({ current_round: next, phase: 'waiting', current_result: null })
    .eq('id', 1);
  state.busy = false;
  if (error) {
    toast('No pude pasar a la siguiente pregunta.');
    return;
  }
  toast(`Listo, quedó preparada la pregunta ${next}.`);
}

async function onResetEvent() {
  const confirmed = window.confirm('Esto borra invitados, respuestas y puntajes. ¿Querés reiniciar todo el evento?');
  if (!confirmed || state.busy) return;
  state.busy = true;

  const results = await Promise.all([
    supabase.from('guesses').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase
      .from('game_state')
      .update({
        phase: 'waiting',
        current_round: 1,
        current_result: null,
        registration_open: true,
        belly_actual: null
      })
      .eq('id', 1)
  ]);

  state.busy = false;
  localStorage.removeItem(STORAGE_KEYS.playerId);
  state.playerId = '';

  if (results.some((entry) => entry.error)) {
    toast('No pude reiniciar el evento.');
    return;
  }

  toast('Evento reiniciado.');
}

function onAdminLogout() {
  state.adminAuthed = false;
  localStorage.removeItem(STORAGE_KEYS.adminAuth);
  render();
}

function getGuessForPlayerRound(playerId, round) {
  return state.guesses.find((guess) => guess.player_id === playerId && Number(guess.round_number) === Number(round));
}

function getCurrentRoundGuesses() {
  const round = state.game?.current_round || 1;
  return state.guesses
    .filter((guess) => Number(guess.round_number) === Number(round))
    .map((guess) => ({
      ...guess,
      player: state.players.find((player) => player.id === guess.player_id)
    }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

function getRoundResolvedList(round, answer) {
  return state.guesses
    .filter((guess) => Number(guess.round_number) === Number(round))
    .map((guess) => ({
      ...guess,
      signed_diff: Number(guess.signed_diff ?? Number(guess.guess_value) - Number(answer)),
      absolute_diff: Number(guess.absolute_diff ?? Math.abs(Number(guess.guess_value) - Number(answer))),
      tie_break_distance: tieBreakDistance(state.players.find((player) => player.id === guess.player_id))
    }))
    .sort((a, b) => {
      if (a.absolute_diff !== b.absolute_diff) return a.absolute_diff - b.absolute_diff;
      if (a.tie_break_distance !== b.tie_break_distance) return a.tie_break_distance - b.tie_break_distance;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
}

function countCurrentRoundResponses() {
  const round = state.game?.current_round || 1;
  return state.guesses.filter((guess) => Number(guess.round_number) === Number(round)).length;
}

function getSortedPlayers() {
  return [...state.players].sort((a, b) => {
    const pointsA = a.points || 0;
    const pointsB = b.points || 0;
    if (pointsA !== pointsB) return pointsB - pointsA;
    const tieA = tieBreakDistance(a);
    const tieB = tieBreakDistance(b);
    if (tieA !== tieB) return tieA - tieB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function tieBreakDistance(player) {
  if (!player || state.game?.belly_actual === null || state.game?.belly_actual === undefined || player.tie_break_guess === null || player.tie_break_guess === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(Number(player.tie_break_guess) - Number(state.game.belly_actual));
}

function labelPhase(phase) {
  switch (phase) {
    case 'collecting':
      return 'Recibiendo respuestas';
    case 'revealed':
      return 'Respuesta revelada';
    default:
      return 'Esperando apertura';
  }
}

function labelGuestStatus() {
  if (state.game?.phase === 'revealed') return 'La respuesta ya fue revelada. Mirá tu resultado abajo.';
  return 'Esperando que los papás habiliten esta pregunta.';
}

function describeSignedDiff(value) {
  const signed = Number(value || 0);
  if (signed === 0) return 'respuesta exacta';
  if (signed > 0) return `${Math.abs(signed)} por arriba`;
  return `${Math.abs(signed)} por abajo`;
}

function animateLeaderboard() {
  const container = document.getElementById('leaderboard');
  if (!container) return;

  const items = Array.from(container.querySelectorAll('.leader-row'));
  items.forEach((item) => {
    const id = item.dataset.playerId;
    const old = scoreboardAnimState.get(id);
    const nextTop = item.getBoundingClientRect().top;
    if (old !== undefined) {
      const delta = old - nextTop;
      if (delta) {
        item.animate(
          [
            { transform: `translateY(${delta}px) scale(1.02)` },
            { transform: 'translateY(0) scale(1)' }
          ],
          {
            duration: 520,
            easing: 'cubic-bezier(.2,.8,.2,1)'
          }
        );
      }
    }
    scoreboardAnimState.set(id, nextTop);
  });
}

function toast(message) {
  const previous = document.querySelector('.toast');
  if (previous) previous.remove();
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.classList.add('visible'), 10);
  setTimeout(() => {
    node.classList.remove('visible');
    setTimeout(() => node.remove(), 280);
  }, 2400);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
