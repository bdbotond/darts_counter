import { DartsMatch, isFinishPossible } from "./darts-engine.js";
import { Tournament } from "./tournament.js";
import { SyncManager } from "./sync.js";

// Global instances
const sync = new SyncManager(true);
let activeMatch = null;
let activeTournament = null;
let currentTournamentMatch = null; // metadata if current match belongs to tournament

// Keypad mode temporary state
let keypadDarts = [];
let currentMultiplier = 1;

// DOM Elements
const views = {
  home: document.getElementById("view-home"),
  matchSetup: document.getElementById("view-match-setup"),
  scorer: document.getElementById("view-scorer"),
  tourneySetup: document.getElementById("view-tournament-setup"),
  tourneyDash: document.getElementById("view-tournament-dashboard")
};

const navBtns = {
  home: document.getElementById("nav-home"),
  quickMatch: document.getElementById("nav-quick-match"),
  tournament: document.getElementById("nav-tournament"),
  midStats: document.getElementById("nav-tourney-stats")
};

// Switch view
function showView(viewName) {
  Object.values(views).forEach(v => v.style.display = "none");
  Object.values(navBtns).forEach(b => b.classList.remove("active"));

  if (views[viewName]) {
    views[viewName].style.display = "block";
  }

  if (viewName === "home") navBtns.home.classList.add("active");
  else if (viewName === "matchSetup" || viewName === "scorer") navBtns.quickMatch.classList.add("active");
  else if (viewName === "tourneySetup" || viewName === "tourneyDash") navBtns.tournament.classList.add("active");

  if (activeTournament && (viewName === "tourneyDash" || viewName === "scorer")) {
    navBtns.midStats.style.display = "inline-flex";
  } else {
    navBtns.midStats.style.display = "none";
  }
}

// Navigation event listeners
navBtns.home.addEventListener("click", () => showView("home"));
navBtns.quickMatch.addEventListener("click", () => {
  if (activeMatch && !activeMatch.isFinished) showView("scorer");
  else showView("matchSetup");
});
navBtns.tournament.addEventListener("click", () => {
  if (activeTournament) showView("tourneyDash");
  else showView("tourneySetup");
});
navBtns.midStats.addEventListener("click", openMidTournamentStats);

document.getElementById("btn-start-quick-match").addEventListener("click", () => showView("matchSetup"));
document.getElementById("btn-start-tourney-setup").addEventListener("click", () => showView("tourneySetup"));
document.getElementById("btn-cancel-match-setup").addEventListener("click", () => showView("home"));
document.getElementById("btn-cancel-tourney-setup").addEventListener("click", () => showView("home"));

// --- Match Setup & Launch ---
document.getElementById("setup-game-type").addEventListener("change", (e) => {
  const customGroup = document.getElementById("setup-custom-score-group");
  customGroup.style.display = e.target.value === "custom" ? "block" : "none";
});

document.getElementById("btn-launch-match").addEventListener("click", () => {
  const p1 = document.getElementById("setup-p1-name").value.trim() || "Player 1";
  const p2 = document.getElementById("setup-p2-name").value.trim() || "Player 2";
  const typeVal = document.getElementById("setup-game-type").value;
  let startingScore = parseInt(typeVal, 10);
  if (typeVal === "custom") {
    startingScore = parseInt(document.getElementById("setup-custom-score").value, 10) || 501;
  }
  const legsToWin = parseInt(document.getElementById("setup-legs-to-win").value, 10) || 3;
  const doubleOut = document.getElementById("setup-out-mode").value === "double";
  const trackDoubles = document.getElementById("setup-track-doubles").checked;

  currentTournamentMatch = null;
  document.getElementById("tournament-context-badge").style.display = "none";

  startMatch({
    player1: p1,
    player2: p2,
    startingScore,
    legsToWin,
    doubleOut,
    trackDoubles
  });
});

function startMatch(config) {
  activeMatch = new DartsMatch(config);
  document.getElementById("match-info-badge").textContent = `${config.startingScore} ${config.doubleOut ? "Double Out" : "Single Out"} (First to ${config.legsToWin})`;
  resetKeypad();
  renderScorer();
  showView("scorer");
}

