const navToggle = document.querySelector('.nav-toggle');
const siteHeader = document.querySelector('.site-header');
const navLinks = document.querySelectorAll('.site-nav a');
const yearNode = document.querySelector('#current-year');

const canvas = document.querySelector('#game-canvas');
const scoreNode = document.querySelector('#score');
const bestScoreNode = document.querySelector('#best-score');
const statusNode = document.querySelector('#game-status');
const comboNode = document.querySelector('#combo-count');
const levelNode = document.querySelector('#level-display');
const powerNode = document.querySelector('#power-display');
const progressLabelNode = document.querySelector('#score-progress-label');
const progressFillNode = document.querySelector('#score-progress-fill');
const difficultyLabelNode = document.querySelector('#difficulty-label');
const difficultyFillNode = document.querySelector('#difficulty-fill');
const rankingListNode = document.querySelector('#ranking-list');
const soundToggle = document.querySelector('#sound-toggle');
const difficultyButtons = document.querySelectorAll('.difficulty-btn');
const dirButtons = document.querySelectorAll('.dir-btn');
const actionButtons = document.querySelectorAll('.action-btn');

const BOARD_SIZE = 20;
const STORAGE_KEY = 'twlee1-snake-best-score';
const RANKING_STORAGE_KEY = 'twlee1-snake-rankings';
const POWERUP_INTERVAL = 4;
const POWERUP_DURATION_MS = 6000;
const COMBO_WINDOW_MS = 2800;

const difficultyConfig = {
  easy: {
    label: 'Easy',
    baseStep: 145,
    enemyStep: 320,
    startEnemies: 1,
    maxEnemies: 3,
    fill: 34,
  },
  normal: {
    label: 'Normal',
    baseStep: 125,
    enemyStep: 260,
    startEnemies: 1,
    maxEnemies: 4,
    fill: 62,
  },
  hard: {
    label: 'Hard',
    baseStep: 105,
    enemyStep: 210,
    startEnemies: 2,
    maxEnemies: 5,
    fill: 88,
  },
};

let canvasState = {
  ctx: null,
  size: 480,
  cell: 24,
  dpr: 1,
};

let audioState = {
  enabled: false,
  ctx: null,
};

let game = createGameState();
let rafId = null;
let lastTime = 0;
let accumulator = 0;
let enemyAccumulator = 0;
let effectAccumulator = 0;

function createGameState() {
  return {
    running: false,
    paused: false,
    gameOver: false,
    score: 0,
    best: readBestScore(),
    rankings: readRankings(),
    difficulty: 'normal',
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    snake: [
      { x: 9, y: 10 },
      { x: 8, y: 10 },
      { x: 7, y: 10 },
    ],
    food: { x: 14, y: 10, type: 'apple' },
    enemies: [],
    message: 'Ready',
    combo: 1,
    comboTimer: 0,
    level: 1,
    particles: [],
    powerUp: null,
    powerTimer: 0,
    nextFoodCount: 0,
  };
}

function readBestScore() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return Number.parseInt(value || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function writeBestScore(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Ignore storage failures.
  }
}

function readRankings() {
  try {
    const raw = window.localStorage.getItem(RANKING_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => Number.isFinite(value)) : [];
  } catch {
    return [];
  }
}

function writeRankings(rankings) {
  try {
    window.localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(rankings));
  } catch {
    // Ignore storage failures.
  }
}

function ensureAudioContext() {
  if (!audioState.enabled) {
    return null;
  }
  if (!audioState.ctx) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }
    audioState.ctx = new AudioContextCtor();
  }
  return audioState.ctx;
}

function playTone(frequency, duration, type = 'sine', gainValue = 0.028) {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gainNode.gain.value = gainValue;
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  const now = ctx.currentTime;
  gainNode.gain.setValueAtTime(gainValue, now);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function addParticles(x, y, color, count = 12) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.35;
    game.particles.push({
      x: x + 0.5,
      y: y + 0.5,
      vx: Math.cos(angle) * (0.03 + Math.random() * 0.05),
      vy: Math.sin(angle) * (0.03 + Math.random() * 0.05),
      life: 600 + Math.random() * 260,
      age: 0,
      color,
    });
  }
}

function updateRankings(score) {
  if (score <= 0) {
    return;
  }
  const rankings = [...game.rankings, score]
    .sort((left, right) => right - left)
    .slice(0, 5);
  game.rankings = rankings;
  writeRankings(rankings);
}

function getLevelTarget(level) {
  return level * 5;
}

