// a-Lamina - Moteur Corrigé (Sans boucle infinie)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const movesEl = document.getElementById('moves');
const levelInfoEl = document.getElementById('level-info');
const pauseBtn = document.getElementById('pause-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const modalSound = document.getElementById('modal-sound');
const modalMusic = document.getElementById('modal-music');
const modalRefresh = document.getElementById('modal-refresh');
const modalReset = document.getElementById('modal-reset');
const modalClose = document.getElementById('modal-close');

const puHammerBtn = document.getElementById('pu-hammer');
const puShuffleBtn = document.getElementById('pu-shuffle');

let currentLevel = parseInt(localStorage.getItem('alamina_level')) || 1;
let highScore = parseInt(localStorage.getItem('alamina_highscore')) || 0;
let score = 0;

function getGridSizeForLevel(lvl) {
    if (lvl === 1 || lvl === 2) return 6;
    if (lvl === 3 || lvl === 4) return 7;
    if (lvl === 5 || lvl === 6) return 8;
    return Math.min(9, 6 + Math.floor((lvl - 1) / 2));
}

let GRID_SIZE = getGridSizeForLevel(currentLevel);
let TILE_SIZE = canvas.width / GRID_SIZE;

const GEM_TYPES = [
    { color: '#f43f5e', light: '#fb7185', dark: '#be123c', shape: 'diamond' }, 
    { color: '#38bdf8', light: '#7dd3fc', dark: '#0284c7', shape: 'rhombus' }, 
    { color: '#fbbf24', light: '#fde047', dark: '#d97706', shape: 'circle' },  
    { color: '#34d399', light: '#6ee7b7', dark: '#059669', shape: 'hexagon' }  
];

let grid = [];

function getLevelConfig(lvl) {
    let baseTarget = 500 + (lvl - 1) * 350 + Math.floor(Math.pow(lvl, 1.25) * 100);
    baseTarget = Math.round(baseTarget / 50) * 50;
    return {
        target: baseTarget,
        moves: 18,
        name: `Niveau ${lvl}`
    };
}

let levelConfig = getLevelConfig(currentLevel);
let targetScore = levelConfig.target;
let movesLeft = levelConfig.moves;

let selectedTile = null;
let isAnimating = false;
let gameState = 'MENU';
let particles = [];
let fireworks = [];
let floatingTexts = [];
let backgroundGems = [];
let shakeTime = 0;

let activePowerup = null;
let idleTimer = null;
let suggestedMove = null;
let hintPulseTimer = 0;

let soundMuted = false;
let musicMuted = false;
let backgroundMusicInterval = null;

for (let i = 0; i < 12; i++) {
    backgroundGems.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 16 + 8,
        speedY: (Math.random() - 0.5) * 0.5,
        speedX: (Math.random() - 0.5) * 0.5,
        type: Math.floor(Math.random() * GEM_TYPES.length)
    });
}

function resetIdleTimer() {
    clearTimeout(idleTimer);
    suggestedMove = null;
    idleTimer = setTimeout(() => {
        findPossibleMove();
    }, 3000);
}

function findPossibleMove() {
    if (!grid || grid.length === 0) return;
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (c < GRID_SIZE - 1) {
                swapInGrid(r, c, r, c + 1);
                if (findMatches().length > 0) {
                    swapInGrid(r, c, r, c + 1);
                    suggestedMove = [{ r: r, c: c }, { r: r, c: c + 1 }];
                    return;
                }
                swapInGrid(r, c, r, c + 1);
            }
            if (r < GRID_SIZE - 1) {
                swapInGrid(r, c, r + 1, c);
                if (findMatches().length > 0) {
                    swapInGrid(r, c, r + 1, c);
                    suggestedMove = [{ r: r, c: c }, { r: r + 1, c: c }];
                    return;
                }
                swapInGrid(r, c, r + 1, c);
            }
        }
    }
}

function swapInGrid(r1, c1, r2, c2) {
    let temp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = temp;
}

puHammerBtn.addEventListener('click', () => {
    if (gameState !== 'PLAYING' || isAnimating) return;
    activePowerup = activePowerup === 'hammer' ? null : 'hammer';
    puHammerBtn.classList.toggle('active', activePowerup === 'hammer');
    playSound('select');
    selectedTile = null;
});

puShuffleBtn.addEventListener('click', () => {
    if (gameState !== 'PLAYING' || isAnimating) return;
    activePowerup = null;
    puHammerBtn.classList.remove('active');
    playSound('bonus');
    shuffleGrid();
});