// Second screen popout
document.getElementById("btn-open-second-screen").addEventListener("click", () => {
  const win = window.open("display.html", "DartsScoreboard", "width=1280,height=720");
  if (win) {
    win.focus();
    setTimeout(() => {
      if (activeMatch) sync.broadcast(activeMatch.getStatePayload());
    }, 500);
  }
});

document.getElementById("btn-exit-match").addEventListener("click", () => {
  if (confirm("Exit current match?")) {
    if (currentTournamentMatch && activeTournament) {
      showView("tourneyDash");
    } else {
      showView("home");
    }
  }
});

// --- Scorer Rendering ---
function renderScorer() {
  if (!activeMatch) return;
  const state = activeMatch.getStatePayload();

  // P1 Elements
  const p1Box = document.getElementById("scorer-p1-box");
  document.getElementById("scorer-p1-name").textContent = state.player1;
  document.getElementById("scorer-p1-legs").textContent = state.legsP1;
  document.getElementById("scorer-legs-target-p1").textContent = state.legsToWin;
  document.getElementById("scorer-p1-score").textContent = state.scores[0];
  document.getElementById("scorer-p1-checkout").textContent = state.p1Checkout ? `🎯 ${state.p1Checkout}` : "";
  document.getElementById("scorer-p1-avg").textContent = state.p1Stats.threeDartAvg;
  document.getElementById("scorer-p1-darts").textContent = state.p1Stats.totalDarts;
  document.getElementById("scorer-p1-dbl").textContent = `${state.p1Stats.checkoutPct}%`;

  // P2 Elements
  const p2Box = document.getElementById("scorer-p2-box");
  document.getElementById("scorer-p2-name").textContent = state.player2;
  document.getElementById("scorer-p2-legs").textContent = state.legsP2;
  document.getElementById("scorer-legs-target-p2").textContent = state.legsToWin;
  document.getElementById("scorer-p2-score").textContent = state.scores[1];
  document.getElementById("scorer-p2-checkout").textContent = state.p2Checkout ? `🎯 ${state.p2Checkout}` : "";
  document.getElementById("scorer-p2-avg").textContent = state.p2Stats.threeDartAvg;
  document.getElementById("scorer-p2-darts").textContent = state.p2Stats.totalDarts;
  document.getElementById("scorer-p2-dbl").textContent = `${state.p2Stats.checkoutPct}%`;

  // Active turn glow
  if (state.currentTurn === 0) {
    p1Box.classList.add("active-turn");
    p2Box.classList.remove("active-turn");
  } else {
    p2Box.classList.add("active-turn");
    p1Box.classList.remove("active-turn");
  }

  // Darts at double prompt display check
  const activeScore = state.scores[state.currentTurn];
  const doublePrompt = document.getElementById("numeric-double-prompt");
  if (activeMatch.trackDoubles && isFinishPossible(activeScore, activeMatch.doubleOut)) {
    doublePrompt.style.display = "flex";
  } else {
    doublePrompt.style.display = "none";
  }

  // Visits stream log
  renderVisitsLog();

  // Sync to second screen
  sync.broadcast(state);

  // Check if match won
  if (state.isFinished) {
    handleMatchFinish(state);
  }
}

function renderVisitsLog() {
  const container = document.getElementById("scorer-visits-log");
  container.innerHTML = "";
  const visits = activeMatch.history.slice(-8).reverse();
  visits.forEach(action => {
    const v = action.visit;
    const pName = v.playerIndex === 0 ? activeMatch.player1 : activeMatch.player2;
    const badge = document.createElement("div");
    badge.className = `visit-badge ${v.bust ? "bust" : ""}`;
    const desc = v.bust ? "BUST" : `${v.score} pts`;
    badge.textContent = `${pName}: ${desc}`;
    container.appendChild(badge);
  });
}

