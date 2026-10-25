// a-Lamina - Moteur complet regroupé (Victory Dashboard, Match-4, Mode Daltonien & Auto-Save)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const movesEl = document.getElementById('moves');
const levelInfoEl = document.getElementById('level-info');
const gameContainer = document.getElementById('game-container');
const pauseBtn = document.getElementById('pause-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const modalSound = document.getElementById('modal-sound');
const modalMusic = document.getElementById('modal-music');
const modalColorblind = document.getElementById('modal-colorblind');
const modalRefresh = document.getElementById('modal-refresh');
const modalReset = document.getElementById('modal-reset');
const modalClose = document.getElementById('modal-close');

const puHammerBtn = document.getElementById('pu-hammer');
const puShuffleBtn = document.getElementById('pu-shuffle');
const hammerBadge = document.getElementById('hammer-badge');
const shuffleBadge = document.getElementById('shuffle-badge');

let currentLevel = parseInt(localStorage.getItem('alamina_level')) || 1;
let maxUnlockedLevel = parseInt(localStorage.getItem('alamina_max_level')) || currentLevel;
let highScore = parseInt(localStorage.getItem('alamina_highscore')) || 0;
let score = parseInt(localStorage.getItem('alamina_score')) || 0;
let levelStars = JSON.parse(localStorage.getItem('alamina_stars')) || {};

let hammerUsesLeft = 3;
let shuffleUsesLeft = 2;
let comboMultiplier = 1;
let colorblindMode = localStorage.getItem('alamina_colorblind') === 'true';

function updatePowerupBadges() {
    hammerBadge.textContent = hammerUsesLeft;
    shuffleBadge.textContent = shuffleUsesLeft;
    puHammerBtn.style.opacity = hammerUsesLeft > 0 ? '1' : '0.4';
    puShuffleBtn.style.opacity = shuffleUsesLeft > 0 ? '1' : '0.4';
}

function getThemeForLevel(lvl) {
    if (lvl === 1 || lvl === 2) {
        return {
            name: "Cristaux Magiques",
            backgroundGradient: "linear-gradient(180deg, #4c1d95 0%, #2e1065 100%)",
            borderColor: "#f472b6",
            items: [
                { color: '#f43f5e', shape: 'diamond', symbol: '▲' },
                { color: '#38bdf8', shape: 'star', symbol: '★' },
                { color: '#fbbf24', shape: 'circle', symbol: '●' },
                { color: '#34d399', shape: 'hexagon', symbol: '■' }
            ]
        };
    } else if (lvl === 3 || lvl === 4) {
        return {
            name: "Fruits Juteux 🍓",
            backgroundGradient: "linear-gradient(180deg, #065f46 0%, #064e3b 100%)",
            borderColor: '#34d399',
            items: [
                { color: '#ef4444', shape: 'circle', symbol: '🍓' },
                { color: '#f59e0b', shape: 'star', symbol: '🍍' },
                { color: '#eab308', shape: 'diamond', symbol: '🍋' },
                { color: '#10b981', shape: 'hexagon', symbol: '🍏' }
            ]
        };
    } else if (lvl === 5 || lvl === 6) {
        return {
            name: "Animaux Mignons 🐾",
            backgroundGradient: "linear-gradient(180deg, #1e3a8a 0%, #172554 100%)",
            borderColor: '#60a5fa',
            items: [
                { color: '#ec4899', shape: 'circle', symbol: '🐼' },
                { color: '#0ea5e9', shape: 'star', symbol: '🦊' },
                { color: '#eab308', shape: 'diamond', symbol: '🐰' },
                { color: '#8b5cf6', shape: 'hexagon', symbol: '🐨' }
            ]
        };
    } else {
        return {
            name: "Bonbonland 🍬",
            backgroundGradient: "linear-gradient(180deg, #9d174d 0%, #701a75 100%)",
            borderColor: '#f472b6',
            items: [
                { color: '#f43f5e', shape: 'diamond', symbol: '🍬' },
                { color: '#06b6d4', shape: 'star', symbol: '🍭' },
                { color: '#f59e0b', shape: 'circle', symbol: '🍫' },
                { color: '#10b981', shape: 'hexagon', symbol: '🍩' }
            ]
        };
    }
}

let currentTheme = getThemeForLevel(currentLevel);
let GEM_TYPES = currentTheme.items;

function applyThemeVisuals() {
    currentTheme = getThemeForLevel(currentLevel);
    GEM_TYPES = currentTheme.items;
    gameContainer.style.background = currentTheme.backgroundGradient;
    gameContainer.style.borderColor = currentTheme.borderColor;
    document.getElementById('colorblind-txt').textContent = colorblindMode ? "ACTIVÉ" : "DÉSACTIVÉ";
}

function getGridSizeForLevel(lvl) {
    if (lvl === 1 || lvl === 2) return 6;
    if (lvl === 3 || lvl === 4) return 7;
    if (lvl === 5 || lvl === 6) return 8;
    return Math.min(9, 6 + Math.floor((lvl - 1) / 2));
}

let GRID_SIZE = getGridSizeForLevel(currentLevel);
let TILE_SIZE = canvas.width / GRID_SIZE;
let grid = [];

function getLevelConfig(lvl) {
    let baseTarget = 450 + (lvl - 1) * 280 + Math.floor(Math.pow(lvl, 1.15) * 80);
    baseTarget = Math.round(baseTarget / 50) * 50;
    return {
        target: baseTarget,
        moves: 18,
        name: `Niv. ${lvl}`
    };
}

let levelConfig = getLevelConfig(currentLevel);
let targetScore = levelConfig.target;
let movesLeft = parseInt(localStorage.getItem('alamina_moves')) || levelConfig.moves;

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
        type: Math.floor(Math.random() * 4)
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
    if (hammerUsesLeft <= 0) {
        addFloatingText("❌ PLUS DE MARTEAU !", canvas.width / 2, canvas.height / 2, '#f43f5e');
        playSound('gameover');
        return;
    }
    activePowerup = activePowerup === 'hammer' ? null : 'hammer';
    puHammerBtn.classList.toggle('active', activePowerup === 'hammer');
    playSound('select');
    selectedTile = null;
});