function shuffleGrid() {
    isAnimating = true;
    addFloatingText("🔀 MÉLANGE !", canvas.width / 2, canvas.height / 2, '#38bdf8');
    setTimeout(() => {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                grid[r][c] = Math.floor(Math.random() * GEM_TYPES.length);
            }
        }
        isAnimating = false;
        resetIdleTimer();
    }, 400);
}

function startBackgroundMusic() {
    if (backgroundMusicInterval || musicMuted) return;
    let notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];
    let step = 0;
    
    backgroundMusicInterval = setInterval(() => {
        if (musicMuted || gameState === 'PAUSED' || gameState === 'AD_LOADING') return;
        try {
            initAudio();
            if (!audioCtx) return;
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            let now = audioCtx.currentTime;
            
            osc.frequency.setValueAtTime(notes[step], now);
            gain.gain.setValueAtTime(0.025, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
            
            step = (step + 1) % notes.length;
        } catch(e) {}
    }, 600);
}

function stopBackgroundMusic() {
    if (backgroundMusicInterval) {
        clearInterval(backgroundMusicInterval);
        backgroundMusicInterval = null;
    }
}

function saveProgress() {
    localStorage.setItem('alamina_level', currentLevel);
    localStorage.setItem('alamina_highscore', highScore);
}

window.addEventListener('beforeunload', () => { saveProgress(); });

function requestAd(type, onComplete) {
    let previousState = gameState;
    gameState = 'AD_LOADING';

    if (window.PokiSDK) {
        if (type === 'reward') {
            window.PokiSDK.rewardedBreak().then((success) => {
                gameState = previousState;
                onComplete(success);
            });
        } else {
            window.PokiSDK.commercialBreak().then(() => {
                gameState = previousState;
                onComplete(true);
            });
        }
        return;
    }

    let adOverlay = document.createElement('div');
    adOverlay.id = 'ad-simulation-overlay';
    adOverlay.style.position = 'absolute';
    adOverlay.style.top = '0';
    adOverlay.style.left = '0';
    adOverlay.style.width = '100%';
    adOverlay.style.height = '100%';
    adOverlay.style.backgroundColor = 'rgba(15, 3, 28, 0.96)';
    adOverlay.style.display = 'flex';
    adOverlay.style.flexDirection = 'column';
    adOverlay.style.justifyContent = 'center';
    adOverlay.style.alignItems = 'center';
    adOverlay.style.zIndex = '1000';
    adOverlay.style.color = '#f8fafc';
    adOverlay.style.fontFamily = 'Segoe UI, sans-serif';
    
    let title = type === 'reward' ? "Cadeau Magique (+5 Coups)" : "Portail Magique Interstitiel";
    adOverlay.innerHTML = `
        <h2 style="color: #fef08a; margin-bottom: 10px;">✨ ${title} ✨</h2>
        <p style="color: #cbd5e1; margin-bottom: 20px;">Chargement de l'énergie féerique...</p>
        <div style="font-size: 2.5rem; font-weight: bold; color: #38bdf8;" id="ad-timer">3</div>
    `;
    
    document.body.appendChild(adOverlay);
    
    let timeLeft = 3;
    let timerInterval = setInterval(() => {
        timeLeft--;
        let timerEl = document.getElementById('ad-timer');
        if (timerEl) timerEl.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            let overlayToRemove = document.getElementById('ad-simulation-overlay');
            if (overlayToRemove) document.body.removeChild(overlayToRemove);
            gameState = previousState;
            if (onComplete) onComplete(true);
        }
    }, 1000);
}

settingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'flex';
    if (gameState === 'PLAYING') gameState = 'PAUSED';
});

modalClose.addEventListener('click', () => {
    settingsModal.style.display = 'none';
    if (gameState === 'PAUSED') gameState = 'PLAYING';
    resetIdleTimer();
});

modalSound.addEventListener('click', () => {
    soundMuted = !soundMuted;
    document.getElementById('sound-txt').textContent = soundMuted ? "DÉSACTIVÉS" : "ACTIVÉS";
});

modalMusic.addEventListener('click', () => {
    musicMuted = !musicMuted;
    document.getElementById('music-txt').textContent = musicMuted ? "DÉSACTIVÉE" : "ACTIVÉE";
    if (musicMuted) stopBackgroundMusic();
    else startBackgroundMusic();
});

modalRefresh.addEventListener('click', () => {
    score = 0;
    let config = getLevelConfig(currentLevel);
    movesLeft = config.moves;
    settingsModal.style.display = 'none';
    loadLevel();
});

