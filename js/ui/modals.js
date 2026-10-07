// Modals controller (Tournament Match Setup, Bull-off, Mid-Tournament Stats)
window.App = window.App || {};

App.pendingTournamentMatch = null;
let boThrows = { p1: null, p2: null };

App.closeTournamentMatchSetup = function() {
  document.getElementById("modal-tourney-match-setup").style.display = "none";
  App.pendingTournamentMatch = null;
};

App.promptMatchStarter = function(config) {
  const modal = document.getElementById("modal-match-starter");
  if (!modal) {
    App.startMatch(config);
    return;
  }

  const p1Btn = document.getElementById("btn-starter-p1");
  const p2Btn = document.getElementById("btn-starter-p2");
  const rndBtn = document.getElementById("btn-starter-random");
  const closeBtn = document.getElementById("btn-starter-close");

  p1Btn.textContent = `🎯 ${config.player1} Starts`;
  p2Btn.textContent = `🎯 ${config.player2} Starts`;
  rndBtn.textContent = "🎲 Coin Toss / Random";

  const choose = (idx) => {
    config.startingPlayer = idx;
    modal.style.display = "none";
    App.startMatch(config);
  };

  p1Btn.onclick = () => choose(0);
  p2Btn.onclick = () => choose(1);

  rndBtn.onclick = () => {
    rndBtn.textContent = "Flipping coin...";
    rndBtn.disabled = true;
    setTimeout(() => {
      rndBtn.disabled = false;
      rndBtn.textContent = "🎲 Coin Toss / Random";
      const picked = Math.random() < 0.5 ? 0 : 1;
      choose(picked);
    }, 300);
  };

  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = "none";
    };
  }

  modal.style.display = "flex";
};

App.launchTournamentFixture = function(matchId) {
  let match = null;
  if (!App.activeTournament) return;
  if (App.activeTournament.groups) {
    for (const g of App.activeTournament.groups) {
      match = g.matches.find(m => m.id === matchId);
      if (match) break;
    }
  }
  if (!match && App.activeTournament.knockoutRounds) {
    for (const r of App.activeTournament.knockoutRounds) {
      match = r.find(m => m.id === matchId);
      if (match) break;
    }
  }
  if (!match && App.activeTournament.repechageRounds) {
    for (const r of App.activeTournament.repechageRounds) {
      match = r.find(m => m.id === matchId);
      if (match) break;
    }
  }
  if (!match && App.activeTournament.bronzeMatch && App.activeTournament.bronzeMatch.id === matchId) {
    match = App.activeTournament.bronzeMatch;
  }
  if (!match) return;

  App.pendingTournamentMatch = match;
  const ms = App.activeTournament.matchSettings || {};

  document.getElementById("tms-players").textContent = `${match.player1} vs ${match.player2}`;
  document.getElementById("tms-game-type").value = `${ms.startingScore || 501}`;
  document.getElementById("tms-legs-to-win").value = ms.legsToWin || 2;
  document.getElementById("tms-out-mode").value = ms.doubleOut !== false ? "double" : "single";
  document.getElementById("tms-track-doubles").checked = ms.trackDoubles !== false;

  const tmsBullToggle = document.getElementById("tms-bull-off-toggle");
  const tmsBullConfig = document.getElementById("tms-bull-off-config");
  const hasBullOff = (ms.bullOffAfterRounds || 0) > 0;
  if (tmsBullToggle) {
    tmsBullToggle.checked = hasBullOff;
    tmsBullConfig.style.display = hasBullOff ? "flex" : "none";
    document.getElementById("tms-bull-off-rounds").value = ms.bullOffAfterRounds || 15;
  }

  document.getElementById("tms-manual-p1-label").textContent = `${match.player1} Legs:`;
  document.getElementById("tms-manual-p2-label").textContent = `${match.player2} Legs:`;
  document.getElementById("tms-opt-p1").textContent = match.player1;
  document.getElementById("tms-opt-p2").textContent = match.player2;
  const starterOpt0 = document.getElementById("tms-starter-opt-0");
  const starterOpt1 = document.getElementById("tms-starter-opt-1");
  if (starterOpt0) starterOpt0.textContent = match.player1;
  if (starterOpt1) starterOpt1.textContent = match.player2;
  const starterSel = document.getElementById("tms-starter");
  if (starterSel) starterSel.value = "0";

  document.getElementById("tms-manual-legs-p1").value = match.isFinished ? match.legsP1 : 0;
  document.getElementById("tms-manual-legs-p2").value = match.isFinished ? match.legsP2 : 0;
  if (match.isFinished) {
    document.getElementById("tms-manual-winner").value = (match.winner === match.player1 ? "p1" : (match.winner === match.player2 ? "p2" : (match.winner === "Draw" ? "draw" : "auto")));
  } else {
    document.getElementById("tms-manual-winner").value = "auto";
  }
  const optDraw = document.getElementById("tms-opt-draw");
  if (optDraw) {
    optDraw.style.display = (match.stage === "group" || !match.stage) ? "block" : "none";
  }

  document.getElementById("modal-tourney-match-setup").style.display = "flex";
};

