// a-Lamina - Moteur Corrigé (Victoire instantanée sur score atteint, suppression blocage)
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

let currentLevel = parseInt(localStorage.getItem('alamina_level')) || 1;
let score = parseInt(localStorage.getItem('alamina_score')) || 0;
let movesLeft = parseInt(localStorage.getItem('alamina_moves'));

function getGridSizeForLevel(lvl) {
    if (lvl === 1 || lvl === 2) return 6;
    if (lvl === 3) return 7;
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
let highScore = parseInt(localStorage.getItem('alamina_highscore')) || 0;

function getLevelConfig(lvl) {
    let size = getGridSizeForLevel(lvl);
    let totalCells = size * size;
    let target = Math.round(500 * Math.pow(1.35, lvl - 1) * (totalCells / 36));
    let defaultMoves = Math.max(10, 16 - Math.floor(lvl / 2));
    return {
        target: target,
        moves: defaultMoves,
        name: `Niveau ${lvl}`
    };
}

let levelConfig = getLevelConfig(currentLevel);
let targetScore = levelConfig.target;
if (isNaN(movesLeft) || movesLeft <= 0) {
    movesLeft = levelConfig.moves;
}

let selectedTile = null;
let isAnimating = false;
let gameState = 'MENU';
let particles = [];
let floatingTexts = [];
let backgroundGems = [];
let shakeTime = 0;

let soundMuted = false;
let musicMuted = false;
let backgroundMusicInterval = null;

for (let i = 0; i < 10; i++) {
    backgroundGems.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 14 + 8,
        speedY: (Math.random() - 0.5) * 0.4,
        speedX: (Math.random() - 0.5) * 0.4,
        type: Math.floor(Math.random() * GEM_TYPES.length)
    });
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

window.addEventListener('beforeunload', () => {
    localStorage.setItem('alamina_level', currentLevel);
    localStorage.setItem('alamina_score', score);
    localStorage.setItem('alamina_moves', movesLeft);
});

function saveProgress() {
    localStorage.setItem('alamina_level', currentLevel);
    localStorage.setItem('alamina_score', score);
    localStorage.setItem('alamina_moves', movesLeft);
}

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
});

modalSound.addEventListener('click', () => {
    soundMuted = !soundMuted;
    modalSound.textContent = soundMuted ? "🔇 Bruitages : DÉSACTIVÉS" : "🔊 Bruitages : ACTIVÉS";
});

modalMusic.addEventListener('click', () => {
    musicMuted = !musicMuted;
    modalMusic.textContent = musicMuted ? "🔕 Musique : DÉSACTIVÉE" : "🎶 Musique : ACTIVÉE";
    if (musicMuted) stopBackgroundMusic();
    else startBackgroundMusic();
});

modalRefresh.addEventListener('click', () => {
    score = 0;
    let config = getLevelConfig(currentLevel);
    movesLeft = config.moves;
    saveProgress();
    settingsModal.style.display = 'none';
    loadLevel();
});

