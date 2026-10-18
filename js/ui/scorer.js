// Match scoring UI controller
window.App = window.App || {};

App.renderScorer = function() {
  const match = App.activeMatch;
  if (!match) return;
  const state = match.getStatePayload();

  const p1Box = document.getElementById("scorer-p1-box");
  document.getElementById("scorer-p1-name").textContent = state.player1;
  document.getElementById("scorer-p1-legs").textContent = state.legsP1;
  document.getElementById("scorer-legs-target-p1").textContent = state.legsToWin;
  document.getElementById("scorer-p1-score").textContent = state.scores[0];
  document.getElementById("scorer-p1-checkout").textContent = state.p1Checkout ? `🎯 ${state.p1Checkout}` : "";
  document.getElementById("scorer-p1-avg").textContent = state.p1Stats.threeDartAvg;
  document.getElementById("scorer-p1-darts").textContent = state.p1Stats.totalDarts;
  document.getElementById("scorer-p1-dbl").textContent = `${state.p1Stats.checkoutPct}%`;

  const p2Box = document.getElementById("scorer-p2-box");
  document.getElementById("scorer-p2-name").textContent = state.player2;
  document.getElementById("scorer-p2-legs").textContent = state.legsP2;
  document.getElementById("scorer-legs-target-p2").textContent = state.legsToWin;
  document.getElementById("scorer-p2-score").textContent = state.scores[1];
  document.getElementById("scorer-p2-checkout").textContent = state.p2Checkout ? `🎯 ${state.p2Checkout}` : "";
  document.getElementById("scorer-p2-avg").textContent = state.p2Stats.threeDartAvg;
  document.getElementById("scorer-p2-darts").textContent = state.p2Stats.totalDarts;
  document.getElementById("scorer-p2-dbl").textContent = `${state.p2Stats.checkoutPct}%`;

  if (state.currentTurn === 0) {
    p1Box.classList.add("active-turn"); p2Box.classList.remove("active-turn");
  } else {
    p2Box.classList.add("active-turn"); p1Box.classList.remove("active-turn");
  }

  const roundBadge = document.getElementById("scorer-round-badge");
  if (roundBadge) {
    const curR = state.currentRound;
    if (match.bullOffAfterRounds > 0) {
      roundBadge.textContent = `Round ${curR}/${match.bullOffAfterRounds}`;
    } else {
      roundBadge.textContent = `Round ${curR}`;
    }
  }

  if (state.isBullOffDue) {
    App.openBullOffModal();
  }

  const activeScore = state.scores[state.currentTurn];
  const doublePrompt = document.getElementById("numeric-double-prompt");
  if (isFinishPossible(activeScore, match.doubleOut)) {
    doublePrompt.style.display = "flex";
    const showDblBtns = Boolean(match.trackDoubles && match.doubleOut);
    const lbl = doublePrompt.querySelector(".double-prompt-label");
    const btns = doublePrompt.querySelector(".double-prompt-buttons");
    if (lbl) lbl.style.display = showDblBtns ? "" : "none";
    if (btns) btns.style.display = showDblBtns ? "flex" : "none";
  } else {
    doublePrompt.style.display = "none";
  }

  const logContainer = document.getElementById("scorer-visits-log");
  logContainer.innerHTML = "";
  const logFrag = document.createDocumentFragment();
  match.history.slice(-8).reverse().forEach(action => {
    if (action.type === "bull_off") {
      const winnerName = action.winner === 0 ? match.player1 : match.player2;
      const badge = document.createElement("div");
      badge.className = "visit-badge";
      badge.textContent = `🎯 Bull-off: ${winnerName} won ${action.matchWon ? "Match" : "Leg"}`;
      logFrag.appendChild(badge);
      return;
    }
    const v = action.visit;
    if (!v) return;
    const pName = v.playerIndex === 0 ? match.player1 : match.player2;
    const badge = document.createElement("div");
    badge.className = `visit-badge ${v.bust ? "bust" : ""}`;
    badge.textContent = `${pName}: ${v.bust ? "BUST" : v.score + " pts"}`;
    logFrag.appendChild(badge);
  });
  logContainer.appendChild(logFrag);

  if (App.sync) App.sync.broadcast(state);
  if (state.isFinished) App.handleMatchFinish(state);
};