modalReset.addEventListener('click', () => {
    if (confirm("Voulez-vous recommencer toute l'aventure au Niveau 1 ?")) {
        currentLevel = 1;
        score = 0;
        localStorage.clear();
        let config = getLevelConfig(1);
        movesLeft = config.moves;
        settingsModal.style.display = 'none';
        grid = [];
        loadLevel();
    }
});

let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (soundMuted || gameState === 'PAUSED' || gameState === 'AD_LOADING' || gameState === 'MENU') return;
    try {
        initAudio();
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        let now = audioCtx.currentTime;

        if (type === 'select') {
            osc.frequency.setValueAtTime(450, now);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            osc.start(now); osc.stop(now + 0.08);
        } else if (type === 'swap') {
            osc.frequency.setValueAtTime(350, now);
            osc.frequency.exponentialRampToValueAtTime(650, now + 0.12);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            osc.start(now); osc.stop(now + 0.12);
        } else if (type === 'match') {
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.setValueAtTime(880, now + 0.08);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.start(now); osc.stop(now + 0.25);
        } else if (type === 'bonus') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1400, now + 0.3);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        } else if (type === 'win') {
            let notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
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
            osc.frequency.linearRampToValueAtTime(80, now + 0.4);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now); osc.stop(now + 0.4);
        }
    } catch (e) {}
}

function launchFireworks() {
    for (let f = 0; f < 3; f++) {
        let fx = Math.random() * canvas.width;
        let fy = Math.random() * (canvas.height / 2) + 50;
        let colors = ['#f43f5e', '#38bdf8', '#fbbf24', '#34d399', '#fef08a'];
        let baseColor = colors[Math.floor(Math.random() * colors.length)];
        
        for (let i = 0; i < 30; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 6 + 2;
            fireworks.push({
                x: fx, y: fy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 4 + 2,
                color: baseColor,
                alpha: 1,
                decay: Math.random() * 0.02 + 0.015
            });
        }
    }
}

function createParticles(pixelX, pixelY, color) {
    for (let i = 0; i < 18; i++) {
        particles.push({
            x: pixelX, y: pixelY,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            size: Math.random() * 6 + 2,
            color: color, alpha: 1
        });
    }
}

function addFloatingText(text, x, y, color = '#fef08a') {
    floatingTexts.push({ text: text, x: x, y: y, alpha: 1, color: color });
}