modalReset.addEventListener('click', () => {
    if (confirm("Voulez-vous recommencer toute l'aventure au Niveau 1 ?")) {
        currentLevel = 1;
        score = 0;
        let config = getLevelConfig(1);
        movesLeft = config.moves;
        localStorage.clear();
        saveProgress();
        settingsModal.style.display = 'none';
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

function createParticles(pixelX, pixelY, color) {
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: pixelX, y: pixelY,
            vx: (Math.random() - 0.5) * 9,
            vy: (Math.random() - 0.5) * 9,
            size: Math.random() * 5 + 2,
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
        ctx.globalAlpha = 0.3;
        let gem = GEM_TYPES[bg.type];
        ctx.fillStyle = gem.color;
        ctx.beginPath();
        ctx.arc(bg.x, bg.y, bg.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

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
        ctx.roundRect(-size*0.8, -size*0.8, size*1.6, size*1.6, 6);
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
    startBackgroundMusic();
    loadLevel();
}

function loadLevel() {
    GRID_SIZE = getGridSizeForLevel(currentLevel);
    TILE_SIZE = canvas.width / GRID_SIZE;

    let config = getLevelConfig(currentLevel);
    targetScore = config.target;
    if (isNaN(movesLeft) || movesLeft <= 0) {
        movesLeft = config.moves;
    }
    
    scoreEl.textContent = score;
    document.getElementById('target-score').textContent = targetScore;
    movesEl.textContent = movesLeft;
    levelInfoEl.textContent = config.name;
    highScoreEl.textContent = highScore;
    saveProgress();
    pauseBtn.textContent = "⏸️";
    if (grid.length === 0 || grid.length !== GRID_SIZE) {
        initGrid();
    }
    checkGameStatus(); // Vérifie immédiatement si le score est déjà atteint
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

function draw() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (shakeTime > 0) {
        let dx = (Math.random() - 0.5) * 8;
        let dy = (Math.random() - 0.5) * 8;
        ctx.translate(dx, dy);
        shakeTime--;
    }

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
                // Contour lumineux très visible sur tous les cristaux
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 5;
                ctx.strokeRect(c * TILE_SIZE + 2, r * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                ctx.strokeStyle = '#f472b6';
                ctx.lineWidth = 2;
                ctx.strokeRect(c * TILE_SIZE + 4, r * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
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
        drawOverlay("EN PAUSE", "#38bdf8", "Touchez Pause pour Reprendre");
    }

    if (particles.length > 0 || floatingTexts.length > 0 || shakeTime > 0 || gameState !== 'PLAYING' || gameState === 'MENU') {
        requestAnimationFrame(draw);
    }
}

function drawMainMenuOverlay() {
    ctx.fillStyle = 'rgba(15, 3, 28, 0.92)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    updateAndDrawEffects();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 38px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText("a-Lamina", canvas.width / 2, canvas.height / 2 - 50);

    ctx.fillStyle = '#f472b6';
    ctx.font = '16px Segoe UI';
    ctx.fillText("L'Aventure des Cristaux Magiques", canvas.width / 2, canvas.height / 2 - 15);

    let btnX = canvas.width / 2 - 80;
    let btnY = canvas.height / 2 + 15;
    let btnW = 160;
    let btnH = 54;

    ctx.fillStyle = '#10b981';
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 27); ctx.fill();
    ctx.fillStyle = '#059669';
    ctx.beginPath(); ctx.roundRect(btnX, btnY + 6, btnW, btnH - 6, 27); ctx.fill();
    ctx.fillStyle = '#34d399';
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH - 6, 27); ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Segoe UI';
    ctx.fillText("▶ JOUER", canvas.width / 2, btnY + 34);
}

function drawVictoryProgressionOverlay() {
    ctx.fillStyle = 'rgba(15, 3, 28, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    updateAndDrawEffects();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 34px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText("✨ NIVEAU RÉUSSI ! ✨", canvas.width / 2, 70);

    ctx.font = '36px Segoe UI';
    ctx.fillText("⭐ ⭐ ⭐", canvas.width / 2, 120);

    let boxX = 40; let boxY = 145; let boxW = canvas.width - 80; let boxH = 140;
    ctx.fillStyle = 'rgba(76, 29, 149, 0.8)';
    ctx.strokeStyle = '#fcd34d';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, 16); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#fbcfe8';
    ctx.font = '16px Segoe UI';
    ctx.fillText(`Progression : ${currentLevel - 1} ➔ ${currentLevel}`, canvas.width / 2, boxY + 35);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px Segoe UI';
    ctx.fillText(`Score Validé : ${score} pts`, canvas.width / 2, boxY + 70);
    ctx.fillStyle = '#34d399';
    ctx.font = '15px Segoe UI';
    ctx.fillText(`Nouveau Record : ${highScore}`, canvas.width / 2, boxY + 105);

    let btnX = canvas.width / 2 - 110;
    let btnY = 310;
    let btnW = 220; let btnH = 50;

    ctx.fillStyle = '#10b981';
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 25); ctx.fill();
    ctx.fillStyle = '#059669';
    ctx.beginPath(); ctx.roundRect(btnX, btnY + 5, btnW, btnH - 5, 25); ctx.fill();
    ctx.fillStyle = '#34d399';
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH - 5, 25); ctx.fill();

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
    ctx.beginPath(); ctx.roundRect(btn1X, btn1Y, btnW, btnH, 22); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Segoe UI';
    ctx.fillText("📺 +5 Coups Magiques", canvas.width / 2, btn1Y + 28);

    let btn2Y = canvas.height / 2 + 65;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.roundRect(btn1X, btn2Y, btnW, btnH, 22); ctx.fill();
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
        draw();
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        pauseBtn.textContent = "⏸️";
        draw();
    }
}

pauseBtn.addEventListener('click', togglePause);
window.addEventListener('blur', () => {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        pauseBtn.textContent = "▶️";
        draw();
    }
});

canvas.addEventListener('pointerdown', (e) => {
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
        let btnY = 310;
        let btnW = 220; let btnH = 50;

        if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
            requestAd('interstitial', () => {
                currentLevel++; 
                score = 0; 
                let config = getLevelConfig(currentLevel);
                movesLeft = config.moves;
                loadLevel();
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
                    draw();
                }
            });
        } else if (x >= btn1X && x <= btn1X + btnW && y >= btn2Y && y <= btn2Y + btnH) {
            score = 0;
            movesLeft = getLevelConfig(currentLevel).moves;
            loadLevel();
        }
        return;
    }

    if (isAnimating || movesLeft <= 0 || gameState !== 'PLAYING') return;
    
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
            saveProgress();
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
    let baseMultiplier = GRID_SIZE * 15;
    let pointsGained = matches.length * (isBonus ? baseMultiplier * 2 : baseMultiplier);
    
    score += pointsGained;
    scoreEl.textContent = score;
    updateHighScore();
    saveProgress();

    if (isBonus) playSound('bonus');

    shakeTime = isBonus ? 14 : 8;
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
    addFloatingText(isBonus ? `SUPER COMBO +${pointsGained}` : `+${pointsGained}`, avgX, avgY, isBonus ? '#fef08a' : '#38bdf8');

    draw();

    setTimeout(() => {
        applyGravity();
        saveProgress();
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
        stopBackgroundMusic();
        playSound('win');
        draw();
    } else if (movesLeft <= 0) {
        gameState = 'GAMEOVER';
        stopBackgroundMusic();
        playSound('gameover');
        draw();
    }
}

// Initialisation au chargement
if (window.PokiSDK) window.PokiSDK.gameLoadingFinished();
GRID_SIZE = getGridSizeForLevel(currentLevel);
TILE_SIZE = canvas.width / GRID_SIZE;
let config = getLevelConfig(currentLevel);
targetScore = config.target;
levelInfoEl.textContent = config.name;
scoreEl.textContent = score;
movesEl.textContent = movesLeft;
highScoreEl.textContent = highScore;
initGrid();
checkGameStatus();
draw();