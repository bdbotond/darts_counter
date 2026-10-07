// Application core, router, and state namespace
window.App = {
  sync: null,
  activeMatch: null,
  activeTournament: null,
  currentTournamentMatch: null,
  pendingTournamentMatch: null,
  views: null,
  navBtns: null,

  showView: function(viewName) {
    Object.values(App.views).forEach(v => v.style.display = "none");
    Object.values(App.navBtns).forEach(b => b.classList.remove("active"));
    if (App.views[viewName]) App.views[viewName].style.display = "block";

    if (viewName === "home") App.navBtns.home.classList.add("active");
    else if (viewName === "matchSetup" || viewName === "scorer") App.navBtns.quickMatch.classList.add("active");
    else if (viewName === "tourneySetup" || viewName === "tourneyDash") App.navBtns.tournament.classList.add("active");

    if (viewName === "tourneyDash" && App.activeTournament && App.renderTournamentDashboard) {
      App.renderTournamentDashboard();
    } else if (viewName === "scorer" && App.activeMatch && App.renderScorer) {
      App.renderScorer();
    }

    if (App.activeTournament && (viewName === "tourneyDash" || viewName === "scorer")) {
      App.navBtns.midStats.style.display = "inline-flex";
    } else {
      App.navBtns.midStats.style.display = "none";
    }
  },

  startMatch: function(config) {
    App.activeMatch = new DartsMatch(config);
    const starterName = config.startingPlayer === 1 ? config.player2 : config.player1;
    let info = `${config.startingScore} ${config.doubleOut ? "Double Out" : "Single Out"} (First to ${config.legsToWin}) • ${starterName} starts`;
    if (config.bullOffAfterRounds > 0) info += ` • Bull-off R${config.bullOffAfterRounds}`;
    document.getElementById("match-info-badge").textContent = info;
    App.resetKeypad();
    App.renderScorer();
    App.showView("scorer");
  },

  initAppListeners: function() {
    App.views = {
      home: document.getElementById("view-home"),
      matchSetup: document.getElementById("view-match-setup"),
      scorer: document.getElementById("view-scorer"),
      tourneySetup: document.getElementById("view-tournament-setup"),
      tourneyDash: document.getElementById("view-tournament-dashboard")
    };

    App.navBtns = {
      home: document.getElementById("nav-home"),
      quickMatch: document.getElementById("nav-quick-match"),
      tournament: document.getElementById("nav-tournament"),
      midStats: document.getElementById("nav-tourney-stats")
    };

    App.navBtns.home.addEventListener("click", () => App.showView("home"));
    App.navBtns.quickMatch.addEventListener("click", () => {
      if (App.activeMatch && !App.activeMatch.isFinished) App.showView("scorer");
      else App.showView("matchSetup");
    });
    App.navBtns.tournament.addEventListener("click", () => {
      if (App.activeTournament) App.showView("tourneyDash");
      else App.showView("tourneySetup");
    });
    App.navBtns.midStats.addEventListener("click", App.openMidTournamentStats);

    document.getElementById("btn-start-quick-match").addEventListener("click", () => App.showView("matchSetup"));
    document.getElementById("btn-start-tourney-setup").addEventListener("click", () => App.showView("tourneySetup"));
    document.getElementById("btn-cancel-match-setup").addEventListener("click", () => App.showView("home"));
    document.getElementById("btn-cancel-tourney-setup").addEventListener("click", () => App.showView("home"));

    document.getElementById("setup-game-type").addEventListener("change", (e) => {
      document.getElementById("setup-custom-score-group").style.display = e.target.value === "custom" ? "block" : "none";
    });

    const setupBullToggle = document.getElementById("setup-bull-off-toggle");
    const setupBullConfig = document.getElementById("setup-bull-off-config");
    if (setupBullToggle && setupBullConfig) {
      setupBullToggle.addEventListener("change", (e) => {
        setupBullConfig.style.display = e.target.checked ? "flex" : "none";
      });
    }

    const tourneyBullToggle = document.getElementById("tourney-bull-off-toggle");
    const tourneyBullConfig = document.getElementById("tourney-bull-off-config");
    if (tourneyBullToggle && tourneyBullConfig) {
      tourneyBullToggle.addEventListener("change", (e) => {
        tourneyBullConfig.style.display = e.target.checked ? "flex" : "none";
      });
    }

    const setupP1Input = document.getElementById("setup-p1-name");
    const setupP2Input = document.getElementById("setup-p2-name");
    const setupStarterOpt0 = document.getElementById("setup-starter-opt-0");
    const setupStarterOpt1 = document.getElementById("setup-starter-opt-1");
    const updateStarterOptions = () => {
      if (setupStarterOpt0) setupStarterOpt0.textContent = setupP1Input.value.trim() || "Player 1";
      if (setupStarterOpt1) setupStarterOpt1.textContent = setupP2Input.value.trim() || "Player 2";
    };
    if (setupP1Input && setupP2Input) {
      setupP1Input.addEventListener("input", updateStarterOptions);
      setupP2Input.addEventListener("input", updateStarterOptions);
    }

    document.getElementById("btn-launch-match").addEventListener("click", () => {
      const p1 = document.getElementById("setup-p1-name").value.trim() || "Player 1";
      const p2 = document.getElementById("setup-p2-name").value.trim() || "Player 2";
      const typeVal = document.getElementById("setup-game-type").value;
      let startingScore = parseInt(typeVal, 10);
      if (typeVal === "custom") startingScore = parseInt(document.getElementById("setup-custom-score").value, 10) || 501;
      const legsToWin = parseInt(document.getElementById("setup-legs-to-win").value, 10) || 3;
      const doubleOut = document.getElementById("setup-out-mode").value === "double";
      const trackDoubles = document.getElementById("setup-track-doubles").checked;
      const bullOff = setupBullToggle && setupBullToggle.checked;
      const bullOffAfterRounds = bullOff ? (parseInt(document.getElementById("setup-bull-off-rounds").value, 10) || 15) : 0;
      const startingPlayer = parseInt(document.getElementById("setup-starter").value, 10) || 0;

      App.currentTournamentMatch = null;
      document.getElementById("tournament-context-badge").style.display = "none";
      App.promptMatchStarter({ player1: p1, player2: p2, startingScore, legsToWin, doubleOut, trackDoubles, bullOffAfterRounds, startingPlayer });
    });
  },

  init: function() {
    const isSpectator = window.location.search.includes("screen=display") || window.location.hash === "#display";
    if (isSpectator) {
      App.initSpectator();
    } else {
      App.sync = new SyncHub(true);
      App.initAppListeners();
      App.initScorerUI();
      App.initKeypad();
      App.initTournamentUI();
      App.initModals();
      App.renderPlayerTags();
      App.loadTournamentFromStorage();
      App.showView("home");
    }
  }
};