App.openBullOffModal = function() {
  const match = App.activeMatch;
  if (!match) return;
  const modal = document.getElementById("modal-bull-off");
  document.getElementById("bo-rounds-count").textContent = match.bullOffAfterRounds;
  document.getElementById("bo-p1-name").textContent = match.player1;
  document.getElementById("bo-p2-name").textContent = match.player2;

  const isDecidingP1 = (match.legsP1 + 1 >= match.legsToWin) || (match.legsToWin === 1);
  const isDecidingP2 = (match.legsP2 + 1 >= match.legsToWin) || (match.legsToWin === 1);

  const btnP1 = document.getElementById("btn-bo-award-p1");
  const btnP2 = document.getElementById("btn-bo-award-p2");
  const btnMatchP1 = document.getElementById("btn-bo-match-p1");
  const btnMatchP2 = document.getElementById("btn-bo-match-p2");

  btnP1.textContent = `Award Leg to ${match.player1}`;
  btnP2.textContent = `Award Leg to ${match.player2}`;
  btnMatchP1.textContent = `🏆 Award Match to ${match.player1}`;
  btnMatchP2.textContent = `🏆 Award Match to ${match.player2}`;

  btnP1.style.display = isDecidingP1 ? "none" : "inline-flex";
  btnMatchP1.style.display = "inline-flex";

  btnP2.style.display = isDecidingP2 ? "none" : "inline-flex";
  btnMatchP2.style.display = "inline-flex";

  App.resetBullOffThrows();
  modal.style.display = "flex";
};

App.resetBullOffThrows = function() {
  boThrows = { p1: null, p2: null };
  document.getElementById("bo-p1-val").textContent = "-";
  document.getElementById("bo-p2-val").textContent = "-";
  document.getElementById("bo-status-msg").textContent = "Record each player's throw at the Bull:";
  document.querySelectorAll(".bo-p1-btn, .bo-p2-btn").forEach(b => b.classList.remove("selected", "btn-gold"));
  const btnP1 = document.getElementById("btn-bo-award-p1");
  const btnP2 = document.getElementById("btn-bo-award-p2");
  const btnMatchP1 = document.getElementById("btn-bo-match-p1");
  const btnMatchP2 = document.getElementById("btn-bo-match-p2");
  [btnP1, btnP2, btnMatchP1, btnMatchP2].forEach(b => {
    if (b) b.classList.remove("btn-gold");
  });
};

App.evaluateBullOff = function() {
  const msg = document.getElementById("bo-status-msg");
  const btnP1 = document.getElementById("btn-bo-award-p1");
  const btnP2 = document.getElementById("btn-bo-award-p2");
  const btnMatchP1 = document.getElementById("btn-bo-match-p1");
  const btnMatchP2 = document.getElementById("btn-bo-match-p2");

  [btnP1, btnP2, btnMatchP1, btnMatchP2].forEach(b => {
    if (b) b.classList.remove("btn-gold");
  });

  if (boThrows.p1 === null || boThrows.p2 === null) {
    msg.textContent = "Throw for both players to determine result:";
    return;
  }
  if (boThrows.p1 > boThrows.p2) {
    msg.innerHTML = `🏆 <strong style="color:var(--accent-gold);">${App.activeMatch.player1}</strong> won the Bull-off!`;
    if (btnP1) btnP1.classList.add("btn-gold");
    if (btnMatchP1) btnMatchP1.classList.add("btn-gold");
  } else if (boThrows.p2 > boThrows.p1) {
    msg.innerHTML = `🏆 <strong style="color:var(--accent-gold);">${App.activeMatch.player2}</strong> won the Bull-off!`;
    if (btnP2) btnP2.classList.add("btn-gold");
    if (btnMatchP2) btnMatchP2.classList.add("btn-gold");
  } else {
    msg.innerHTML = `⚖️ <strong>Tie (${boThrows.p1} pts each)!</strong> Re-throw, or pick who was closer.`;
  }
};

