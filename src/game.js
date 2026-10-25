// a-lamina - Logique principale du jeu
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const movesEl = document.getElementById('moves');

const GRID_SIZE = 6;
const TILE_SIZE = canvas.width / GRID_SIZE;
const COLORS = ['#f43f5e', '#38bdf8', '#fbbf24', '#34d399']; // Rouge, Bleu, Jaune, Vert

let grid = [];
let score = 0;
let targetScore = 500;
let movesLeft = 15;
let selectedTile = null;
let isAnimating = false;

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
}

canvas.addEventListener('pointerdown', (e) => {
    if (isAnimating || movesLeft <= 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const c = Math.floor(x / TILE_SIZE);
    const r = Math.floor(y / TILE_SIZE);
    
    if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
        if (!selectedTile) {
            selectedTile = { r, c };
        } else {
            const isAdjacent = Math.abs(selectedTile.r - r) + Math.abs(selectedTile.c - c) === 1;
            if (isAdjacent) {
                isAnimating = true;
                swapAndCheck(selectedTile.r, selectedTile.c, r, c);
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
                matchedSet.add(`${r},${c}`);
                matchedSet.add(`${r},${c+1}`);
                matchedSet.add(`${r},${c+2}`);
            }
        }
    }

    for (let r = 0; r < GRID_SIZE - 2; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            let val = grid[r][c];
            if (val !== null && val === grid[r+1][c] && val === grid[r+2][c]) {
                matchedSet.add(`${r},${c}`);
                matchedSet.add(`${r+1},${c}`);
                matchedSet.add(`${r+2},${c}`);
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

    matches.forEach(m => {
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
        setTimeout(() => {
            alert("Bravo ! Niveau 1 réussi !");
            resetGame();
        }, 100);
    } else if (movesLeft <= 0) {
        setTimeout(() => {
            alert("Partie terminée ! Réessayez !");
            resetGame();
        }, 100);
    }
}

function resetGame() {
    score = 0;
    movesLeft = 15;
    scoreEl.textContent = score;
    movesEl.textContent = movesLeft;
    initGrid();
    draw();
}

initGrid();
draw();