// a-lamina - Bloc 3 : Version Finale (Menu Principal, Niveaux, Effets, Audio, Pause, LocalStorage & SDK Ads)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const movesEl = document.getElementById('moves');
const levelInfoEl = document.getElementById('level-info');
const pauseBtn = document.getElementById('pause-btn');

const GRID_SIZE = 6;
const TILE_SIZE = canvas.width / GRID_SIZE;
const COLORS = ['#f43f5e', '#38bdf8', '#fbbf24', '#34d399']; // Rouge, Bleu, Jaune, Vert

let grid = [];
let score = 0;
let highScore = parseInt(localStorage.getItem('alamina_highscore')) || 0;
let currentLevel = parseInt(localStorage.getItem('alamina_level')) || 1;

let levelConfig = {
    1: { target: 500, moves: 15, name: "Niveau 1 : Alignez 3 blocs" },
    2: { target: 800, moves: 14, name: "Niveau 2 : Défi Stratégique" },
    3: { target: 1200, moves: 12, name: "Niveau 3 : Maître Lamina" }
};

let targetScore = levelConfig[currentLevel] ? levelConfig[currentLevel].target : levelConfig[1].target;
let movesLeft = levelConfig[currentLevel] ? levelConfig[currentLevel].moves : levelConfig[1].moves;

let selectedTile = null;
let isAnimating = false;
let gameState = 'MENU'; // 'MENU', 'PLAYING', 'VICTORY', 'GAMEOVER', 'PAUSED', 'AD_LOADING'
let particles = [];

// --- GESTION DU SDK PUBLICITAIRE (Simulation Web Ads) ---
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

// --- SAUVEGARDE LOCALSTORAGE ---
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
    if (gameState === 'PAUSED' || gameState === 'AD_LOADING' || gameState === 'MENU') return;
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
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'swap') {
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'match') {
            osc.frequency.setValueAtTime(500, now);
            osc.frequency.setValueAtTime(800, now + 0.1);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        } else if (type === 'win') {
            let notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, index) => {
                let o = audioCtx.createOscillator();
                let g = audioCtx.createGain();
                o.connect(g); g.connect(audioCtx.destination);
                o.frequency.setValueAtTime(freq, now + index * 0.1);
                g.gain.setValueAtTime(0.15, now + index * 0.1);
                g.gain.exponentialRampToValueAtTime(0.01, now + index * 0.1 + 0.3);
                o.start(now + index * 0.1); o.stop(now + index * 0.1 + 0.3);
            });
        } else if (type === 'gameover') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(80, now + 0.4);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now); osc.stop(now + 0.4);
        }
    } catch (e) {}
}

// --- SYSTÈME DE PARTICULES ---
function createParticles(pixelX, pixelY, color) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: pixelX, y: pixelY,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            size: Math.random() * 4 + 2,
            color: color, alpha: 1
        });
    }
}

function updateAndDrawParticles() {
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
                grid[r][c] = Math.floor(Math.random() * COLORS.length);
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

// --- RENDU CANVAS ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const val = grid[r][c];
            if (val !== null && val !== undefined) {
                ctx.fillStyle = COLORS[val];
                ctx.fillRect(c * TILE_SIZE + 6, r * TILE_SIZE + 6, TILE_SIZE - 12, TILE_SIZE - 12);

                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillRect(c * TILE_SIZE + 10, r * TILE_SIZE + 10, TILE_SIZE - 20, 6);
            }
            
            if (selectedTile && selectedTile.r === r && selectedTile.c === c) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 4;
                ctx.strokeRect(c * TILE_SIZE + 3, r * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);
            }
        }
    }

    updateAndDrawParticles();

    if (gameState === 'MENU') {
        drawOverlay("A-LAMINA", "#f43f5e", "Cliquez ici ou appuyez pour JOUER");
    } else if (gameState === 'VICTORY') {
        drawOverlay("VICTOIRE !", "#34d399", currentLevel < 3 ? "Cliquez pour le Niveau Suivant" : "Jeu Terminé ! Recommencer");
    } else if (gameState === 'GAMEOVER') {
        drawOverlay("RATÉ !", "#f43f5e", "Cliquez pour Recommencer ou [Espace] pour Pub (+5 coups)");
    } else if (gameState === 'PAUSED') {
        drawOverlay("EN PAUSE", "#38bdf8", "Cliquez sur Pause pour Reprendre");
    }

    if (particles.length > 0 || gameState !== 'PLAYING') {
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

// --- INTERACTIONS CLAVIER (Publicité récompensée) ---
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

// --- INTERACTIONS CLICS CANVAS ---
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
    score += matches.length * 50;
    scoreEl.textContent = score;
    updateHighScore();

    matches.forEach(m => {
        let val = grid[m.r][m.c];
        if (val !== null) {
            createParticles(m.c * TILE_SIZE + TILE_SIZE / 2, m.r * TILE_SIZE + TILE_SIZE / 2, COLORS[val]);
        }
        grid[m.r][m.c] = null;
    });
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
            grid[r][c] = Math.floor(Math.random() * COLORS.length);
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

// Initialisation de l'affichage du menu d'accueil au chargement
draw();