App.resolveBullOffWinner = function(winnerIndex, decideEntireMatch = false) {
  if (!App.activeMatch) return;
  document.getElementById("modal-bull-off").style.display = "none";
  App.activeMatch.resolveBullOff(winnerIndex, decideEntireMatch);

  if (App.activeMatch.isFinished && App.currentTournamentMatch && App.activeTournament) {
    App.activeTournament.recordMatchResult(App.currentTournamentMatch.id, {
      winner: App.activeMatch.winner,
      legsP1: App.activeMatch.legsP1,
      legsP2: App.activeMatch.legsP2,
      p1Stats: App.activeMatch.getPlayerStats(0),
      p2Stats: App.activeMatch.getPlayerStats(1)
    });
    App.saveTournamentToStorage();
  }

  App.renderScorer();
};

App.openMidTournamentStats = function() {
  if (!App.activeTournament) return;
  const stats = App.activeTournament.getOverallPlayerStats();
  const tbody = document.getElementById("tbody-player-stats");
  tbody.innerHTML = "";
  stats.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${s.player}</strong></td>
      <td>${s.matchesPlayed}</td><td>${s.matchesWon}</td><td>${s.matchesLost}</td>
      <td>${s.winPct}%</td><td>${s.legsWon} - ${s.legsLost}</td>
      <td><strong>${s.threeDartAvg}</strong></td><td>${s.checkoutPct}%</td>
      <td>${s.doubleHits} / ${s.doubleAttempts}</td><td>${s.count180}</td>
      <td>${s.count140}</td><td>${s.count100}</td><td>${s.highestCheckout || "-"}</td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById("modal-stats").style.display = "flex";
};