function getCurrentDifficultyConfig() {
  return difficultyConfig[game.difficulty];
}

function getSnakeStepMs() {
  const config = getCurrentDifficultyConfig();
  const levelBonus = Math.max(0, game.level - 1) * 4;
  const powerBonus = game.powerUp && game.powerUp.type === 'star' ? -18 : 0;
  return Math.max(65, config.baseStep - levelBonus + powerBonus);
}

function getEnemyStepMs() {
  const config = getCurrentDifficultyConfig();
  const levelBonus = Math.max(0, game.level - 1) * 6;
  return Math.max(120, config.enemyStep - levelBonus);
}

function getEnemyTargetCount() {
  const config = getCurrentDifficultyConfig();
  return Math.min(config.maxEnemies, config.startEnemies + Math.floor((game.level - 1) / 2));
}

function syncRankingBoard() {
  if (!rankingListNode) {
    return;
  }
  rankingListNode.innerHTML = '';
  if (game.rankings.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'No runs yet.';
    rankingListNode.append(empty);
    return;
  }
  game.rankings.forEach((score, index) => {
    const item = document.createElement('li');
    item.textContent = `#${index + 1}  ${score} pts`;
    rankingListNode.append(item);
  });
}

function syncHud() {
  if (scoreNode) {
    scoreNode.textContent = String(game.score);
  }
  if (bestScoreNode) {
    bestScoreNode.textContent = String(game.best);
  }
  if (statusNode) {
    statusNode.textContent = game.message;
  }
  if (comboNode) {
    comboNode.textContent = `x${game.combo}`;
  }
  if (levelNode) {
    levelNode.textContent = `Lv.${game.level}`;
  }
  if (powerNode) {
    powerNode.textContent = game.powerUp ? 'Star' : 'None';
  }
  const target = getLevelTarget(game.level);
  const current = game.score % target;
  if (progressLabelNode) {
    progressLabelNode.textContent = `${current} / ${target}`;
  }
  if (progressFillNode) {
    progressFillNode.style.width = `${Math.min(100, (current / target) * 100)}%`;
  }
  const config = getCurrentDifficultyConfig();
  if (difficultyLabelNode) {
    difficultyLabelNode.textContent = config.label;
  }
  if (difficultyFillNode) {
    const fill = Math.min(100, config.fill + (game.level - 1) * 6);
    difficultyFillNode.style.width = `${fill}%`;
  }
  difficultyButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.difficulty === game.difficulty);
  });
  if (soundToggle) {
    soundToggle.textContent = audioState.enabled ? 'Sound On' : 'Sound Off';
    soundToggle.setAttribute('aria-pressed', String(audioState.enabled));
    soundToggle.classList.toggle('is-on', audioState.enabled);
  }
  syncRankingBoard();
}

function setMessage(message) {
  game.message = message;
  syncHud();
}

function setNavOpen(open) {
  if (!siteHeader || !navToggle) {
    return;
  }
  siteHeader.dataset.navOpen = String(open);
  navToggle.setAttribute('aria-expanded', String(open));
}

function toggleNav() {
  if (!siteHeader) {
    return;
  }
  setNavOpen(siteHeader.dataset.navOpen !== 'true');
}

function createEnemy() {
  const occupied = new Set(game.snake.map((segment) => `${segment.x},${segment.y}`));
  game.enemies.forEach((enemy) => occupied.add(`${enemy.x},${enemy.y}`));

  let cell;
  do {
    cell = {
      x: Math.floor(Math.random() * BOARD_SIZE),
      y: Math.floor(Math.random() * BOARD_SIZE),
    };
  } while (
    occupied.has(`${cell.x},${cell.y}`) ||
    (game.food && cell.x === game.food.x && cell.y === game.food.y)
  );

  const directionPool = [
    { xDir: 1, yDir: 0 },
    { xDir: -1, yDir: 0 },
    { xDir: 0, yDir: 1 },
    { xDir: 0, yDir: -1 },
  ];
  return { ...cell, ...directionPool[Math.floor(Math.random() * directionPool.length)] };
}

function spawnFood() {
  const occupied = new Set([
    ...game.snake.map((segment) => `${segment.x},${segment.y}`),
    ...game.enemies.map((enemy) => `${enemy.x},${enemy.y}`),
  ]);

  let cell;
  do {
    cell = {
      x: Math.floor(Math.random() * BOARD_SIZE),
      y: Math.floor(Math.random() * BOARD_SIZE),
    };
  } while (occupied.has(`${cell.x},${cell.y}`));

  const type = game.nextFoodCount > 0 && game.nextFoodCount % POWERUP_INTERVAL === 0 ? 'star' : 'apple';
  return { ...cell, type };
}

