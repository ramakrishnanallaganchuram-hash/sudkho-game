/* Sudoku core logic: no browser code in here, so it can be tested with Node. */
(function (root) {
  "use strict";

  // How many numbers are already filled in at the start
  const CLUES = { easy: 40, medium: 32, hard: 26 };

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Which numbers (1-9) can legally go in cell i?
  function candidates(grid, i) {
    const r = Math.floor(i / 9);
    const c = i % 9;
    let used = 0;
    for (let k = 0; k < 9; k++) {
      used |= 1 << grid[r * 9 + k];
      used |= 1 << grid[k * 9 + c];
    }
    const br = r - (r % 3);
    const bc = c - (c % 3);
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        used |= 1 << grid[(br + dr) * 9 + bc + dc];
      }
    }
    const out = [];
    for (let v = 1; v <= 9; v++) if (!(used & (1 << v))) out.push(v);
    return out;
  }

  // Find the empty cell with the fewest options (makes solving fast)
  function pickCell(grid) {
    let best = -1;
    let bestCands = null;
    for (let i = 0; i < 81; i++) {
      if (grid[i] !== 0) continue;
      const cands = candidates(grid, i);
      if (cands.length === 0) return { index: i, cands: [] };
      if (!bestCands || cands.length < bestCands.length) {
        best = i;
        bestCands = cands;
        if (cands.length === 1) break;
      }
    }
    return { index: best, cands: bestCands };
  }

  // Fill an empty grid with a random complete, valid solution
  function fillGrid(grid) {
    const { index, cands } = pickCell(grid);
    if (index === -1) return true;
    for (const v of shuffle(cands.slice())) {
      grid[index] = v;
      if (fillGrid(grid)) return true;
    }
    grid[index] = 0;
    return false;
  }

  // Count solutions (stops counting at `limit`). A good puzzle has exactly 1.
  function countSolutions(grid, limit = 2) {
    let count = 0;
    function solve() {
      const { index, cands } = pickCell(grid);
      if (index === -1) {
        count++;
        return;
      }
      for (const v of cands) {
        grid[index] = v;
        solve();
        if (count >= limit) break;
      }
      grid[index] = 0;
    }
    solve();
    return count;
  }

  function generatePuzzle(difficulty = "medium") {
    const solution = new Array(81).fill(0);
    fillGrid(solution);

    const puzzle = solution.slice();
    const target = 81 - (CLUES[difficulty] || CLUES.medium);
    let removed = 0;

    for (const pos of shuffle([...Array(81).keys()])) {
      if (removed >= target) break;
      const backup = puzzle[pos];
      puzzle[pos] = 0;
      // Only keep the removal if the puzzle still has exactly one solution
      if (countSolutions(puzzle.slice(), 2) === 1) {
        removed++;
      } else {
        puzzle[pos] = backup;
      }
    }
    return { puzzle, solution };
  }

  // Is this a fully filled, valid sudoku grid?
  function isValidSolution(grid) {
    if (grid.length !== 81) return false;
    const full = 0b1111111110;
    for (let n = 0; n < 9; n++) {
      let row = 0, col = 0, box = 0;
      for (let k = 0; k < 9; k++) {
        row |= 1 << grid[n * 9 + k];
        col |= 1 << grid[k * 9 + n];
        const r = Math.floor(n / 3) * 3 + Math.floor(k / 3);
        const c = (n % 3) * 3 + (k % 3);
        box |= 1 << grid[r * 9 + c];
      }
      if (row !== full || col !== full || box !== full) return false;
    }
    return true;
  }

  const api = { CLUES, generatePuzzle, countSolutions, isValidSolution };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Sudoku = api;
})(typeof self !== "undefined" ? self : globalThis);
