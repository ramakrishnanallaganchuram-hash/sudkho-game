/* Sudoku game: everything the player sees and clicks. */
(function () {
  "use strict";

  const { generatePuzzle } = Sudoku;

  // ----- Page elements -----
  const boardEl = document.getElementById("board");
  const padEl = document.getElementById("pad");
  const timerEl = document.getElementById("timer");
  const mistakesEl = document.getElementById("mistakes");
  const hintsEl = document.getElementById("hints");
  const difficultyEl = document.getElementById("difficulty");
  const notesBtn = document.getElementById("notes");
  const winEl = document.getElementById("win");
  const winText = document.getElementById("win-text");

  // ----- Game state -----
  let puzzle = [];      // starting numbers (0 = empty)
  let solution = [];    // the full answer
  let values = [];      // what is on the board right now
  let notes = [];       // pencil marks: one Set per cell
  let history = [];     // for undo
  let selected = -1;
  let notesMode = false;
  let mistakes = 0;
  let hints = 0;
  let seconds = 0;
  let timerId = null;
  let won = false;

  const cells = [];
  const padButtons = [];

  // ----- Build the board and number pad once -----
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cell";
    if (c % 3 === 2 && c !== 8) btn.classList.add("box-right");
    if (r % 3 === 2 && r !== 8) btn.classList.add("box-bottom");
    btn.addEventListener("click", () => select(i));
    boardEl.appendChild(btn);
    cells.push(btn);
  }

  for (let d = 1; d <= 9; d++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `${d}<small></small>`;
    btn.setAttribute("aria-label", `Enter ${d}`);
    btn.addEventListener("click", () => enter(d));
    padEl.appendChild(btn);
    padButtons.push(btn);
  }

  // ----- Helpers -----
  const row = (i) => Math.floor(i / 9);
  const col = (i) => i % 9;
  const box = (i) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);
  const isPeer = (a, b) => a !== b && (row(a) === row(b) || col(a) === col(b) || box(a) === box(b));

  function format(s) {
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  }

  function snapshot() {
    history.push({ values: values.slice(), notes: notes.map((s) => new Set(s)) });
    if (history.length > 200) history.shift();
  }

  function removePeerNotes(index, digit) {
    for (let i = 0; i < 81; i++) {
      if (isPeer(index, i)) notes[i].delete(digit);
    }
  }

  // ----- Drawing -----
  function render() {
    for (let i = 0; i < 81; i++) {
      const el = cells[i];
      const v = values[i];
      const isGiven = puzzle[i] !== 0;

      el.classList.toggle("given", isGiven);
      el.classList.toggle("selected", i === selected);
      el.classList.toggle("peer", selected >= 0 && i !== selected && isPeer(selected, i));
      el.classList.toggle(
        "same",
        selected >= 0 && i !== selected && values[selected] !== 0 && v === values[selected]
      );
      el.classList.toggle("error", !isGiven && v !== 0 && v !== solution[i]);

      if (v !== 0) {
        el.innerHTML = `<span>${v}</span>`;
      } else if (notes[i].size > 0) {
        let html = '<div class="notes">';
        for (let d = 1; d <= 9; d++) html += `<span>${notes[i].has(d) ? d : ""}</span>`;
        el.innerHTML = html + "</div>";
      } else {
        el.innerHTML = "";
      }
      el.setAttribute(
        "aria-label",
        `Row ${row(i) + 1}, column ${col(i) + 1}, ${v ? "value " + v : "empty"}${isGiven ? ", given" : ""}`
      );
    }

    // Number pad: show how many of each digit are still missing
    for (let d = 1; d <= 9; d++) {
      let placed = 0;
      for (let i = 0; i < 81; i++) if (values[i] === d && solution[i] === d) placed++;
      const left = 9 - placed;
      padButtons[d - 1].disabled = left === 0;
      padButtons[d - 1].querySelector("small").textContent = left > 0 ? left : "";
    }

    mistakesEl.textContent = mistakes;
    hintsEl.textContent = hints;
    timerEl.textContent = format(seconds);
    notesBtn.textContent = `Notes: ${notesMode ? "on" : "off"}`;
    notesBtn.setAttribute("aria-pressed", String(notesMode));
  }

  // ----- Actions -----
  function select(i) {
    selected = i;
    render();
  }

  function enter(d) {
    if (selected < 0 || won || puzzle[selected] !== 0) return;

    if (notesMode) {
      if (values[selected] !== 0) return;
      snapshot();
      if (notes[selected].has(d)) notes[selected].delete(d);
      else notes[selected].add(d);
    } else {
      if (values[selected] === d) return;
      snapshot();
      values[selected] = d;
      notes[selected].clear();
      if (d !== solution[selected]) mistakes++;
      else removePeerNotes(selected, d);
    }
    render();
    checkWin();
  }

  function erase() {
    if (selected < 0 || won || puzzle[selected] !== 0) return;
    if (values[selected] === 0 && notes[selected].size === 0) return;
    snapshot();
    values[selected] = 0;
    notes[selected].clear();
    render();
  }

  function undo() {
    if (won || history.length === 0) return;
    const last = history.pop();
    values = last.values;
    notes = last.notes;
    render();
  }

  function toggleNotes() {
    notesMode = !notesMode;
    render();
  }

  function hint() {
    if (won) return;
    const needsHelp = (i) => values[i] !== solution[i];
    let target = -1;
    if (selected >= 0 && puzzle[selected] === 0 && needsHelp(selected)) {
      target = selected;
    } else {
      const options = [];
      for (let i = 0; i < 81; i++) if (needsHelp(i)) options.push(i);
      if (options.length === 0) return;
      target = options[Math.floor(Math.random() * options.length)];
    }
    snapshot();
    values[target] = solution[target];
    notes[target].clear();
    removePeerNotes(target, solution[target]);
    selected = target;
    hints++;
    render();
    checkWin();
  }

  function checkWin() {
    if (!values.every((v, i) => v === solution[i])) return;
    won = true;
    clearInterval(timerId);
    winText.textContent =
      `You finished in ${format(seconds)} with ${mistakes} mistake${mistakes === 1 ? "" : "s"} ` +
      `and ${hints} hint${hints === 1 ? "" : "s"}.`;
    winEl.hidden = false;
    document.getElementById("again").focus();
  }

  function newGame() {
    const game = generatePuzzle(difficultyEl.value);
    puzzle = game.puzzle;
    solution = game.solution;
    values = puzzle.slice();
    notes = Array.from({ length: 81 }, () => new Set());
    history = [];
    selected = -1;
    notesMode = false;
    mistakes = 0;
    hints = 0;
    seconds = 0;
    won = false;
    winEl.hidden = true;

    clearInterval(timerId);
    timerId = setInterval(() => {
      seconds++;
      timerEl.textContent = format(seconds);
    }, 1000);

    render();
  }

  // ----- Buttons -----
  document.getElementById("undo").addEventListener("click", undo);
  document.getElementById("erase").addEventListener("click", erase);
  document.getElementById("hint").addEventListener("click", hint);
  notesBtn.addEventListener("click", toggleNotes);
  document.getElementById("new").addEventListener("click", newGame);
  document.getElementById("again").addEventListener("click", newGame);
  difficultyEl.addEventListener("change", newGame);

  // ----- Keyboard -----
  document.addEventListener("keydown", (e) => {
    if (e.target === difficultyEl) return;

    if (e.key >= "1" && e.key <= "9") {
      enter(Number(e.key));
    } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
      erase();
    } else if (e.key.toLowerCase() === "n") {
      toggleNotes();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    } else if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      let i = selected < 0 ? 40 : selected;
      if (e.key === "ArrowUp" && row(i) > 0) i -= 9;
      if (e.key === "ArrowDown" && row(i) < 8) i += 9;
      if (e.key === "ArrowLeft" && col(i) > 0) i -= 1;
      if (e.key === "ArrowRight" && col(i) < 8) i += 1;
      select(i);
      cells[i].focus();
    }
  });

  newGame();
})();