function handleMatchFinish(state) {
  const modal = document.getElementById("modal-match-finish");
  document.getElementById("modal-winner-name").textContent = `Winner: ${state.winner}`;
  document.getElementById("modal-match-score-summary").textContent = `${state.player1} ${state.legsP1} - ${state.legsP2} ${state.player2}`;
  
  const details = document.getElementById("modal-match-stats-details");
  details.innerHTML = `
    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
      <strong>${state.player1}</strong>
      <span>3-Dart Avg: <strong>${state.p1Stats.threeDartAvg}</strong> | Dbl: <strong>${state.p1Stats.checkoutPct}%</strong> (${state.p1Stats.doubleHits}/${state.p1Stats.doubleAttempts})</span>
    </div>
    <div style="display:flex; justify-content:space-between;">
      <strong>${state.player2}</strong>
      <span>3-Dart Avg: <strong>${state.p2Stats.threeDartAvg}</strong> | Dbl: <strong>${state.p2Stats.checkoutPct}%</strong> (${state.p2Stats.doubleHits}/${state.p2Stats.doubleAttempts})</span>
    </div>
  `;

  modal.style.display = "flex";
}

document.getElementById("btn-finish-modal-ok").addEventListener("click", () => {
  document.getElementById("modal-match-finish").style.display = "none";
  if (currentTournamentMatch && activeTournament) {
    // Record into tournament
    activeTournament.recordMatchResult(currentTournamentMatch.id, {
      winner: activeMatch.winner,
      legsP1: activeMatch.legsP1,
      legsP2: activeMatch.legsP2,
      p1Stats: activeMatch.getPlayerStats(0),
      p2Stats: activeMatch.getPlayerStats(1)
    });
    saveTournamentToStorage();
    renderTournamentDashboard();
    showView("tourneyDash");
  } else {
    showView("home");
  }
});

// --- Score Input Modes Switcher ---
const tabNumeric = document.getElementById("tab-mode-numeric");
const tabKeypad = document.getElementById("tab-mode-keypad");
const wrapNumeric = document.getElementById("mode-numeric-wrap");
const wrapKeypad = document.getElementById("mode-keypad-wrap");

tabNumeric.addEventListener("click", () => {
  tabNumeric.classList.add("active");
  tabKeypad.classList.remove("active");
  wrapNumeric.style.display = "flex";
  wrapKeypad.style.display = "none";
  document.getElementById("input-numeric-score").focus();
});

tabKeypad.addEventListener("click", () => {
  tabKeypad.classList.add("active");
  tabNumeric.classList.remove("active");
  wrapNumeric.style.display = "none";
  wrapKeypad.style.display = "flex";
});

// --- Mode 1: Fast Numeric Input ---
const numInput = document.getElementById("input-numeric-score");
const btnSubmitNumeric = document.getElementById("btn-submit-numeric");
const btnBustNumeric = document.getElementById("btn-bust-numeric");

let selectedDoubleAttempts = 0;
document.querySelectorAll(".double-count-btn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    document.querySelectorAll(".double-count-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedDoubleAttempts = parseInt(btn.dataset.count, 10);
  });
});

function submitNumericScore(scoreVal, isBust = false) {
  if (!activeMatch || activeMatch.isFinished) return;
  const score = isBust ? 0 : parseInt(scoreVal, 10);
  if (isNaN(score) || score < 0 || score > 180) {
    alert("Score must be between 0 and 180");
    return;
  }

  const pIdx = activeMatch.currentTurn;
  const currentScore = activeMatch.currentLeg.scores[pIdx];
  if (activeMatch.doubleOut && !isBust && (currentScore - score === 0) && !isFinishPossible(currentScore, true)) {
    alert(`Bust! Cannot checkout from ${currentScore} on Double Out (maximum finish is 170).`);
  }

  const dartsCount = parseInt(document.getElementById("numeric-darts-count").value, 10) || 3;
  let doubleAttempts = selectedDoubleAttempts;

  // Auto-record bust if explicit button clicked
  if (isBust) {
    activeMatch.recordVisit({ score: 0, dartsCount, doubleAttempts, bust: true });
  } else {
    activeMatch.recordVisit({ score, dartsCount, doubleAttempts });
  }

  // Reset inputs
  numInput.value = "";
  selectedDoubleAttempts = 0;
  document.querySelectorAll(".double-count-btn").forEach((b, idx) => {
    if (idx === 0) b.classList.add("selected");
    else b.classList.remove("selected");
  });
  document.getElementById("numeric-darts-count").value = "3";

  renderScorer();
  numInput.focus();
}

btnSubmitNumeric.addEventListener("click", () => submitNumericScore(numInput.value));
numInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitNumericScore(numInput.value);
});
btnBustNumeric.addEventListener("click", () => submitNumericScore(0, true));