function setDifficulty(difficulty) {
  if (!(difficulty in difficultyConfig)) {
    return;
  }
  game.difficulty = difficulty;
  syncHud();
}

function resetGameState() {
  const best = game.best;
  const rankings = game.rankings;
  const difficulty = game.difficulty;
  game = createGameState();
  game.best = best;
  game.rankings = rankings;
  game.difficulty = difficulty;
  game.enemies = [];
  while (game.enemies.length < getEnemyTargetCount()) {
    game.enemies.push(createEnemy());
  }
  game.food = spawnFood();
  game.nextFoodCount = 1;
  accumulator = 0;
  enemyAccumulator = 0;
  effectAccumulator = 0;
  syncHud();
  render();
}

function startGame() {
  if (game.gameOver) {
    resetGameState();
  }
  if (game.running && !game.paused) {
    return;
  }
  game.running = true;
  game.paused = false;
  setMessage('Running');
  if (!rafId) {
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }
}

function togglePause() {
  if (game.gameOver) {
    return;
  }
  if (!game.running) {
    startGame();
    return;
  }
  game.paused = !game.paused;
  setMessage(game.paused ? 'Paused' : 'Running');
}

function restartGame() {
  resetGameState();
  startGame();
}

function endGame(reason) {
  game.running = false;
  game.paused = false;
  game.gameOver = true;
  updateRankings(game.score);
  game.message = reason;
  addParticles(game.snake[0].x, game.snake[0].y, 'rgba(255, 110, 110, 0.85)', 16);
  playTone(160, 0.28, 'sawtooth', 0.035);
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  syncHud();
  render();
}

function isReverse(next, current) {
  return next.x === -current.x && next.y === -current.y;
}

function setDirection(direction) {
  if (!game.running && !game.gameOver) {
    startGame();
  }

  if (game.gameOver) {
    restartGame();
    game.nextDirection = direction;
    return;
  }

  if (isReverse(direction, game.direction) && game.snake.length > 1) {
    return;
  }

  game.nextDirection = direction;
}

function getLogicalDirection(value) {
  switch (value) {
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    default:
      return null;
  }
}

