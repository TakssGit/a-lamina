// a-lamina - Bloc 4 : Direction Artistique Cristaux, Floating Text, Screen Shake & Audio Mute
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const movesEl = document.getElementById('moves');
const levelInfoEl = document.getElementById('level-info');
const pauseBtn = document.getElementById('pause-btn');
const muteBtn = document.getElementById('mute-btn');

const GRID_SIZE = 6;
const TILE_SIZE = canvas.width / GRID_SIZE;
const GEM_TYPES = [
    { color: '#f43f5e', light: '#fb7185', dark: '#be123c', shape: 'diamond' }, // Rubis
    { color: '#38bdf8', light: '#7dd3fc', dark: '#0284c7', shape: 'rhombus' }, // Saphir
    { color: '#fbbf24', light: '#fde047', dark: '#d97706', shape: 'circle' },  // Topaze
    { color: '#34d399', light: '#6ee7b7', dark: '#059669', shape: 'hexagon' }  // Émeraude
];

let grid = [];
let score = 0;
let highScore = parseInt(localStorage.getItem('alamina_highscore')) || 0;
let currentLevel = parseInt(localStorage.getItem('alamina_level')) || 1;

let levelConfig = {
    1: { target: 500, moves: 15, name: "Niveau 1 : Cristaux de Bas" },
    2: { target: 800, moves: 14, name: "Niveau 2 : Caverne aux Gemmes" },
    3: { target: 1200, moves: 12, name: "Niveau 3 : Maître Lamina" }
};

let targetScore = levelConfig[currentLevel] ? levelConfig[currentLevel].target : levelConfig[1].target;
let movesLeft = levelConfig[currentLevel] ? levelConfig[currentLevel].moves : levelConfig[1].moves;

let selectedTile = null;
let isAnimating = false;
let gameState = 'MENU';
let particles = [];
let floatingTexts = [];
let shakeTime = 0;
let isMuted = false;

// --- GESTION MUTE AUDIO ---
muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? "🔇" : "🔊";
});

// --- GESTION DU SDK PUBLICITAIRE (Simulation) ---
function showAd(type, callback) {
    let previousState = gameState;
    gameState = 'AD_LOADING';
    
    let adOverlay = document.createElement('div');
    adOverlay.style.position = 'absolute';
    adOverlay.style.top = '0';
    adOverlay.style.left = '0';
    adOverlay.style.width = '100%';
    adOverlay.style.height = '100%';
    adOverlay.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
    adOverlay.style.display = 'flex';
    adOverlay.style.flexDirection = 'column';
    adOverlay.style.justifyContent = 'center';
    adOverlay.style.alignItems = 'center';
    adOverlay.style.zIndex = '1000';
    adOverlay.style.color = '#f8fafc';
    adOverlay.style.fontFamily = 'Segoe UI, sans-serif';
    
    let title = type === 'reward' ? "Publicité Récompensée" : "Publicité Interstitielle";
    adOverlay.innerHTML = `
        <h2 style="color: #38bdf8; margin-bottom: 10px;">${title}</h2>
        <p style="color: #94a3b8; margin-bottom: 20px;">Chargement de l'annonce partenaire...</p>
        <div style="font-size: 2rem; font-weight: bold; color: #f43f5e;" id="ad-timer">3</div>
    `;
    
    document.body.appendChild(adOverlay);
    
    let timeLeft = 3;
    let timerInterval = setInterval(() => {
        timeLeft--;
        let timerEl = document.getElementById('ad-timer');
        if (timerEl) timerEl.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            document.body.removeChild(adOverlay);
            gameState = previousState;
            if (callback) callback(true);
        }
    }, 1000);
}

// --- LOCALSTORAGE ---
function updateHighScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('alamina_highscore', highScore);
    }
    highScoreEl.textContent = highScore;
}

function saveProgress() {
    localStorage.setItem('alamina_level', currentLevel);
}