// Common score buttons
document.querySelectorAll(".common-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const sc = btn.dataset.score;
    numInput.value = sc;
    submitNumericScore(sc);
  });
});

// --- Mode 2: Dartboard Matrix Keypad ---
function initKeypadTargets() {
  const container = document.getElementById("keypad-targets");
  container.innerHTML = "";

  // 1 to 20
  for (let i = 1; i <= 20; i++) {
    const btn = document.createElement("button");
    btn.className = "target-btn";
    btn.textContent = i;
    btn.addEventListener("click", () => handleDartInput(i));
    container.appendChild(btn);
  }

  // Miss 0
  const missBtn = document.createElement("button");
  missBtn.className = "target-btn";
  missBtn.textContent = "Miss (0)";
  missBtn.addEventListener("click", () => handleDartInput(0));
  container.appendChild(missBtn);

  // 25 Outer Bull
  const bullBtn = document.createElement("button");
  bullBtn.className = "target-btn bull";
  bullBtn.textContent = "25";
  bullBtn.addEventListener("click", () => handleDartInput(25));
  container.appendChild(bullBtn);

  // 50 Bullseye
  const dbullBtn = document.createElement("button");
  dbullBtn.className = "target-btn d-bull";
  dbullBtn.textContent = "Bull (50)";
  dbullBtn.addEventListener("click", () => handleDartInput(50));
  container.appendChild(dbullBtn);
}

// Multiplier buttons
const multSingle = document.getElementById("mult-single");
const multDouble = document.getElementById("mult-double");
const multTriple = document.getElementById("mult-triple");

function setMultiplier(mult) {
  currentMultiplier = mult;
  [multSingle, multDouble, multTriple].forEach(b => b.classList.remove("active"));
  if (mult === 1) multSingle.classList.add("active");
  else if (mult === 2) multDouble.classList.add("active");
  else if (mult === 3) multTriple.classList.add("active");
}

multSingle.addEventListener("click", () => setMultiplier(1));
multDouble.addEventListener("click", () => setMultiplier(2));
multTriple.addEventListener("click", () => setMultiplier(3));

function handleDartInput(target) {
  if (keypadDarts.length >= 3) return;

  let multiplier = currentMultiplier;
  let score = 0;
  let isDouble = false;
  let label = "";

  if (target === 0) {
    score = 0;
    label = "Miss";
  } else if (target === 50) {
    score = 50;
    multiplier = 2; // Bull is double 25
    isDouble = true;
    label = "Bull";
  } else if (target === 25) {
    score = 25;
    multiplier = 1;
    label = "25";
  } else {
    // 1-20
    if (multiplier === 3) label = `T${target}`;
    else if (multiplier === 2) {
      label = `D${target}`;
      isDouble = true;
    } else {
      label = `${target}`;
    }
    score = target * multiplier;
  }

  keypadDarts.push({ target, multiplier, score, isDouble, label });
  setMultiplier(1); // Reset to single
  updateKeypadSlots();
}

function updateKeypadSlots() {
  for (let i = 1; i <= 3; i++) {
    const slot = document.getElementById(`slot-${i}`);
    const val = document.getElementById(`slot-val-${i}`);
    const dart = keypadDarts[i - 1];

    if (dart) {
      val.textContent = dart.label;
      slot.classList.remove("active");
    } else {
      val.textContent = "-";
      if (i === keypadDarts.length + 1) slot.classList.add("active");
      else slot.classList.remove("active");
    }
  }

  const total = keypadDarts.reduce((acc, d) => acc + d.score, 0);
  document.getElementById("keypad-visit-total").textContent = total;
}

function resetKeypad() {
  keypadDarts = [];
  setMultiplier(1);
  updateKeypadSlots();
}

document.getElementById("btn-clear-keypad-darts").addEventListener("click", resetKeypad);

document.getElementById("btn-submit-keypad-visit").addEventListener("click", () => {
  if (keypadDarts.length === 0) return;
  const total = keypadDarts.reduce((acc, d) => acc + d.score, 0);
  const dartsCount = keypadDarts.length;
  // Darts at double count
  const doubleAttempts = keypadDarts.filter(d => d.isDouble).length;

  activeMatch.recordVisit({
    score: total,
    dartsCount,
    doubleAttempts,
    dartBreakdown: [...keypadDarts]
  });

  resetKeypad();
  renderScorer();
});