function updateAndDrawEffects() {
    backgroundGems.forEach(bg => {
        bg.x += bg.speedX;
        bg.y += bg.speedY;
        if (bg.x < 0) bg.x = canvas.width;
        if (bg.x > canvas.width) bg.x = 0;
        if (bg.y < 0) bg.y = canvas.height;
        if (bg.y > canvas.height) bg.y = 0;

        ctx.save();
        ctx.globalAlpha = 0.25;
        let gem = GEM_TYPES[bg.type];
        ctx.fillStyle = gem.color;
        ctx.beginPath();
        ctx.arc(bg.x, bg.y, bg.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    for (let i = fireworks.length - 1; i >= 0; i--) {
        let fw = fireworks[i];
        fw.x += fw.vx;
        fw.y += fw.vy;
        fw.vy += 0.08;
        fw.alpha -= fw.decay;
        if (fw.alpha <= 0) {
            fireworks.splice(i, 1);
        } else {
            ctx.save();
            ctx.globalAlpha = fw.alpha;
            ctx.fillStyle = fw.color;
            ctx.beginPath();
            ctx.arc(fw.x, fw.y, fw.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.035;
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

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        let ft = floatingTexts[i];
        ft.y -= 1.5;
        ft.alpha -= 0.025;
        if (ft.alpha <= 0) {
            floatingTexts.splice(i, 1);
        } else {
            ctx.save();
            ctx.globalAlpha = ft.alpha;
            ctx.fillStyle = ft.color;
            ctx.font = 'bold 20px Segoe UI';
            ctx.textAlign = 'center';
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }
    }
}

function drawGem(r, c, typeIdx) {
    let gem = GEM_TYPES[typeIdx];
    let cx = c * TILE_SIZE + TILE_SIZE / 2;
    let cy = r * TILE_SIZE + TILE_SIZE / 2;
    let size = TILE_SIZE * 0.40;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.arc(2, 4, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = gem.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    if (gem.shape === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(0, -size); ctx.lineTo(size, 0); ctx.lineTo(0, size); ctx.lineTo(-size, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (gem.shape === 'rhombus') {
        ctx.beginPath();
        ctx.rect(-size*0.8, -size*0.8, size*1.6, size*1.6);
        ctx.fill(); ctx.stroke();
    } else if (gem.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.9, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
    } else if (gem.shape === 'hexagon') {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            let angle = (Math.PI / 3) * i;
            let hx = size * Math.cos(angle);
            let hy = size * Math.sin(angle);
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(-size * 0.3, -size * 0.3, size * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function startGame() {
    gameState = 'PLAYING';
    score = 0;
    let config = getLevelConfig(currentLevel);
    movesLeft = config.moves;
    activePowerup = null;
    puHammerBtn.classList.remove('active');
    loadLevel();
}

function loadLevel() {
    GRID_SIZE = getGridSizeForLevel(currentLevel);
    TILE_SIZE = canvas.width / GRID_SIZE;

    let config = getLevelConfig(currentLevel);
    targetScore = config.target;
    
    scoreEl.textContent = score;
    document.getElementById('target-score').textContent = targetScore;
    movesEl.textContent = movesLeft;
    levelInfoEl.textContent = config.name;
    highScoreEl.textContent = highScore;
    
    initGrid();
    gameState = 'PLAYING';
    saveProgress();
    pauseBtn.textContent = "⏳";
    resetIdleTimer();
    draw();
}

function initGrid() {
    grid = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        grid[r] = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            grid[r][c] = Math.floor(Math.random() * GEM_TYPES.length);
        }
    }
}

// Boucle de rendu principale (draw)
function draw() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (shakeTime > 0) {
        let dx = (Math.random() - 0.5) * 8;
        let dy = (Math.random() - 0.5) * 8;
        ctx.translate(dx, dy);
        shakeTime--;
    }

    hintPulseTimer += 0.03;

    if (grid && grid.length > 0) {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                ctx.strokeStyle = 'rgba(252, 211, 77, 0.15)';
                ctx.lineWidth = 1;
                ctx.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);

                const val = grid[r][c];
                if (val !== null && val !== undefined) {
                    drawGem(r, c, val);
                }
                
                if (selectedTile && selectedTile.r === r && selectedTile.c === c) {
                    ctx.strokeStyle = activePowerup === 'hammer' ? '#34d399' : '#ffffff';
                    ctx.lineWidth = 5;
                    ctx.strokeRect(c * TILE_SIZE + 2, r * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                    ctx.strokeStyle = '#f472b6';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(c * TILE_SIZE + 4, r * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
                }

                if (suggestedMove && !selectedTile && gameState === 'PLAYING' && !activePowerup) {
                    let isHintTile = suggestedMove.some(pos => pos.r === r && pos.c === c);
                    if (isHintTile) {
                        let pulse = Math.abs(Math.sin(hintPulseTimer)) * 4 + 2;
                        ctx.strokeStyle = '#fef08a';
                        ctx.lineWidth = pulse;
                        ctx.strokeRect(c * TILE_SIZE + 3, r * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);
                    }
                }
            }
        }
    }

    updateAndDrawEffects();
    ctx.restore();

    if (gameState === 'MENU') {
        drawMainMenuOverlay();
    } else if (gameState === 'VICTORY') {
        drawVictoryProgressionOverlay();
    } else if (gameState === 'GAMEOVER') {
        drawGameOverOverlay();
    } else if (gameState === 'PAUSED') {
        drawOverlay("EN PAUSE", "#38bdf8", "Touchez pour Reprendre");
    }

    requestAnimationFrame(draw);
}

function drawMainMenuOverlay() {
    ctx.fillStyle = 'rgba(15, 3, 28, 0.94)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    updateAndDrawEffects();

    let boxX = 30; let boxY = 50; let boxW = canvas.width - 60; let boxH = 260;
    ctx.fillStyle = 'rgba(76, 29, 149, 0.85)';
    ctx.strokeStyle = '#fcd34d';
    ctx.lineWidth = 4;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 34px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText("✨ a-Lamina ✨", canvas.width / 2, boxY + 50);

    ctx.fillStyle = '#f472b6';
    ctx.font = 'bold 18px Segoe UI';
    ctx.fillText(`Aventure - Niveau ${currentLevel}`, canvas.width / 2, boxY + 95);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '15px Segoe UI';
    ctx.fillText(`Objectif : 0 / ${targetScore} pts`, canvas.width / 2, boxY + 130);

    let btnX = canvas.width / 2 - 90;
    let btnY = boxY + 165;
    let btnW = 180;
    let btnH = 54;

    ctx.fillStyle = '#10b981';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = '#34d399';
    ctx.fillRect(btnX, btnY, btnW, btnH - 6);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Segoe UI';
    ctx.fillText("▶ JOUER", canvas.width / 2, btnY + 34);
}

function drawVictoryProgressionOverlay() {
    ctx.fillStyle = 'rgba(15, 3, 28, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    updateAndDrawEffects();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 32px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText("✨ NIVEAU RÉUSSI ! ✨", canvas.width / 2, 60);

    ctx.font = '36px Segoe UI';
    ctx.fillText("⭐ ⭐ ⭐", canvas.width / 2, 110);

    let boxX = 35; let boxY = 130; let boxW = canvas.width - 70; let boxH = 150;
    ctx.fillStyle = 'rgba(76, 29, 149, 0.88)';
    ctx.strokeStyle = '#fcd34d';
    ctx.lineWidth = 4;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = '#fbcfe8';
    ctx.font = 'bold 17px Segoe UI';
    ctx.fillText(`Niveau ${currentLevel} ➔ Niveau ${currentLevel + 1}`, canvas.width / 2, boxY + 38);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px Segoe UI';
    ctx.fillText(`Score Validé : ${score} pts`, canvas.width / 2, boxY + 78);
    ctx.fillStyle = '#34d399';
    ctx.font = '15px Segoe UI';
    ctx.fillText(`Meilleur Record : ${highScore}`, canvas.width / 2, boxY + 115);

    let btnX = canvas.width / 2 - 110;
    let btnY = 300;
    let btnW = 220; let btnH = 50;

    ctx.fillStyle = '#10b981';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = '#34d399';
    ctx.fillRect(btnX, btnY, btnW, btnH - 5);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Segoe UI';
    ctx.fillText("🚀 CONTINUER", canvas.width / 2, btnY + 32);
}

function drawGameOverOverlay() {
    ctx.fillStyle = 'rgba(15, 3, 28, 0.94)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 32px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText("COUPS ÉPUISÉS !", canvas.width / 2, canvas.height / 2 - 60);

    ctx.fillStyle = '#fbcfe8';
    ctx.font = '14px Segoe UI';
    ctx.fillText("Regarde une pub pour +5 coups ou recommence", canvas.width / 2, canvas.height / 2 - 20);

    let btn1X = canvas.width / 2 - 110;
    let btn1Y = canvas.height / 2 + 10;
    let btnW = 220; let btnH = 45;

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(btn1X, btn1Y, btnW, btnH);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Segoe UI';
    ctx.fillText("📺 +5 Coups Magiques", canvas.width / 2, btn1Y + 28);

    let btn2Y = canvas.height / 2 + 65;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(btn1X, btn2Y, btnW, btnH);
    ctx.fillStyle = '#ffffff';
    ctx.fillText("🔄 Recommencer", canvas.width / 2, btn2Y + 28);
}

function drawOverlay(title, color, subtitle) {
    ctx.fillStyle = 'rgba(15, 3, 28, 0.88)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = color;
    ctx.font = 'bold 36px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 25);

    ctx.fillStyle = '#fbcfe8';
    ctx.font = '15px Segoe UI';
    ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 15);
}

function togglePause() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        pauseBtn.textContent = "▶️";
        clearTimeout(idleTimer);
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        pauseBtn.textContent = "⏳";
        resetIdleTimer();
    }
}

pauseBtn.addEventListener('click', togglePause);
window.addEventListener('blur', () => {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        pauseBtn.textContent = "▶️";
        clearTimeout(idleTimer);
    }
});

canvas.addEventListener('pointerdown', (e) => {
    initAudio();
    startBackgroundMusic();

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (gameState === 'MENU') {
        startGame();
        return;
    }
    if (gameState === 'PAUSED') {
        togglePause();
        return;
    }
    if (gameState === 'VICTORY') {
        let btnX = canvas.width / 2 - 110;
        let btnY = 300;
        let btnW = 220; let btnH = 50;

        if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
            requestAd('interstitial', () => {
                currentLevel++;
                saveProgress();
                startGame();
            });
        }
        return;
    }
    if (gameState === 'GAMEOVER') {
        let btn1X = canvas.width / 2 - 110;
        let btn1Y = canvas.height / 2 + 10;
        let btn2Y = canvas.height / 2 + 65;
        let btnW = 220; let btnH = 45;

        if (x >= btn1X && x <= btn1X + btnW && y >= btn1Y && y <= btn1Y + btnH) {
            requestAd('reward', (success) => {
                if (success) {
                    movesLeft += 5;
                    movesEl.textContent = movesLeft;
                    gameState = 'PLAYING';
                    resetIdleTimer();
                }
            });
        } else if (x >= btn1X && x <= btn1X + btnW && y >= btn2Y && y <= btn2Y + btnH) {
            startGame();
        }
        return;
    }

    if (isAnimating || movesLeft <= 0 || gameState !== 'PLAYING') return;
    
    resetIdleTimer();

    const c = Math.floor(x / TILE_SIZE);
    const r = Math.floor(y / TILE_SIZE);
    
    if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
        if (activePowerup === 'hammer') {
            useHammer(r, c);
            return;
        }

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
    }
});

function useHammer(r, c) {
    isAnimating = true;
    activePowerup = null;
    puHammerBtn.classList.remove('active');
    playSound('bonus');

    let val = grid[r][c];
    let px = c * TILE_SIZE + TILE_SIZE / 2;
    let py = r * TILE_SIZE + TILE_SIZE / 2;
    if (val !== null) {
        createParticles(px, py, GEM_TYPES[val].color);
    }
    grid[r][c] = null;
    shakeTime = 10;
    addFloatingText("🔨 CASSE !", px, py, '#34d399');

    setTimeout(() => {
        applyGravity();
        setTimeout(() => {
            let matches = findMatches();
            if (matches.length > 0) {
                processMatches(matches);
            } else {
                isAnimating = false;
                resetIdleTimer();
                checkGameStatus();
            }
        }, 300);
    }, 300);
}

function swapAndCheck(r1, c1, r2, c2) {
    let temp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = temp;

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
            resetIdleTimer();
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
                if (c < GRID_SIZE - 3 && val === grid[r][c+3]) matchedSet.add(`${r},${c+3}`);
            }
        }
    }
    for (let r = 0; r < GRID_SIZE - 2; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            let val = grid[r][c];
            if (val !== null && val === grid[r+1][c] && val === grid[r+2][c]) {
                matchedSet.add(`${r},${c}`); matchedSet.add(`${r+1},${c}`); matchedSet.add(`${r+2},${c}`);
                if (r < GRID_SIZE - 3 && val === grid[r+3][c]) matchedSet.add(`${r+3},${c}`);
            }
        }
    }
    return Array.from(matchedSet).map(s => {
        let parts = s.split(',');
        return { r: parseInt(parts[0]), c: parseInt(parts[1]) };
    });
}