// --- AUDIO WEB API ---
let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (isMuted || gameState === 'PAUSED' || gameState === 'AD_LOADING' || gameState === 'MENU') return;
    try {
        initAudio();
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        let now = audioCtx.currentTime;

        if (type === 'select') {
            osc.frequency.setValueAtTime(400, now);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            osc.start(now); osc.stop(now + 0.08);
        } else if (type === 'swap') {
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            osc.start(now); osc.stop(now + 0.12);
        } else if (type === 'match') {
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.08);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.start(now); osc.stop(now + 0.25);
        } else if (type === 'win') {
            let notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, index) => {
                let o = audioCtx.createOscillator();
                let g = audioCtx.createGain();
                o.connect(g); g.connect(audioCtx.destination);
                o.frequency.setValueAtTime(freq, now + index * 0.08);
                g.gain.setValueAtTime(0.12, now + index * 0.08);
                g.gain.exponentialRampToValueAtTime(0.01, now + index * 0.08 + 0.25);
                o.start(now + index * 0.08); o.stop(now + index * 0.08 + 0.25);
            });
        } else if (type === 'gameover') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.linearRampToValueAtTime(90, now + 0.35);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            osc.start(now); osc.stop(now + 0.35);
        }
    } catch (e) {}
}

// --- PARTICULES & TEXTE FLOTTANT ---
function createParticles(pixelX, pixelY, color) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x: pixelX, y: pixelY,
            vx: (Math.random() - 0.5) * 7,
            vy: (Math.random() - 0.5) * 7,
            size: Math.random() * 5 + 2,
            color: color, alpha: 1
        });
    }
}

function addFloatingText(text, x, y, color = '#fbbf24') {
    floatingTexts.push({
        text: text,
        x: x,
        y: y,
        alpha: 1,
        color: color
    });
}

function updateAndDrawEffects() {
    // Particules
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.04;
        if (p.alpha <= 0) {
            particles.splice(i, 1);
        } else {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Textes flottants (+50 PTS)
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        let ft = floatingTexts[i];
        ft.y -= 1.5;
        ft.alpha -= 0.03;
        if (ft.alpha <= 0) {
            floatingTexts.splice(i, 1);
        } else {
            ctx.save();
            ctx.globalAlpha = ft.alpha;
            ctx.fillStyle = ft.color;
            ctx.font = 'bold 18px Segoe UI';
            ctx.textAlign = 'center';
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }
    }
}