App.handleMatchFinish = function(state) {
  const esc = App.escapeHtml || (s => s);
  const modal = document.getElementById("modal-match-finish");
  document.getElementById("modal-winner-name").textContent = `Winner: ${state.winner}`;
  document.getElementById("modal-match-score-summary").textContent = `${state.player1} ${state.legsP1} - ${state.legsP2} ${state.player2}`;
  document.getElementById("modal-match-stats-details").innerHTML = `
    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
      <strong>${esc(state.player1)}</strong>
      <span>3-Dart Avg: <strong>${state.p1Stats.threeDartAvg}</strong> | Dbl: <strong>${state.p1Stats.checkoutPct}%</strong> (${state.p1Stats.doubleHits}/${state.p1Stats.doubleAttempts})</span>
    </div>
    <div style="display:flex; justify-content:space-between;">
      <strong>${esc(state.player2)}</strong>
      <span>3-Dart Avg: <strong>${state.p2Stats.threeDartAvg}</strong> | Dbl: <strong>${state.p2Stats.checkoutPct}%</strong> (${state.p2Stats.doubleHits}/${state.p2Stats.doubleAttempts})</span>
    </div>
  `;
  modal.style.display = "flex";
};

App.initScorerUI = function() {
  document.getElementById("btn-finish-modal-ok").addEventListener("click", () => {
    document.getElementById("modal-match-finish").style.display = "none";
    if (App.currentTournamentMatch && App.activeTournament) {
      App.activeTournament.recordMatchResult(App.currentTournamentMatch.id, {
        winner: App.activeMatch.winner,
        legsP1: App.activeMatch.legsP1,
        legsP2: App.activeMatch.legsP2,
        p1Stats: App.activeMatch.getPlayerStats(0),
        p2Stats: App.activeMatch.getPlayerStats(1)
      });
      App.saveTournamentToStorage();
      App.currentTournamentMatch = null;
      const badge = document.getElementById("tournament-context-badge");
      if (badge) badge.style.display = "none";
      App.renderTournamentDashboard();
      App.showView("tourneyDash");
    } else {
      App.showView("home");
    }
  });

  document.getElementById("btn-open-second-screen").addEventListener("click", () => {
    const baseUrl = window.location.href.split("?")[0].split("#")[0];
    const secondScreenUrl = baseUrl + "?screen=display";
    const win = window.open(secondScreenUrl, "DartsScoreboard", "width=1280,height=720");
    if (win) {
      win.focus();
      setTimeout(() => {
        if (App.activeMatch && App.sync) App.sync.broadcast(App.activeMatch.getStatePayload());
      }, 500);
    }
  });

  document.getElementById("btn-exit-match").addEventListener("click", () => {
    if (App.activeMatch && App.activeMatch.isFinished) {
      if (App.currentTournamentMatch && App.activeTournament) {
        if (!App.activeTournament.matchStatsRegistry[App.currentTournamentMatch.id]) {
          App.activeTournament.recordMatchResult(App.currentTournamentMatch.id, {
            winner: App.activeMatch.winner,
            legsP1: App.activeMatch.legsP1,
            legsP2: App.activeMatch.legsP2,
            p1Stats: App.activeMatch.getPlayerStats(0),
            p2Stats: App.activeMatch.getPlayerStats(1)
          });
          App.saveTournamentToStorage();
        }
        App.currentTournamentMatch = null;
        const badge = document.getElementById("tournament-context-badge");
        if (badge) badge.style.display = "none";
        App.renderTournamentDashboard();
        App.showView("tourneyDash");
      } else {
        App.showView("home");
      }
      if (App.sync) App.sync.broadcast({ active: false });
      return;
    }
    if (confirm("Exit current match?")) {
      if (App.currentTournamentMatch && App.activeTournament) {
        App.currentTournamentMatch = null;
        const badge = document.getElementById("tournament-context-badge");
        if (badge) badge.style.display = "none";
        App.renderTournamentDashboard();
        App.showView("tourneyDash");
      } else {
        App.showView("home");
      }
      if (App.sync) App.sync.broadcast({ active: false });
    }
  });

  document.getElementById("btn-undo-turn").addEventListener("click", () => {
    if (App.activeMatch && App.activeMatch.undo()) {
      const modalFinish = document.getElementById("modal-match-finish");
      if (modalFinish) modalFinish.style.display = "none";
      const modalBo = document.getElementById("modal-bull-off");
      if (modalBo) modalBo.style.display = "none";
      if (App.resetKeypad) App.resetKeypad();
      App.renderScorer();
    }
  });

  const p1Box = document.getElementById("scorer-p1-box");
  const p2Box = document.getElementById("scorer-p2-box");
  if (p1Box && p2Box) {
    p1Box.addEventListener("click", () => {
      if (App.activeMatch && App.activeMatch.setStartingPlayer(0)) {
        if (App.updateMatchInfoBadge) App.updateMatchInfoBadge(App.activeMatch);
        App.renderScorer();
      }
    });
    p2Box.addEventListener("click", () => {
      if (App.activeMatch && App.activeMatch.setStartingPlayer(1)) {
        if (App.updateMatchInfoBadge) App.updateMatchInfoBadge(App.activeMatch);
        App.renderScorer();
      }
    });
  }

  // --- Remote phone action handler ---
  if (App.sync) {
    App.sync.onAction((action) => {
      if (!action || !App.activeMatch) return;
      if (action.type === "VISIT") {
        if (action.dartBreakdown && action.dartBreakdown.length > 0) {
          App.activeMatch.recordVisit({
            score: action.score,
            dartsCount: action.dartsCount,
            doubleAttempts: action.doubleAttempts,
            dartBreakdown: action.dartBreakdown,
            bust: action.bust
          });
          if (App.resetKeypad) App.resetKeypad();
          App.renderScorer();
        } else {
          const pIdx = App.activeMatch.currentTurn;
          const curScore = App.activeMatch.currentLeg.scores[pIdx];
          let isBust = Boolean(action.bust);
          if (App.activeMatch.doubleOut && !isBust && (curScore - action.score === 0) && !isFinishPossible(curScore, true)) {
            isBust = true;
          }
          App.activeMatch.recordVisit({
            score: isBust ? 0 : action.score,
            dartsCount: action.dartsCount || 3,
            doubleAttempts: action.doubleAttempts || 0,
            bust: isBust
          });
          const numInput = document.getElementById("input-numeric-score");
          if (numInput) numInput.value = "";
          App.renderScorer();
        }
      } else if (action.type === "UNDO") {
        if (App.activeMatch && App.activeMatch.undo()) {
          const modalFinish = document.getElementById("modal-match-finish");
          if (modalFinish) modalFinish.style.display = "none";
          const modalBo = document.getElementById("modal-bull-off");
          if (modalBo) modalBo.style.display = "none";
          if (App.resetKeypad) App.resetKeypad();
          App.renderScorer();
        }
      } else if (action.type === "SET_STARTER") {
        if (App.activeMatch.setStartingPlayer(action.playerIndex)) {
          if (App.updateMatchInfoBadge) App.updateMatchInfoBadge(App.activeMatch);
          App.renderScorer();
        }
      } else if (action.type === "BULL_OFF_THROW") {
        const pClass = action.player === "p1" ? ".bo-p1-btn" : ".bo-p2-btn";
        document.querySelectorAll(pClass).forEach(b => {
          if (parseInt(b.dataset.val, 10) === action.val) b.click();
        });
      } else if (action.type === "BULL_OFF_RESOLVE") {
        App.resolveBullOffWinner(action.winnerIndex, action.decideEntireMatch);
      } else if (action.type === "FINISH_OK") {
        const btnOk = document.getElementById("btn-finish-modal-ok");
        if (btnOk) btnOk.click();
      }
    });
  }

  // --- Connect Phone Modal ---
  const btnConnectPhone = document.getElementById("btn-open-connect-phone");
  if (btnConnectPhone && App.openConnectPhoneModal) {
    btnConnectPhone.addEventListener("click", App.openConnectPhoneModal);
  }
};
