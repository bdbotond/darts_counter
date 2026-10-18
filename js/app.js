// Application core, router, and state namespace
window.App = {
  sync: null,
  activeMatch: null,
  activeTournament: null,
  currentTournamentMatch: null,
  pendingTournamentMatch: null,
  views: null,
  navBtns: null,

  escapeHtml: function(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  },

  updateMatchInfoBadge: function(match) {
    if (!match) return;
    const starterName = match.startingPlayer === 1 ? match.player2 : match.player1;
    let info = `${match.startingScore} ${match.doubleOut ? "Double Out" : "Single Out"} (First to ${match.legsToWin}) • ${starterName} starts`;
    if (match.bullOffAfterRounds > 0) info += ` • Bull-off R${match.bullOffAfterRounds}`;
    const badge = document.getElementById("match-info-badge");
    if (badge) badge.textContent = info;
  },

  showView: function(viewName) {
    Object.values(App.views).forEach(v => v.style.display = "none");
    Object.values(App.navBtns).forEach(b => b.classList.remove("active"));
    if (App.views[viewName]) App.views[viewName].style.display = "block";

    if (viewName === "home") {
      App.navBtns.home.classList.add("active");
      const tourneyBtn = document.getElementById("btn-start-tourney-setup");
      if (tourneyBtn) {
        tourneyBtn.textContent = App.activeTournament ? "Continue Tournament" : "Create Tournament";
      }
    }
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

  openConnectPhoneModal: function() {
    const modal = document.getElementById("modal-connect-phone");
    if (!modal) return;
    modal.style.display = "flex";

    const qrImg = document.getElementById("phone-qr-img");
    const activeLabel = document.getElementById("phone-qr-active-label");
    const urlsContainer = document.getElementById("phone-urls-list");
    const offlineNotice = document.getElementById("phone-connect-offline");
    const onlineContent = document.getElementById("phone-connect-online");
    const fileTip = document.getElementById("phone-file-protocol-tip");

    function renderWithBase(base, data) {
      if (offlineNotice) offlineNotice.style.display = "none";
      if (onlineContent) onlineContent.style.display = "block";
      if (fileTip) {
        fileTip.style.display = (window.location && window.location.protocol === "file:") ? "block" : "none";
      }

      function setActiveUrl(url) {
        if (qrImg) qrImg.src = `${base}/api/qr?data=${encodeURIComponent(url)}`;
        if (activeLabel) activeLabel.textContent = `Active QR: ${url}`;
        if (urlsContainer) {
          urlsContainer.querySelectorAll(".phone-url-row").forEach(r => {
            if (r.dataset.url === url) r.classList.add("active-url-row");
            else r.classList.remove("active-url-row");
          });
        }
      }

      const urls = data.urls || [`http://localhost:${data.port || 8000}/?screen=remote`];
      setActiveUrl(urls[0]);

      if (urlsContainer) {
        urlsContainer.innerHTML = "";
        urls.forEach(u => {
          const row = document.createElement("div");
          row.className = "phone-url-row" + (u === urls[0] ? " active-url-row" : "");
          row.dataset.url = u;
          row.innerHTML = `
            <div style="flex:1; cursor:pointer;" class="phone-url-select" title="Click to display this QR code">
              <a href="${u}" target="_blank" class="phone-url-link">${u}</a>
            </div>
            <button class="btn btn-primary btn-sm btn-select-qr" style="padding: 0.2rem 0.6rem; font-size: 0.8rem;">Show QR</button>
            <button class="btn btn-secondary btn-sm btn-copy-url" data-url="${u}" style="padding: 0.2rem 0.6rem; font-size: 0.8rem;">📋 Copy</button>
          `;
          const copyBtn = row.querySelector(".btn-copy-url");
          copyBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(u).then(() => {
              copyBtn.textContent = "✓ Copied!";
              setTimeout(() => copyBtn.textContent = "📋 Copy", 1500);
            }).catch(() => {});
          });
          const selBtn = row.querySelector(".btn-select-qr");
          selBtn.addEventListener("click", () => setActiveUrl(u));
          row.querySelector(".phone-url-select").addEventListener("click", () => setActiveUrl(u));
          urlsContainer.appendChild(row);
        });
      }
    }

    if (window.SyncHub && typeof window.SyncHub.discoverServer === "function") {
      window.SyncHub.discoverServer(true).then(base => {
        if (base !== null && window.SyncHub._serverInfo) {
          renderWithBase(base, window.SyncHub._serverInfo);
        } else {
          if (onlineContent) onlineContent.style.display = "none";
          if (offlineNotice) offlineNotice.style.display = "block";
        }
      }).catch(() => {
        if (onlineContent) onlineContent.style.display = "none";
        if (offlineNotice) offlineNotice.style.display = "block";
      });
    } else {
      fetch("/api/info")
        .then(r => r.json())
        .then(data => renderWithBase("", data))
        .catch(() => {
          if (onlineContent) onlineContent.style.display = "none";
          if (offlineNotice) offlineNotice.style.display = "block";
        });
    }
  },

  startMatch: function(config) {
    App.activeMatch = new DartsMatch(config);
    App.updateMatchInfoBadge(App.activeMatch);
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

    const navConnectPhone = document.getElementById("nav-connect-phone");
    if (navConnectPhone) navConnectPhone.addEventListener("click", App.openConnectPhoneModal);

    const btnHomeConnect = document.getElementById("btn-home-connect-phone");
    if (btnHomeConnect) btnHomeConnect.addEventListener("click", App.openConnectPhoneModal);

    const btnCloseConnect = document.getElementById("btn-close-connect-phone");
    if (btnCloseConnect) {
      btnCloseConnect.addEventListener("click", () => {
        const m = document.getElementById("modal-connect-phone");
        if (m) m.style.display = "none";
      });
    }

    document.getElementById("btn-start-quick-match").addEventListener("click", () => App.showView("matchSetup"));
    document.getElementById("btn-start-tourney-setup").addEventListener("click", () => {
      if (App.activeTournament) App.showView("tourneyDash");
      else App.showView("tourneySetup");
    });
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
    const isRemote = window.location.search.includes("screen=remote") || window.location.hash === "#remote";
    if (isSpectator) {
      App.initSpectator();
    } else if (isRemote) {
      App.initRemote();
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