// --- RENDU DES GEMMES STYLE CRISTAUX EN CANVAS ---
function drawGem(r, c, typeIdx) {
    let gem = GEM_TYPES[typeIdx];
    let cx = c * TILE_SIZE + TILE_SIZE / 2;
    let cy = r * TILE_SIZE + TILE_SIZE / 2;
    let size = TILE_SIZE * 0.38;

    ctx.save();
    ctx.translate(cx, cy);

    // Ombre sous la gemme
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(2, 4, size, 0, Math.PI * 2);
    ctx.fill();

    // Rendu des facettes selon le type de cristal
    ctx.fillStyle = gem.color;
    ctx.strokeStyle = gem.dark;
    ctx.lineWidth = 2;

    if (gem.shape === 'diamond') { // Losange (Rubis)
        ctx.beginPath();
        ctx.moveTo(0, -size); ctx.lineTo(size, 0); ctx.lineTo(0, size); ctx.lineTo(-size, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        ctx.fillStyle = gem.light;
        ctx.beginPath();
        ctx.moveTo(0, -size); ctx.lineTo(size * 0.4, 0); ctx.lineTo(0, size * 0.4); ctx.lineTo(-size * 0.4, 0);
        ctx.closePath(); ctx.fill();
    } 
    else if (gem.shape === 'rhombus') { // Carré facetté (Saphir)
        ctx.beginPath();
        ctx.rect(-size*0.8, -size*0.8, size*1.6, size*1.6);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = gem.light;
        ctx.beginPath();
        ctx.rect(-size*0.4, -size*0.4, size*0.8, size*0.8);
        ctx.fill();
    }
    else if (gem.shape === 'circle') { // Sphere brillante (Topaze)
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.9, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = gem.light;
        ctx.beginPath();
        ctx.arc(-size*0.3, -size*0.3, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
    else if (gem.shape === 'hexagon') { // Hexagone (Émeraude)
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            let angle = (Math.PI / 3) * i;
            let hx = size * Math.cos(angle);
            let hy = size * Math.sin(angle);
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();

        ctx.fillStyle = gem.light;
        ctx.beginPath();
        ctx.arc(-size*0.2, -size*0.2, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// --- INITIALISATION DU JEU ---
function startGame() {
    gameState = 'PLAYING';
    loadLevel();
}

function loadLevel() {
    let config = levelConfig[currentLevel] || levelConfig[1];
    targetScore = config.target;
    movesLeft = config.moves;
    score = 0;
    scoreEl.textContent = score;
    document.getElementById('target-score').textContent = targetScore;
    movesEl.textContent = movesLeft;
    levelInfoEl.textContent = config.name;
    highScoreEl.textContent = highScore;
    saveProgress();
    pauseBtn.textContent = "PAUSE";
    initGrid();
    draw();
}

function initGrid() {
    do {
        for (let r = 0; r < GRID_SIZE; r++) {
            grid[r] = [];
            for (let c = 0; c < GRID_SIZE; c++) {
                grid[r][c] = Math.floor(Math.random() * GEM_TYPES.length);
            }
        }
    } while (checkInitialMatches());
}

function checkInitialMatches() {
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (c < GRID_SIZE - 2 && grid[r][c] === grid[r][c+1] && grid[r][c] === grid[r][c+2]) return true;
            if (r < GRID_SIZE - 2 && grid[r][c] === grid[r+1][c] && grid[r][c] === grid[r+2][c]) return true;
        }
    }
    return false;
}

// --- RENDU CANVAS AVEC SCREEN SHAKE ---
function draw() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Effet de Secousse (Screen Shake)
    if (shakeTime > 0) {
        let dx = (Math.random() - 0.5) * 8;
        let dy = (Math.random() - 0.5) * 8;
        ctx.translate(dx, dy);
        shakeTime--;
    }

    // Grille de fond
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            ctx.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);

            const val = grid[r][c];
            if (val !== null && val !== undefined) {
                drawGem(r, c, val);
            }
            
            if (selectedTile && selectedTile.r === r && selectedTile.c === c) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 3;
                ctx.strokeRect(c * TILE_SIZE + 4, r * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            }
        }
    }

    updateAndDrawEffects();
    ctx.restore();

    if (gameState === 'MENU') {
        drawOverlay("A-LAMINA", "#f43f5e", "Cliquez ici pour JOUER");
    } else if (gameState === 'VICTORY') {
        drawOverlay("VICTOIRE !", "#34d399", currentLevel < 3 ? "Cliquez pour le Niveau Suivant" : "Jeu Terminé ! Recommencer");
    } else if (gameState === 'GAMEOVER') {
        drawOverlay("RATÉ !", "#f43f5e", "Cliquez pour Recommencer ou [Espace] pour Pub (+5 coups)");
    } else if (gameState === 'PAUSED') {
        drawOverlay("EN PAUSE", "#38bdf8", "Cliquez sur Pause pour Reprendre");
    }

    if (particles.length > 0 || floatingTexts.length > 0 || shakeTime > 0 || gameState !== 'PLAYING') {
        requestAnimationFrame(draw);
    }
}

function drawOverlay(title, color, subtitle) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = color;
    ctx.font = 'bold 36px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 25);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '15px Segoe UI';
    ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 15);

    if (gameState === 'GAMEOVER') {
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 13px Segoe UI';
        ctx.fillText("💡 Appuyez sur ESPACE pour +5 coups", canvas.width / 2, canvas.height / 2 + 60);
    }
}

// --- GESTION PAUSE & FOCUS ---
function togglePause() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        pauseBtn.textContent = "REPRENDRE";
        draw();
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        pauseBtn.textContent = "PAUSE";
        draw();
    }
}

pauseBtn.addEventListener('click', togglePause);

window.addEventListener('blur', () => {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        pauseBtn.textContent = "REPRENDRE";
        draw();
    }
});

// --- INTERACTIONS CLAVIER ---
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameState === 'GAMEOVER') {
        e.preventDefault();
        showAd('reward', (success) => {
            if (success) {
                movesLeft += 5;
                movesEl.textContent = movesLeft;
                gameState = 'PLAYING';
                draw();
            }
        });
    }
});