function resizeCanvas() {
  if (!canvas) {
    return;
  }

  const wrap = canvas.parentElement;
  const width = wrap ? Math.min(Math.max(wrap.clientWidth, 280), 560) : 480;
  const dpr = window.devicePixelRatio || 1;
  canvasState.size = width;
  canvasState.dpr = dpr;
  canvasState.cell = width / BOARD_SIZE;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(width * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${width}px`;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvasState.ctx = ctx;
  }

  render();
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawCuteWormSegment(segment, index) {
  const ctx = canvasState.ctx;
  if (!ctx) {
    return;
  }
  const cell = canvasState.cell;
  const cx = (segment.x + 0.5) * cell;
  const cy = (segment.y + 0.5) * cell;
  const isHead = index === 0;
  const radius = isHead ? cell * 0.41 : cell * 0.36;

  const body = ctx.createRadialGradient(
    cx - radius * 0.4,
    cy - radius * 0.45,
    radius * 0.1,
    cx,
    cy,
    radius
  );
  body.addColorStop(0, isHead ? '#f5ffd7' : '#d8f7a8');
  body.addColorStop(0.48, isHead ? '#9de35f' : '#84cf42');
  body.addColorStop(1, '#417115');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.beginPath();
  ctx.arc(cx - radius * 0.28, cy - radius * 0.32, radius * 0.28, 0, Math.PI * 2);
  ctx.fill();

  if (isHead) {
    ctx.fillStyle = '#10233f';
    const eyes = getEyeOffset();
    ctx.beginPath();
    ctx.arc(cx + eyes.left.x, cy + eyes.left.y, radius * 0.12, 0, Math.PI * 2);
    ctx.arc(cx + eyes.right.x, cy + eyes.right.y, radius * 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#10233f';
    ctx.lineWidth = Math.max(1, cell * 0.04);
    ctx.beginPath();
    ctx.arc(cx, cy + radius * 0.08, radius * 0.22, 0.1, Math.PI - 0.1);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(16, 35, 63, 0.14)';
    ctx.beginPath();
    ctx.arc(cx, cy + radius * 0.05, radius * 0.42, 0.2, Math.PI - 0.2);
    ctx.fill();
  }
}

function getEyeOffset() {
  const cell = canvasState.cell;
  const offset = cell * 0.13;
  if (game.direction.x === 1) {
    return {
      left: { x: offset, y: -offset },
      right: { x: offset, y: offset * 0.55 },
    };
  }
  if (game.direction.x === -1) {
    return {
      left: { x: -offset, y: -offset },
      right: { x: -offset, y: offset * 0.55 },
    };
  }
  if (game.direction.y === -1) {
    return {
      left: { x: -offset * 0.55, y: -offset },
      right: { x: offset * 0.55, y: -offset },
    };
  }
  return {
    left: { x: -offset * 0.55, y: offset },
    right: { x: offset * 0.55, y: offset },
  };
}

function drawVillainEnemy(enemy) {
  const ctx = canvasState.ctx;
  if (!ctx) {
    return;
  }
  const cell = canvasState.cell;
  const padding = Math.max(2, cell * 0.1);
  const size = cell - padding * 2;
  const px = enemy.x * cell + padding;
  const py = enemy.y * cell + padding;

  const body = ctx.createLinearGradient(px, py, px, py + size);
  body.addColorStop(0, '#ffb19f');
  body.addColorStop(0.45, '#e65545');
  body.addColorStop(1, '#6d1414');
  ctx.fillStyle = body;
  roundedRectPath(ctx, px, py, size, size, 8);
  ctx.fill();

  ctx.fillStyle = '#fff4f2';
  ctx.beginPath();
  ctx.arc(px + size * 0.34, py + size * 0.38, size * 0.1, 0, Math.PI * 2);
  ctx.arc(px + size * 0.66, py + size * 0.38, size * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#30120f';
  ctx.beginPath();
  ctx.arc(px + size * 0.34, py + size * 0.39, size * 0.045, 0, Math.PI * 2);
  ctx.arc(px + size * 0.66, py + size * 0.39, size * 0.045, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#30120f';
  ctx.lineWidth = Math.max(1, cell * 0.05);
  ctx.beginPath();
  ctx.moveTo(px + size * 0.26, py + size * 0.28);
  ctx.lineTo(px + size * 0.4, py + size * 0.22);
  ctx.moveTo(px + size * 0.74, py + size * 0.28);
  ctx.lineTo(px + size * 0.6, py + size * 0.22);
  ctx.moveTo(px + size * 0.34, py + size * 0.68);
  ctx.quadraticCurveTo(px + size * 0.5, py + size * 0.58, px + size * 0.66, py + size * 0.68);
  ctx.stroke();
}

function drawFood(food) {
  const ctx = canvasState.ctx;
  if (!ctx) {
    return;
  }
  const cell = canvasState.cell;
  const cx = (food.x + 0.5) * cell;
  const cy = (food.y + 0.5) * cell;

  if (food.type === 'star') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(255, 223, 122, 0.22)';
    ctx.beginPath();
    ctx.arc(0, 0, cell * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd668';
    ctx.beginPath();
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + (Math.PI / 5) * index;
      const radius = index % 2 === 0 ? cell * 0.3 : cell * 0.14;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.fillStyle = '#f44f47';
  ctx.beginPath();
  ctx.arc(cx, cy, cell * 0.26, 0, Math.PI * 2);
  ctx.arc(cx - cell * 0.15, cy, cell * 0.23, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#7fd047';
  ctx.beginPath();
  ctx.ellipse(cx + cell * 0.08, cy - cell * 0.28, cell * 0.12, cell * 0.08, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#7c3f16';
  ctx.lineWidth = Math.max(1.5, cell * 0.04);
  ctx.beginPath();
  ctx.moveTo(cx - cell * 0.03, cy - cell * 0.14);
  ctx.lineTo(cx + cell * 0.04, cy - cell * 0.28);
  ctx.stroke();
}

function drawParticles(stepMs) {
  const ctx = canvasState.ctx;
  if (!ctx) {
    return;
  }
  const cell = canvasState.cell;
  game.particles = game.particles.filter((particle) => {
    particle.age += stepMs;
    if (particle.age >= particle.life) {
      return false;
    }
    particle.x += particle.vx * stepMs * 0.06;
    particle.y += particle.vy * stepMs * 0.06;
    const alpha = 1 - particle.age / particle.life;
    ctx.fillStyle = particle.color.replace('0.85', alpha.toFixed(3));
    ctx.beginPath();
    ctx.arc(particle.x * cell, particle.y * cell, cell * 0.08 * alpha + 1, 0, Math.PI * 2);
    ctx.fill();
    return true;
  });
}

function renderGrid() {
  const ctx = canvasState.ctx;
  if (!ctx) {
    return;
  }
  const size = canvasState.size;
  const cell = canvasState.cell;

  ctx.clearRect(0, 0, size, size);

  const boardGradient = ctx.createLinearGradient(0, 0, 0, size);
  boardGradient.addColorStop(0, '#101c30');
  boardGradient.addColorStop(1, '#162845');
  ctx.fillStyle = boardGradient;
  ctx.fillRect(0, 0, size, size);

  const edgeGlow = ctx.createLinearGradient(0, 0, size, size);
  edgeGlow.addColorStop(0, 'rgba(118, 183, 255, 0.22)');
  edgeGlow.addColorStop(1, 'rgba(118, 183, 255, 0)');
  ctx.strokeStyle = edgeGlow;
  ctx.lineWidth = Math.max(1.5, cell * 0.08);
  ctx.strokeRect(cell * 0.12, cell * 0.12, size - cell * 0.24, size - cell * 0.24);

  ctx.strokeStyle = 'rgba(111, 170, 255, 0.1)';
  ctx.lineWidth = 1;
  for (let index = 0; index <= BOARD_SIZE; index += 1) {
    const pos = index * cell;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(size, pos);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  for (let row = 0; row < BOARD_SIZE; row += 2) {
    ctx.fillRect(0, row * cell, size, cell);
  }
}

function render() {
  const ctx = canvasState.ctx;
  if (!ctx) {
    return;
  }

  renderGrid();
  drawFood(game.food);
  game.enemies.forEach(drawVillainEnemy);
  game.snake
    .slice()
    .reverse()
    .forEach((segment, index, array) => drawCuteWormSegment(segment, array.length - 1 - index));
  drawParticles(effectAccumulator);
  effectAccumulator = 0;
}

function moveSnake() {
  game.direction = game.nextDirection;
  const head = game.snake[0];
  const nextHead = {
    x: head.x + game.direction.x,
    y: head.y + game.direction.y,
  };

  if (
    nextHead.x < 0 ||
    nextHead.x >= BOARD_SIZE ||
    nextHead.y < 0 ||
    nextHead.y >= BOARD_SIZE
  ) {
    endGame('Game over');
    return;
  }

  if (game.snake.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y)) {
    endGame('Game over');
    return;
  }

  if (game.enemies.some((enemy) => enemy.x === nextHead.x && enemy.y === nextHead.y)) {
    endGame('Caught by enemy');
    return;
  }

  game.snake.unshift(nextHead);

  const ateFood = nextHead.x === game.food.x && nextHead.y === game.food.y;
  if (ateFood) {
    const withinCombo = game.comboTimer > 0;
    game.combo = withinCombo ? Math.min(9, game.combo + 1) : 1;
    game.comboTimer = COMBO_WINDOW_MS;
    const points = game.food.type === 'star' ? 3 + game.combo : 1 + (game.combo - 1);
    game.score += points;
    if (game.score > game.best) {
      game.best = game.score;
      writeBestScore(game.best);
    }
    if (game.food.type === 'star') {
      game.powerUp = { type: 'star' };
      game.powerTimer = POWERUP_DURATION_MS;
      setMessage('Star power');
      playTone(690, 0.14, 'triangle', 0.03);
      playTone(880, 0.18, 'triangle', 0.022);
      addParticles(game.food.x, game.food.y, 'rgba(255, 223, 122, 0.85)', 18);
    } else {
      setMessage(game.combo > 1 ? `Combo x${game.combo}` : 'Growing');
      playTone(420 + game.combo * 45, 0.1, 'triangle', 0.022);
      addParticles(game.food.x, game.food.y, 'rgba(143, 209, 255, 0.85)', 12);
    }
    game.level = Math.max(1, Math.floor(game.score / 5) + 1);
    const targetEnemyCount = getEnemyTargetCount();
    while (game.enemies.length < targetEnemyCount) {
      game.enemies.push(createEnemy());
    }
    game.nextFoodCount += 1;
    game.food = spawnFood();
  } else {
    game.snake.pop();
  }

  syncHud();
}

function moveEnemies() {
  const head = game.snake[0];
  game.enemies = game.enemies.map((enemy) => {
    const possibleMoves = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]
      .map((dir) => ({
        x: enemy.x + dir.x,
        y: enemy.y + dir.y,
        xDir: dir.x,
        yDir: dir.y,
      }))
      .filter(
        (cell) =>
          cell.x >= 0 &&
          cell.x < BOARD_SIZE &&
          cell.y >= 0 &&
          cell.y < BOARD_SIZE &&
          !game.snake.some((segment) => segment.x === cell.x && segment.y === cell.y) &&
          !(cell.x === game.food.x && cell.y === game.food.y)
      );

    if (possibleMoves.length === 0) {
      return createEnemy();
    }

    const preferChase = possibleMoves.slice().sort((left, right) => {
      const leftDistance = Math.abs(left.x - head.x) + Math.abs(left.y - head.y);
      const rightDistance = Math.abs(right.x - head.x) + Math.abs(right.y - head.y);
      return leftDistance - rightDistance;
    });
    const nextEnemy = Math.random() < 0.65 ? preferChase[0] : preferChase[Math.floor(Math.random() * preferChase.length)];
    return { ...nextEnemy };
  });

  if (game.enemies.some((enemy) => enemy.x === head.x && enemy.y === head.y)) {
    endGame('Caught by enemy');
  }
}

function updateEffects(stepMs) {
  effectAccumulator += stepMs;
  if (game.comboTimer > 0) {
    game.comboTimer = Math.max(0, game.comboTimer - stepMs);
    if (game.comboTimer === 0) {
      game.combo = 1;
    }
  }
  if (game.powerTimer > 0) {
    game.powerTimer = Math.max(0, game.powerTimer - stepMs);
    if (game.powerTimer === 0) {
      game.powerUp = null;
      if (!game.gameOver) {
        setMessage('Running');
      }
    }
  }
}

function update(stepMs) {
  updateEffects(stepMs);
  if (!game.running || game.paused || game.gameOver) {
    return;
  }

  accumulator += stepMs;
  enemyAccumulator += stepMs;

  while (accumulator >= getSnakeStepMs() && game.running && !game.paused && !game.gameOver) {
    accumulator -= getSnakeStepMs();
    moveSnake();
  }

  while (enemyAccumulator >= getEnemyStepMs() && game.running && !game.paused && !game.gameOver) {
    enemyAccumulator -= getEnemyStepMs();
    moveEnemies();
  }
}

function loop(timestamp) {
  if (!lastTime) {
    lastTime = timestamp;
  }
  const elapsed = timestamp - lastTime;
  lastTime = timestamp;

  update(elapsed);
  render();

  if (game.running && !game.gameOver) {
    rafId = requestAnimationFrame(loop);
  } else {
    rafId = null;
  }
}

function handleKeydown(event) {
  const key = event.key.toLowerCase();
  const keyMap = {
    arrowup: { x: 0, y: -1 },
    w: { x: 0, y: -1 },
    arrowdown: { x: 0, y: 1 },
    s: { x: 0, y: 1 },
    arrowleft: { x: -1, y: 0 },
    a: { x: -1, y: 0 },
    arrowright: { x: 1, y: 0 },
    d: { x: 1, y: 0 },
  };

  if (key in keyMap) {
    event.preventDefault();
    setDirection(keyMap[key]);
    return;
  }

  if (key === ' ' || key === 'spacebar') {
    event.preventDefault();
    togglePause();
    return;
  }

  if (key === 'r') {
    event.preventDefault();
    restartGame();
  }
}

if (yearNode) {
  yearNode.textContent = String(new Date().getFullYear());
}

if (navToggle && siteHeader) {
  navToggle.addEventListener('click', toggleNav);
}

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    setNavOpen(false);
  });
});

dirButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const direction = getLogicalDirection(button.dataset.direction || '');
    if (direction) {
      setDirection(direction);
    }
  });
});

actionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'start') {
      startGame();
    } else if (action === 'pause') {
      togglePause();
    } else if (action === 'restart') {
      restartGame();
    }
  });
});

difficultyButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setDifficulty(button.dataset.difficulty || 'normal');
    resetGameState();
  });
});

if (soundToggle) {
  soundToggle.addEventListener('click', async () => {
    audioState.enabled = !audioState.enabled;
    const ctx = ensureAudioContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }
    syncHud();
    if (audioState.enabled) {
      playTone(520, 0.09, 'triangle', 0.02);
    }
  });
}

document.addEventListener('keydown', handleKeydown);
window.addEventListener('resize', resizeCanvas);

resetGameState();
resizeCanvas();
syncHud();
render();