puShuffleBtn.addEventListener('click', () => {
    if (gameState !== 'PLAYING' || isAnimating) return;
    if (shuffleUsesLeft <= 0) {
        addFloatingText("❌ PLUS DE MÉLANGE !", canvas.width / 2, canvas.height / 2, '#f43f5e');
        playSound('gameover');
        return;
    }
    shuffleUsesLeft--;
    updatePowerupBadges();
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
    localStorage.setItem('alamina_max_level', maxUnlockedLevel);
    localStorage.setItem('alamina_highscore', highScore);
    localStorage.setItem('alamina_score', score);
    localStorage.setItem('alamina_moves', movesLeft);
    localStorage.setItem('alamina_stars', JSON.stringify(levelStars));
    localStorage.setItem('alamina_colorblind', colorblindMode);
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
    adOverlay.style.backgroundColor = 'rgba(15, 23, 42, 0.96)';
    adOverlay.style.display = 'flex';
    adOverlay.style.flexDirection = 'column';
    adOverlay.style.justifyContent = 'center';
    adOverlay.style.alignItems = 'center';
    adOverlay.style.zIndex = '1000';
    adOverlay.style.color = '#f8fafc';
    adOverlay.style.fontFamily = 'Segoe UI, sans-serif';
    
    let title = type === 'reward' ? "Cadeau Magique (+5 Coups)" : "Portail Magique Interstitiel";
    adOverlay.innerHTML = `
        <h2 style="color: #fde047; margin-bottom: 10px;">✨ ${title} ✨</h2>
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

modalColorblind.addEventListener('click', () => {
    colorblindMode = !colorblindMode;
    document.getElementById('colorblind-txt').textContent = colorblindMode ? "ACTIVÉ" : "DÉSACTIVÉ";
    saveProgress();
});

modalRefresh.addEventListener('click', () => {
    score = 0;
    comboMultiplier = 1;
    let config = getLevelConfig(currentLevel);
    movesLeft = config.moves;
    hammerUsesLeft = 3;
    shuffleUsesLeft = 2;
    updatePowerupBadges();
    settingsModal.style.display = 'none';
    loadLevel();
});

modalReset.addEventListener('click', () => {
    if (confirm("Voulez-vous recommencer toute l'aventure au Niveau 1 ?")) {
        currentLevel = 1;
        maxUnlockedLevel = 1;
        score = 0;
        comboMultiplier = 1;
        levelStars = {};
        localStorage.clear();
        applyThemeVisuals();
        let config = getLevelConfig(1);
        movesLeft = config.moves;
        hammerUsesLeft = 3;
        shuffleUsesLeft = 2;
        updatePowerupBadges();
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
        let item = GEM_TYPES[bg.type];
        ctx.fillStyle = item.color;
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
    let item = GEM_TYPES[typeIdx];
    let cx = c * TILE_SIZE + TILE_SIZE / 2;
    let cy = r * TILE_SIZE + TILE_SIZE / 2;
    let size = TILE_SIZE * 0.38;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(2, 4, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = item.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;

    if (item.shape === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.85, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.85, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (item.shape === 'star') {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            let angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
            let x = Math.cos(angle) * size;
            let y = Math.sin(angle) * size;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            let angleInner = angle + Math.PI / 5;
            let xInner = Math.cos(angleInner) * (size * 0.45);
            let yInner = Math.sin(angleInner) * (size * 0.45);
            ctx.lineTo(xInner, yInner);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (item.shape === 'hexagon') {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            let angle = (Math.PI / 3) * i;
            let x = size * Math.cos(angle);
            let y = size * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.arc(-size * 0.3, -size * 0.3, size * 0.3, 0, Math.PI * 2);
    ctx.fill();

    if (colorblindMode && item.symbol) {
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 13px Segoe UI';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.symbol, 0, 1);
    }

    ctx.restore();
}

function startGame() {
    gameState = 'PLAYING';
    score = 0;
    comboMultiplier = 1;
    applyThemeVisuals();
    let config = getLevelConfig(currentLevel);
    movesLeft = config.moves;
    hammerUsesLeft = 3;
    shuffleUsesLeft = 2;
    updatePowerupBadges();
    activePowerup = null;
    puHammerBtn.classList.remove('active');
    loadLevel();
}

function loadLevel() {
    applyThemeVisuals();
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

    if (gameState === 'PLAYING' || gameState === 'PAUSED') {
        if (grid && grid.length > 0) {
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
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
    }

    updateAndDrawEffects();
    ctx.restore();

    if (gameState === 'MENU') {
        drawMainMenuOverlay();
    } else if (gameState === 'MAP') {
        drawLevelMapOverlay();
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
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    updateAndDrawEffects();

    let boxX = 24; let boxY = 40; let boxW = canvas.width - 48; let boxH = 295;
    ctx.fillStyle = 'rgba(76, 29, 149, 0.9)';
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 32px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText("✨ a-Lamina ✨", canvas.width / 2, boxY + 55);

    ctx.fillStyle = '#f472b6';
    ctx.font = 'bold 18px Segoe UI';
    ctx.fillText(`Niv. Actuel : ${currentLevel}`, canvas.width / 2, boxY + 95);

    let btnX = canvas.width / 2 - 110;
    let btnY1 = boxY + 125;
    let btnW = 220; let btnH = 50;

    ctx.fillStyle = '#047857';
    ctx.beginPath(); ctx.roundRect(btnX, btnY1 + 5, btnW, btnH, 16); ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.beginPath(); ctx.roundRect(btnX, btnY1, btnW, btnH, 16); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Segoe UI';
    ctx.fillText("▶ JOUER", canvas.width / 2, btnY1 + 32);

    let btnY2 = boxY + 190;
    ctx.fillStyle = '#0369a1';
    ctx.beginPath(); ctx.roundRect(btnX, btnY2 + 5, btnW, btnH, 16); ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.roundRect(btnX, btnY2, btnW, btnH, 16); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Segoe UI';
    ctx.fillText("🗺️ Carte Niveaux", canvas.width / 2, btnY2 + 31);
}

function drawLevelMapOverlay() {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.97)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    updateAndDrawEffects();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 26px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText("🗺️ Carte des Niveaux", canvas.width / 2, 45);

    let cols = 3;
    let startX = 40;
    let startY = 75;
    let size = 90;
    let gap = 16;

    for (let i = 1; i <= 6; i++) {
        let r = Math.floor((i - 1) / cols);
        let c = (i - 1) % cols;
        let x = startX + c * (size + gap);
        let y = startY + r * (size + gap);

        let isUnlocked = i <= maxUnlockedLevel;

        ctx.fillStyle = isUnlocked ? 'rgba(76, 29, 149, 0.92)' : 'rgba(30, 41, 59, 0.8)';
        ctx.strokeStyle = isUnlocked ? '#fef08a' : '#64748b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isUnlocked ? '#fef08a' : '#94a3b8';
        ctx.font = 'bold 20px Segoe UI';
        ctx.fillText(`Niv ${i}`, x + size / 2, y + 32);

        if (isUnlocked) {
            let stars = levelStars[i] || (i < currentLevel ? 3 : 0);
            let starTxt = stars === 3 ? "⭐⭐⭐" : (stars === 2 ? "⭐⭐" : (stars === 1 ? "⭐" : ""));
            ctx.font = '14px Segoe UI';
            ctx.fillText(starTxt, x + size / 2, y + 66);
        } else {
            ctx.font = '22px Segoe UI';
            ctx.fillText("🔒", x + size / 2, y + 62);
        }
    }

    let btnX = canvas.width / 2 - 110;
    let btnY = 325;
    let btnW = 220; let btnH = 44;

    ctx.fillStyle = '#334155';
    ctx.beginPath(); ctx.roundRect(btnX, btnY + 4, btnW, btnH, 14); ctx.fill();
    ctx.fillStyle = '#64748b';
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 14); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px Segoe UI';
    ctx.fillText("⬅️ Menu Principal", canvas.width / 2, btnY + 28);
}

// 🏆 Tableau de Bord de Fin de Niveau (Victory Dashboard)
function drawVictoryProgressionOverlay() {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    updateAndDrawEffects();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 28px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText("✨ VICTOIRE MAGIQUE ! ✨", canvas.width / 2, 45);

    ctx.font = '34px Segoe UI';
    ctx.fillText("⭐ ⭐ ⭐", canvas.width / 2, 88);

    let boxX = 25; let boxY = 100; let boxW = canvas.width - 50; let boxH = 160;
    ctx.fillStyle = 'rgba(76, 29, 149, 0.92)';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, 18); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#fbcfe8';
    ctx.font = 'bold 16px Segoe UI';
    ctx.fillText(`Niveau ${currentLevel} Complété avec succès !`, canvas.width / 2, boxY + 30);
    
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px Segoe UI';
    ctx.fillText(`🎯 Score Final : ${score} pts`, canvas.width / 2, boxY + 68);

    ctx.fillStyle = '#34d399';
    ctx.font = '15px Segoe UI';
    ctx.fillText(`🏆 Meilleur Record : ${highScore} pts`, canvas.width / 2, boxY + 98);

    ctx.fillStyle = '#fde047';
    ctx.font = '14px Segoe UI';
    ctx.fillText(`⚡ Bonus Coups restants convertis !`, canvas.width / 2, boxY + 130);

    let btnX = canvas.width / 2 - 110;
    let btnY1 = 270;
    let btnY2 = 322;
    let btnW = 220; let btnH = 42;

    ctx.fillStyle = '#047857'; ctx.beginPath(); ctx.roundRect(btnX, btnY1 + 4, btnW, btnH, 14); ctx.fill();
    ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.roundRect(btnX, btnY1, btnW, btnH, 14); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 17px Segoe UI';
    ctx.fillText("🚀 Niveau Suivant", canvas.width / 2, btnY1 + 27);

    ctx.fillStyle = '#0369a1'; ctx.beginPath(); ctx.roundRect(btnX, btnY2 + 4, btnW, btnH, 14); ctx.fill();
    ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.roundRect(btnX, btnY2, btnW, btnH, 14); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText("🗺️ Voir la Carte", canvas.width / 2, btnY2 + 27);
}

function drawGameOverOverlay() {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
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
    let btn2Y = canvas.height / 2 + 62;
    let btnW = 220; let btnH = 42;

    ctx.fillStyle = '#0369a1'; ctx.beginPath(); ctx.roundRect(btn1X, btn1Y + 4, btnW, btnH, 14); ctx.fill();
    ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.roundRect(btn1X, btn1Y, btnW, btnH, 14); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Segoe UI';
    ctx.fillText("📺 +5 Coups Magiques", canvas.width / 2, btn1Y + 27);

    ctx.fillStyle = '#9f1239'; ctx.beginPath(); ctx.roundRect(btn1X, btn2Y + 4, btnW, btnH, 14); ctx.fill();
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.roundRect(btn1X, btn2Y, btnW, btnH, 14); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText("🔄 Recommencer", canvas.width / 2, btn2Y + 27);
}

function drawOverlay(title, color, subtitle) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
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
        let boxY = 40;
        let btnX = canvas.width / 2 - 110;
        let btnY1 = boxY + 125;
        let btnY2 = boxY + 190;
        let btnW = 220; let btnH = 50;

        if (x >= btnX && x <= btnX + btnW && y >= btnY1 && y <= btnY1 + btnH) {
            startGame();
        } else if (x >= btnX && x <= btnX + btnW && y >= btnY2 && y <= btnY2 + btnH) {
            gameState = 'MAP';
        }
        return;
    }

    if (gameState === 'MAP') {
        let cols = 3;
        let startX = 40;
        let startY = 75;
        let size = 90;
        let gap = 16;

        for (let i = 1; i <= 6; i++) {
            let r = Math.floor((i - 1) / cols);
            let c = (i - 1) % cols;
            let nx = startX + c * (size + gap);
            let ny = startY + r * (size + gap);

            if (x >= nx && x <= nx + size && y >= ny && y <= ny + size) {
                if (i <= maxUnlockedLevel) {
                    currentLevel = i;
                    score = 0;
                    comboMultiplier = 1;
                    applyThemeVisuals();
                    startGame();
                }
                return;
            }
        }

        let btnX = canvas.width / 2 - 110;
        let btnY = 325;
        let btnW = 220; let btnH = 44;
        if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
            gameState = 'MENU';
        }
        return;
    }

    if (gameState === 'PAUSED') {
        togglePause();
        return;
    }

    if (gameState === 'VICTORY') {
        let btnX = canvas.width / 2 - 110;
        let btnY1 = 270;
        let btnY2 = 322;
        let btnW = 220; let btnH = 42;

        if (x >= btnX && x <= btnX + btnW && y >= btnY1 && y <= btnY1 + btnH) {
            requestAd('interstitial', () => {
                currentLevel++;
                if (currentLevel > maxUnlockedLevel) maxUnlockedLevel = currentLevel;
                comboMultiplier = 1;
                applyThemeVisuals();
                saveProgress();
                startGame();
            });
        } else if (x >= btnX && x <= btnX + btnW && y >= btnY2 && y <= btnY2 + btnH) {
            gameState = 'MAP';
        }
        return;
    }

    if (gameState === 'GAMEOVER') {
        let btn1X = canvas.width / 2 - 110;
        let btn1Y = canvas.height / 2 + 10;
        let btn2Y = canvas.height / 2 + 62;
        let btnW = 220; let btnH = 42;

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
            if (hammerUsesLeft > 0) {
                hammerUsesLeft--;
                updatePowerupBadges();
                useHammer(r, c);
            }
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
    comboMultiplier = 1;
    addFloatingText("🔨 CASSE !", px, py, '#34d399');

    setTimeout(() => {
        applyGravity();
        setTimeout(() => {
            let matches = findMatches();
            if (matches.length > 0) {
                processMatches(matches, true);
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
            comboMultiplier = 1;
            playSound('match');
            processMatches(matches, false);
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

function processMatches(matches, isChain) {
    if (isChain) {
        comboMultiplier = Math.min(comboMultiplier + 0.5, 3.5);
    }

    let isSuperBonus = matches.length >= 4;
    let basePoints = matches.length * 45;
    let pointsGained = Math.round(basePoints * comboMultiplier * (isSuperBonus ? 1.5 : 1.0));
    
    score += pointsGained;
    scoreEl.textContent = score;
    updateHighScore();

    if (isSuperBonus) {
        playSound('bonus');
        launchFireworks();
    } else {
        playSound('match');
    }

    shakeTime = isSuperBonus ? 16 : 6;
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
    let comboTxt = isSuperBonus ? `⭐ SUPER COMBO ! +${pointsGained}` : `+${pointsGained}`;
    addFloatingText(comboTxt, avgX, avgY, isSuperBonus ? '#fef08a' : '#38bdf8');

    setTimeout(() => {
        applyGravity();
        setTimeout(() => {
            let chainMatches = findMatches();
            if (chainMatches.length > 0) {
                processMatches(chainMatches, true);
            } else {
                comboMultiplier = 1;
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
    saveProgress();
}

function checkGameStatus() {
    if (gameState !== 'PLAYING') return;
    if (score >= targetScore) {
        score += movesLeft * 50;
        scoreEl.textContent = score;
        updateHighScore();

        gameState = 'VICTORY';
        clearTimeout(idleTimer);
        stopBackgroundMusic();
        playSound('win');
        launchFireworks();

        levelStars[currentLevel] = 3;
        if (currentLevel >= maxUnlockedLevel) {
            maxUnlockedLevel = currentLevel + 1;
        }
        saveProgress();
    } else if (movesLeft <= 0) {
        gameState = 'GAMEOVER';
        clearTimeout(idleTimer);
        stopBackgroundMusic();
        playSound('gameover');
    }
}

// Initialisation au chargement
if (window.PokiSDK) window.PokiSDK.gameLoadingFinished();
applyThemeVisuals();
GRID_SIZE = getGridSizeForLevel(currentLevel);
TILE_SIZE = canvas.width / GRID_SIZE;
let config = getLevelConfig(currentLevel);
targetScore = config.target;
levelInfoEl.textContent = config.name;
scoreEl.textContent = score;
movesEl.textContent = movesLeft;
highScoreEl.textContent = highScore;
hammerUsesLeft = 3;
shuffleUsesLeft = 2;
updatePowerupBadges();
initGrid();
gameState = 'MENU';
startBackgroundMusic();
resetIdleTimer();

draw();