// --- INTERACTIONS CANVAS ---
canvas.addEventListener('pointerdown', (e) => {
    if (gameState === 'MENU') {
        startGame();
        return;
    }
    if (gameState === 'PAUSED') {
        togglePause();
        return;
    }
    if (gameState === 'VICTORY') {
        showAd('interstitial', () => {
            if (currentLevel < 3) {
                currentLevel++;
            } else {
                currentLevel = 1;
            }
            loadLevel();
        });
        return;
    }
    if (gameState === 'GAMEOVER') {
        loadLevel();
        return;
    }

    if (isAnimating || movesLeft <= 0 || gameState !== 'PLAYING') return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const c = Math.floor(x / TILE_SIZE);
    const r = Math.floor(y / TILE_SIZE);
    
    if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
        if (!selectedTile) {
            selectedTile = { r, c };
            playSound('select');
        } else {
            const isAdjacent = Math.abs(selectedTile.r - r) + Math.abs(selectedTile.c - c) === 1;
            if (isAdjacent) {
                isAnimating = true;
                playSound('swap');
                swapAndCheck(selectedTile.r, selectedTile.c, r, c);
            } else {
                playSound('select');
            }
            selectedTile = { r, c };
        }
        draw();
    }
});

function swapAndCheck(r1, c1, r2, c2) {
    let temp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = temp;
    draw();

    setTimeout(() => {
        let matches = findMatches();
        if (matches.length > 0) {
            movesLeft--;
            movesEl.textContent = movesLeft;
            playSound('match');
            processMatches(matches);
        } else {
            temp = grid[r1][c1];
            grid[r1][c1] = grid[r2][c2];
            grid[r2][c2] = temp;
            isAnimating = false;
            draw();
        }
    }, 200);
}

function findMatches() {
    let matchedSet = new Set();
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE - 2; c++) {
            let val = grid[r][c];
            if (val !== null && val === grid[r][c+1] && val === grid[r][c+2]) {
                matchedSet.add(`${r},${c}`); matchedSet.add(`${r},${c+1}`); matchedSet.add(`${r},${c+2}`);
            }
        }
    }
    for (let r = 0; r < GRID_SIZE - 2; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            let val = grid[r][c];
            if (val !== null && val === grid[r+1][c] && val === grid[r+2][c]) {
                matchedSet.add(`${r},${c}`); matchedSet.add(`${r+1},${c}`); matchedSet.add(`${r+2},${c}`);
            }
        }
    }
    return Array.from(matchedSet).map(s => {
        let parts = s.split(',');
        return { r: parseInt(parts[0]), c: parseInt(parts[1]) };
    });
}

function processMatches(matches) {
    let pointsGained = matches.length * 50;
    score += pointsGained;
    scoreEl.textContent = score;
    updateHighScore();

    // Déclencher le Screen Shake et ajouter le texte flottant
    shakeTime = 8;
    let avgX = 0, avgY = 0;

    matches.forEach(m => {
        let val = grid[m.r][m.c];
        let px = m.c * TILE_SIZE + TILE_SIZE / 2;
        let py = m.r * TILE_SIZE + TILE_SIZE / 2;
        avgX += px; avgY += py;

        if (val !== null) {
            createParticles(px, py, GEM_TYPES[val].color);
        }
        grid[m.r][m.c] = null;
    });

    avgX /= matches.length;
    avgY /= matches.length;
    addFloatingText(`+${pointsGained}`, avgX, avgY, '#38bdf8');

    draw();

    setTimeout(() => {
        applyGravity();
        draw();

        setTimeout(() => {
            let chainMatches = findMatches();
            if (chainMatches.length > 0) {
                processMatches(chainMatches);
            } else {
                isAnimating = false;
                checkGameStatus();
            }
        }, 300);
    }, 300);
}

function applyGravity() {
    for (let c = 0; c < GRID_SIZE; c++) {
        let writeRow = GRID_SIZE - 1;
        for (let r = GRID_SIZE - 1; r >= 0; r--) {
            if (grid[r][c] !== null) {
                let temp = grid[r][c];
                grid[r][c] = null;
                grid[writeRow][c] = temp;
                writeRow--;
            }
        }
        for (let r = writeRow; r >= 0; r--) {
            grid[r][c] = Math.floor(Math.random() * GEM_TYPES.length);
        }
    }
}

function checkGameStatus() {
    if (score >= targetScore) {
        gameState = 'VICTORY';
        playSound('win');
        draw();
    } else if (movesLeft <= 0) {
        gameState = 'GAMEOVER';
        playSound('gameover');
        draw();
    }
}

// Initialisation au chargement
draw();