// Undo
document.getElementById("btn-undo-turn").addEventListener("click", () => {
  if (activeMatch && activeMatch.undo()) {
    renderScorer();
  }
});

// --- Tournament Management ---
let registeredPlayers = ["Michael Smith", "Michael van Gerwen", "Gerwyn Price", "Luke Littler"];

function renderPlayerTags() {
  const container = document.getElementById("tourney-player-tags");
  container.innerHTML = "";
  registeredPlayers.forEach(p => {
    const tag = document.createElement("div");
    tag.className = "player-tag";
    tag.innerHTML = `<span>${p}</span> <span class="remove-tag" title="Remove">&times;</span>`;
    tag.querySelector(".remove-tag").addEventListener("click", () => {
      registeredPlayers = registeredPlayers.filter(name => name !== p);
      renderPlayerTags();
    });
    container.appendChild(tag);
  });
  document.getElementById("tourney-player-count").textContent = registeredPlayers.length;
}

document.getElementById("btn-tourney-add-player").addEventListener("click", () => {
  const input = document.getElementById("tourney-player-input");
  const name = input.value.trim();
  if (name && !registeredPlayers.includes(name)) {
    registeredPlayers.push(name);
    input.value = "";
    renderPlayerTags();
  }
});

document.getElementById("tourney-player-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    document.getElementById("btn-tourney-add-player").click();
  }
});

document.getElementById("btn-tourney-shuffle").addEventListener("click", () => {
  for (let i = registeredPlayers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [registeredPlayers[i], registeredPlayers[j]] = [registeredPlayers[j], registeredPlayers[i]];
  }
  renderPlayerTags();
});

// Format toggle (groups vs direct knockout)
document.querySelectorAll("input[name='tourney-format']").forEach(radio => {
  radio.addEventListener("change", (e) => {
    const isGroups = e.target.value === "groups";
    document.getElementById("tourney-groups-config").style.display = isGroups ? "grid" : "none";
  });
});

document.getElementById("btn-create-tourney-start").addEventListener("click", () => {
  if (registeredPlayers.length < 2) {
    alert("Please register at least 2 players");
    return;
  }

  const format = document.querySelector("input[name='tourney-format']:checked").value;
  const groupCount = parseInt(document.getElementById("tourney-group-count").value, 10) || 2;
  const advancePerGroup = parseInt(document.getElementById("tourney-advance-count").value, 10) || 2;
  const gameScore = parseInt(document.getElementById("tourney-game-type").value, 10) || 501;
  const legsToWin = parseInt(document.getElementById("tourney-legs-to-win").value, 10) || 2;
  const doubleOut = document.getElementById("tourney-out-mode").value === "double";

  activeTournament = new Tournament({
    name: "Darts Championship",
    format,
    players: [...registeredPlayers],
    groupCount,
    advancePerGroup,
    startingScore: gameScore,
    legsToWin,
    doubleOut,
    trackDoubles: true
  });

  activeTournament.start();
  saveTournamentToStorage();
  renderTournamentDashboard();
  showView("tourneyDash");
});