function processMatches(matches) {
    let isBonus = matches.length >= 4;
    let pointsGained = matches.length * (isBonus ? 120 : 60);
    
    score += pointsGained;
    scoreEl.textContent = score;
    updateHighScore();

    if (isBonus) {
        playSound('bonus');
        launchFireworks();
    } else {
        playSound('match');
    }

    shakeTime = isBonus ? 14 : 6;
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
    addFloatingText(isBonus ? `⭐ COMBO +${pointsGained}` : `+${pointsGained}`, avgX, avgY, isBonus ? '#fef08a' : '#38bdf8');

    setTimeout(() => {
        applyGravity();
        setTimeout(() => {
            let chainMatches = findMatches();
            if (chainMatches.length > 0) {
                processMatches(chainMatches);
            } else {
                isAnimating = false;
                resetIdleTimer();
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

function updateHighScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('alamina_highscore', highScore);
    }
    highScoreEl.textContent = highScore;
}

function checkGameStatus() {
    if (gameState !== 'PLAYING') return;
    if (score >= targetScore) {
        gameState = 'VICTORY';
        clearTimeout(idleTimer);
        stopBackgroundMusic();
        playSound('win');
        launchFireworks();
    } else if (movesLeft <= 0) {
        gameState = 'GAMEOVER';
        clearTimeout(idleTimer);
        stopBackgroundMusic();
        playSound('gameover');
    }
}

// Initialisation au chargement
if (window.PokiSDK) window.PokiSDK.gameLoadingFinished();
score = 0;
GRID_SIZE = getGridSizeForLevel(currentLevel);
TILE_SIZE = canvas.width / GRID_SIZE;
let config = getLevelConfig(currentLevel);
targetScore = config.target;
levelInfoEl.textContent = config.name;
scoreEl.textContent = score;
movesEl.textContent = config.moves;
highScoreEl.textContent = highScore;
initGrid();
gameState = 'MENU';
startBackgroundMusic();
resetIdleTimer();

// Lancement immédiat de la boucle de rendu
draw();