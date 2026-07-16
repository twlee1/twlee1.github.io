const navToggle = document.querySelector('.nav-toggle');
const siteHeader = document.querySelector('.site-header');
const navLinks = document.querySelectorAll('.site-nav a');
const yearNode = document.querySelector('#current-year');

const canvas = document.querySelector('#game-canvas');
const scoreNode = document.querySelector('#score');
const bestScoreNode = document.querySelector('#best-score');
const statusNode = document.querySelector('#game-status');
const dirButtons = document.querySelectorAll('.dir-btn');
const actionButtons = document.querySelectorAll('.action-btn');

const BOARD_SIZE = 20;
const BASE_STEP_MS = 125;
const ENEMY_STEP_MS = 260;
const STORAGE_KEY = 'twlee1-snake-best-score';

let canvasState = {
  ctx: null,
  size: 480,
  cell: 24,
  dpr: 1,
};

let game = createGameState();
let rafId = null;
let lastTime = 0;
let accumulator = 0;
let enemyAccumulator = 0;

function createGameState() {
  return {
    running: false,
    paused: false,
    gameOver: false,
    score: 0,
    best: readBestScore(),
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    snake: [
      { x: 9, y: 10 },
      { x: 8, y: 10 },
      { x: 7, y: 10 },
    ],
    food: { x: 14, y: 10 },
    enemy: { x: 4, y: 4, xDir: 1, yDir: 0 },
    message: 'Ready',
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
    // Ignore storage failures in restricted environments.
  }
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

function resetGameState(keepBest = true) {
  const best = keepBest ? game.best : 0;
  game = createGameState();
  game.best = best;
  game.snake = [
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 7, y: 10 },
  ];
  game.food = spawnFood();
  game.enemy = spawnEnemy();
  game.running = false;
  game.paused = false;
  game.gameOver = false;
  game.message = 'Ready';
  syncHud();
  render();
}

function startGame() {
  if (game.gameOver) {
    resetGameState(true);
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
  resetGameState(true);
  startGame();
}

function endGame(reason) {
  game.running = false;
  game.paused = false;
  game.gameOver = true;
  game.message = reason;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  syncHud();
  render();
}

function directionKey(dir) {
  return `${dir.x},${dir.y}`;
}

function isReverse(next, current) {
  return next.x === -current.x && next.y === -current.y;
}

function setDirection(direction) {
  const next = direction;
  if (!game.running && !game.gameOver) {
    game.running = true;
    setMessage('Running');
    if (!rafId) {
      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    }
  }

  if (game.gameOver) {
    restartGame();
    game.nextDirection = next;
    return;
  }

  if (isReverse(next, game.direction) && game.snake.length > 1) {
    return;
  }

  game.nextDirection = next;
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

function spawnFood() {
  const occupied = new Set([
    ...game.snake.map((segment) => `${segment.x},${segment.y}`),
    `${game.enemy.x},${game.enemy.y}`,
  ]);

  let cell;
  do {
    cell = {
      x: Math.floor(Math.random() * BOARD_SIZE),
      y: Math.floor(Math.random() * BOARD_SIZE),
    };
  } while (occupied.has(`${cell.x},${cell.y}`));

  return cell;
}

function spawnEnemy() {
  const occupied = new Set(game.snake.map((segment) => `${segment.x},${segment.y}`));
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
  return { ...cell, xDir: Math.random() > 0.5 ? 1 : -1, yDir: 0 };
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

function drawCell(x, y, color, radius = 8) {
  const ctx = canvasState.ctx;
  if (!ctx) {
    return;
  }
  const cell = canvasState.cell;
  const padding = Math.max(2, cell * 0.12);
  const size = cell - padding * 2;
  const px = x * cell + padding;
  const py = y * cell + padding;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(px, py, size, size, radius);
  ctx.fill();
}

function drawCircle(x, y, color) {
  const ctx = canvasState.ctx;
  if (!ctx) {
    return;
  }
  const cell = canvasState.cell;
  const radius = cell * 0.3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc((x + 0.5) * cell, (y + 0.5) * cell, radius, 0, Math.PI * 2);
  ctx.fill();
}

function renderGrid() {
  const ctx = canvasState.ctx;
  if (!ctx) {
    return;
  }
  const size = canvasState.size;
  const cell = canvasState.cell;

  ctx.clearRect(0, 0, size, size);

  ctx.fillStyle = '#f7fbff';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(24, 104, 219, 0.08)';
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
}

function render() {
  const ctx = canvasState.ctx;
  if (!ctx) {
    return;
  }

  renderGrid();

  // Food
  drawCircle(game.food.x, game.food.y, '#1868db');

  // Enemy
  drawCell(game.enemy.x, game.enemy.y, '#ae2e24', 6);
  drawCell(game.enemy.x + 0.12, game.enemy.y + 0.12, 'rgba(255, 255, 255, 0.92)', 4);

  // Snake
  game.snake.forEach((segment, index) => {
    const color = index === 0 ? '#123263' : '#4c6b1f';
    drawCell(segment.x, segment.y, color, 7);
  });
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

  if (game.enemy.x === nextHead.x && game.enemy.y === nextHead.y) {
    endGame('Caught by enemy');
    return;
  }

  game.snake.unshift(nextHead);

  const ateFood = nextHead.x === game.food.x && nextHead.y === game.food.y;
  if (ateFood) {
    game.score += 1;
    if (game.score > game.best) {
      game.best = game.score;
      writeBestScore(game.best);
    }
    game.food = spawnFood();
    setMessage('Growing');
  } else {
    game.snake.pop();
  }

  syncHud();
}

function moveEnemy() {
  const possibleMoves = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]
    .map((dir) => ({
      x: game.enemy.x + dir.x,
      y: game.enemy.y + dir.y,
      xDir: dir.x,
      yDir: dir.y,
    }))
    .filter(
      (cell) =>
        cell.x >= 0 &&
        cell.x < BOARD_SIZE &&
        cell.y >= 0 &&
        cell.y < BOARD_SIZE &&
        !game.snake.some((segment) => segment.x === cell.x && segment.y === cell.y)
    );

  if (possibleMoves.length === 0) {
    game.enemy = spawnEnemy();
    return;
  }

  const currentVector = directionKey({ x: game.enemy.xDir, y: game.enemy.yDir });
  const keepDirection = possibleMoves.find(
    (cell) => directionKey({ x: cell.xDir, y: cell.yDir }) === currentVector
  );
  const shouldTurn = Math.random() < 0.35 || !keepDirection;
  const nextCell = shouldTurn
    ? possibleMoves[Math.floor(Math.random() * possibleMoves.length)]
    : keepDirection;

  game.enemy = { ...nextCell };

  if (game.enemy.x === game.snake[0].x && game.enemy.y === game.snake[0].y) {
    endGame('Caught by enemy');
  }
}

function update(stepMs) {
  if (!game.running || game.paused || game.gameOver) {
    return;
  }

  accumulator += stepMs;
  enemyAccumulator += stepMs;

  while (accumulator >= BASE_STEP_MS && game.running && !game.paused && !game.gameOver) {
    accumulator -= BASE_STEP_MS;
    moveSnake();
  }

  while (enemyAccumulator >= ENEMY_STEP_MS && game.running && !game.paused && !game.gameOver) {
    enemyAccumulator -= ENEMY_STEP_MS;
    moveEnemy();
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

document.addEventListener('keydown', handleKeydown);
window.addEventListener('resize', resizeCanvas);

resetGameState(true);
resizeCanvas();
syncHud();
render();