function renderTournamentDashboard() {
  if (!activeTournament) return;

  document.getElementById("tourney-dash-title").textContent = activeTournament.name;
  document.getElementById("tourney-dash-meta").textContent = `Format: ${activeTournament.format === "groups" ? "Groups + Knockout Tree" : "Direct Knockout Tree"} | Status: ${activeTournament.status.toUpperCase()}`;

  const groupsContainer = document.getElementById("tourney-groups-container");
  const advanceBox = document.getElementById("tourney-advance-box");
  const bracketContainer = document.getElementById("tourney-bracket-container");

  if (activeTournament.format === "groups") {
    groupsContainer.style.display = "block";
    groupsContainer.innerHTML = "";

    activeTournament.groups.forEach(group => {
      const gCard = document.createElement("div");
      gCard.className = "card";
      gCard.innerHTML = `
        <h3 style="margin-bottom: 0.75rem; color: var(--accent-gold);">${group.name}</h3>
        <div class="table-wrap">
          <table class="stats-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>P</th>
                <th>W</th>
                <th>L</th>
                <th>LF</th>
                <th>LA</th>
                <th>+/-</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              ${group.standings.map((s, idx) => `
                <tr class="${idx < activeTournament.advancePerGroup ? "qualifying-row" : ""}">
                  <td>${idx + 1}</td>
                  <td><strong>${s.player}</strong></td>
                  <td>${s.played}</td>
                  <td>${s.won}</td>
                  <td>${s.lost}</td>
                  <td>${s.legsFor}</td>
                  <td>${s.legsAgainst}</td>
                  <td>${s.legDiff > 0 ? "+" + s.legDiff : s.legDiff}</td>
                  <td><strong>${s.points}</strong></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <h4 style="margin-top: 1.25rem; font-size: 0.95rem; color: var(--text-muted);">Group Fixtures</h4>
        <div class="fixtures-grid">
          ${group.matches.map(m => `
            <div class="fixture-card ${m.isFinished ? "finished" : ""}">
              <div>
                <strong>${m.player1}</strong> vs <strong>${m.player2}</strong>
                ${m.isFinished ? `<div style="font-size:0.85rem; color:var(--accent-gold);">${m.legsP1} - ${m.legsP2} (Winner: ${m.winner})</div>` : ""}
              </div>
              <div>
                ${!m.isFinished ? `<button class="btn btn-primary btn-sm btn-play-match" data-match-id="${m.id}">Play</button>` : `<span style="font-size:0.8rem; color:#238636;">✓ Done</span>`}
              </div>
            </div>
          `).join("")}
        </div>
      `;
      groupsContainer.appendChild(gCard);
    });

    // Advance button check
    if (activeTournament.status === "groups") {
      advanceBox.style.display = "block";
      bracketContainer.style.display = "none";
    } else {
      advanceBox.style.display = "none";
      bracketContainer.style.display = "block";
      renderBracketTree();
    }
  } else {
    // Direct knockout
    groupsContainer.style.display = "none";
    advanceBox.style.display = "none";
    bracketContainer.style.display = "block";
    renderBracketTree();
  }

  // Bind fixture play buttons
  document.querySelectorAll(".btn-play-match").forEach(btn => {
    btn.addEventListener("click", () => {
      const matchId = btn.dataset.matchId;
      launchTournamentFixture(matchId);
    });
  });
}

document.getElementById("btn-advance-to-knockout").addEventListener("click", () => {
  if (!activeTournament) return;
  activeTournament.generateKnockoutFromGroups();
  saveTournamentToStorage();
  renderTournamentDashboard();
});

function launchTournamentFixture(matchId) {
  let foundMatch = null;
  for (const g of activeTournament.groups) {
    foundMatch = g.matches.find(m => m.id === matchId);
    if (foundMatch) break;
  }
  if (!foundMatch) {
    for (const r of activeTournament.knockoutRounds) {
      foundMatch = r.find(m => m.id === matchId);
      if (foundMatch) break;
    }
  }
  if (!foundMatch) return;

  currentTournamentMatch = foundMatch;
  const badge = document.getElementById("tournament-context-badge");
  badge.textContent = `Tournament: ${foundMatch.player1} vs ${foundMatch.player2}`;
  badge.style.display = "inline-flex";

  startMatch({
    player1: foundMatch.player1,
    player2: foundMatch.player2,
    startingScore: activeTournament.matchSettings.startingScore,
    legsToWin: activeTournament.matchSettings.legsToWin,
    doubleOut: activeTournament.matchSettings.doubleOut,
    trackDoubles: activeTournament.matchSettings.trackDoubles
  });
}

function renderBracketTree() {
  const container = document.getElementById("bracket-tree-view");
  container.innerHTML = "";
  if (!activeTournament || !activeTournament.knockoutRounds) return;

  const roundNames = ["Round 1", "Quarter-Finals", "Semi-Finals", "Final"];
  const totalRounds = activeTournament.knockoutRounds.length;

  activeTournament.knockoutRounds.forEach((round, rIdx) => {
    const roundDiv = document.createElement("div");
    roundDiv.className = "bracket-round";

    const titleDiv = document.createElement("div");
    titleDiv.className = "bracket-round-title";
    const reverseIdx = totalRounds - 1 - rIdx;
    if (reverseIdx === 0) titleDiv.textContent = "Final";
    else if (reverseIdx === 1) titleDiv.textContent = "Semi-Finals";
    else if (reverseIdx === 2) titleDiv.textContent = "Quarter-Finals";
    else titleDiv.textContent = `Round ${rIdx + 1}`;
    roundDiv.appendChild(titleDiv);

    round.forEach(m => {
      const matchCard = document.createElement("div");
      matchCard.className = "bracket-match";

      const slot1Winner = m.isFinished && m.winner === m.player1;
      const slot2Winner = m.isFinished && m.winner === m.player2;

      matchCard.innerHTML = `
        <div class="bracket-slot ${slot1Winner ? "winner" : ""}">
          <span>${m.player1 || "TBD"}</span>
          <span>${m.isFinished ? m.legsP1 : "-"}</span>
        </div>
        <div class="bracket-slot ${slot2Winner ? "winner" : ""}">
          <span>${m.player2 || "TBD"}</span>
          <span>${m.isFinished ? m.legsP2 : "-"}</span>
        </div>
        ${(!m.isFinished && m.player1 && m.player2 && m.player1 !== "BYE" && m.player2 !== "BYE") ? `
          <div style="padding: 4px 6px; text-align: center; background: var(--bg-card); border-top: 1px solid var(--border);">
            <button class="btn btn-primary btn-sm btn-play-match" data-match-id="${m.id}" style="width: 100%; font-size: 0.75rem; padding: 2px 6px;">Play Match</button>
          </div>
        ` : ""}
      `;
      roundDiv.appendChild(matchCard);
    });

    container.appendChild(roundDiv);
  });
}

// --- Mid-Tournament Stats Modal ---
function openMidTournamentStats() {
  if (!activeTournament) return;
  const stats = activeTournament.getOverallPlayerStats();
  const tbody = document.getElementById("tbody-player-stats");
  tbody.innerHTML = "";

  stats.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${s.player}</strong></td>
      <td>${s.matchesPlayed}</td>
      <td>${s.matchesWon}</td>
      <td>${s.matchesLost}</td>
      <td>${s.winPct}%</td>
      <td>${s.legsWon} - ${s.legsLost}</td>
      <td><strong>${s.threeDartAvg}</strong></td>
      <td>${s.checkoutPct}%</td>
      <td>${s.doubleHits} / ${s.doubleAttempts}</td>
      <td>${s.count180}</td>
      <td>${s.count140}</td>
      <td>${s.count100}</td>
      <td>${s.highestCheckout || "-"}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("modal-stats").style.display = "flex";
}

document.getElementById("btn-view-mid-stats").addEventListener("click", openMidTournamentStats);
document.getElementById("btn-close-stats-modal").addEventListener("click", () => {
  document.getElementById("modal-stats").style.display = "none";
});
document.getElementById("btn-modal-close-bottom").addEventListener("click", () => {
  document.getElementById("modal-stats").style.display = "none";
});

// CSV Export
function downloadCSV() {
  if (!activeTournament) return;
  const csvData = activeTournament.exportCSV();
  const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${activeTournament.name.replace(/\s+/g, "_")}_stats.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

document.getElementById("btn-export-csv").addEventListener("click", downloadCSV);
document.getElementById("btn-modal-export-csv").addEventListener("click", downloadCSV);

document.getElementById("btn-new-tournament").addEventListener("click", () => {
  if (confirm("Reset current tournament and create a new one?")) {
    activeTournament = null;
    localStorage.removeItem("darts_tournament_data");
    showView("tourneySetup");
  }
});

// Storage Persistence
function saveTournamentToStorage() {
  if (!activeTournament) return;
  try {
    localStorage.setItem("darts_tournament_data", JSON.stringify(activeTournament));
  } catch (e) {}
}

function loadTournamentFromStorage() {
  try {
    const raw = localStorage.getItem("darts_tournament_data");
    if (raw) {
      const data = JSON.parse(raw);
      activeTournament = Object.assign(new Tournament(), data);
    }
  } catch (e) {}
}

// Initial Boot
initKeypadTargets();
renderPlayerTags();
loadTournamentFromStorage();
showView("home");