App.initModals = function() {
  const tmsBullToggle = document.getElementById("tms-bull-off-toggle");
  const tmsBullConfig = document.getElementById("tms-bull-off-config");
  if (tmsBullToggle && tmsBullConfig) {
    tmsBullToggle.addEventListener("change", (e) => {
      tmsBullConfig.style.display = e.target.checked ? "flex" : "none";
    });
  }

  document.getElementById("btn-tms-close").addEventListener("click", App.closeTournamentMatchSetup);
  document.getElementById("btn-tms-cancel").addEventListener("click", App.closeTournamentMatchSetup);

  document.getElementById("btn-tms-start").addEventListener("click", () => {
    if (!App.pendingTournamentMatch) return;
    const match = App.pendingTournamentMatch;
    App.currentTournamentMatch = match;

    const startingScore = parseInt(document.getElementById("tms-game-type").value, 10) || 501;
    const legsToWin = parseInt(document.getElementById("tms-legs-to-win").value, 10) || 2;
    const doubleOut = document.getElementById("tms-out-mode").value === "double";
    const trackDoubles = document.getElementById("tms-track-doubles").checked;
    const bullOff = tmsBullToggle && tmsBullToggle.checked;
    const bullOffAfterRounds = bullOff ? (parseInt(document.getElementById("tms-bull-off-rounds").value, 10) || 15) : 0;
    const startingPlayer = parseInt(document.getElementById("tms-starter").value, 10) || 0;

    document.getElementById("modal-tourney-match-setup").style.display = "none";

    const badge = document.getElementById("tournament-context-badge");
    badge.textContent = `Tournament: ${match.player1} vs ${match.player2}`;
    badge.style.display = "inline-flex";

    App.promptMatchStarter({
      player1: match.player1,
      player2: match.player2,
      startingScore,
      legsToWin,
      doubleOut,
      trackDoubles,
      bullOffAfterRounds,
      startingPlayer
    });
  });

  document.getElementById("btn-tms-save-manual").addEventListener("click", () => {
    if (!App.pendingTournamentMatch || !App.activeTournament) return;
    const match = App.pendingTournamentMatch;
    const legsP1 = parseInt(document.getElementById("tms-manual-legs-p1").value, 10) || 0;
    const legsP2 = parseInt(document.getElementById("tms-manual-legs-p2").value, 10) || 0;
    const winnerOpt = document.getElementById("tms-manual-winner").value;

    let winner = null;
    if (winnerOpt === "p1") winner = match.player1;
    else if (winnerOpt === "p2") winner = match.player2;
    else if (winnerOpt === "draw") winner = "Draw";
    else {
      if (legsP1 > legsP2) winner = match.player1;
      else if (legsP2 > legsP1) winner = match.player2;
      else winner = (match.stage === "group" || !match.stage) ? "Draw" : match.player1;
    }

    const p1Stats = {
      name: match.player1, legsWon: legsP1, legsLost: legsP2, threeDartAvg: 0,
      doubleAttempts: 0, doubleHits: 0, checkoutPct: 0, highestCheckout: 0,
      count180: 0, count140: 0, count100: 0, count60: 0, totalDarts: 0, totalScore: 0
    };
    const p2Stats = {
      name: match.player2, legsWon: legsP2, legsLost: legsP1, threeDartAvg: 0,
      doubleAttempts: 0, doubleHits: 0, checkoutPct: 0, highestCheckout: 0,
      count180: 0, count140: 0, count100: 0, count60: 0, totalDarts: 0, totalScore: 0
    };

    App.activeTournament.recordMatchResult(match.id, {
      winner, legsP1, legsP2, p1Stats, p2Stats
    });

    App.saveTournamentToStorage();
    App.closeTournamentMatchSetup();
    App.renderTournamentDashboard();
  });

  document.querySelectorAll(".bo-p1-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".bo-p1-btn").forEach(b => b.classList.remove("selected", "btn-gold"));
      btn.classList.add("selected", "btn-gold");
      boThrows.p1 = parseInt(btn.dataset.val, 10);
      const label = btn.dataset.val === "50" ? "Bullseye (50)" : (btn.dataset.val === "25" ? "Outer Bull (25)" : "Miss (0)");
      document.getElementById("bo-p1-val").textContent = label;
      App.evaluateBullOff();
    });
  });

  document.querySelectorAll(".bo-p2-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".bo-p2-btn").forEach(b => b.classList.remove("selected", "btn-gold"));
      btn.classList.add("selected", "btn-gold");
      boThrows.p2 = parseInt(btn.dataset.val, 10);
      const label = btn.dataset.val === "50" ? "Bullseye (50)" : (btn.dataset.val === "25" ? "Outer Bull (25)" : "Miss (0)");
      document.getElementById("bo-p2-val").textContent = label;
      App.evaluateBullOff();
    });
  });

  document.getElementById("btn-bo-award-p1").addEventListener("click", () => App.resolveBullOffWinner(0, false));
  document.getElementById("btn-bo-award-p2").addEventListener("click", () => App.resolveBullOffWinner(1, false));
  document.getElementById("btn-bo-match-p1").addEventListener("click", () => App.resolveBullOffWinner(0, true));
  document.getElementById("btn-bo-match-p2").addEventListener("click", () => App.resolveBullOffWinner(1, true));
  document.getElementById("btn-bo-reset").addEventListener("click", App.resetBullOffThrows);

  const btnBoExit = document.getElementById("btn-bo-exit");
  if (btnBoExit) {
    btnBoExit.addEventListener("click", () => {
      if (confirm("Exit current match?")) {
        document.getElementById("modal-bull-off").style.display = "none";
        if (App.currentTournamentMatch && App.activeTournament) {
          App.renderTournamentDashboard();
          App.showView("tourneyDash");
        } else {
          App.showView("home");
        }
      }
    });
  }

  document.getElementById("btn-view-mid-stats").addEventListener("click", App.openMidTournamentStats);
  document.getElementById("btn-close-stats-modal").addEventListener("click", () => document.getElementById("modal-stats").style.display = "none");
  document.getElementById("btn-modal-close-bottom").addEventListener("click", () => document.getElementById("modal-stats").style.display = "none");
};
