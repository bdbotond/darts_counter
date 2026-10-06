// Spectator second-screen display controller
window.App = window.App || {};

App.initSpectator = function() {
  document.getElementById("main-app-container").style.display = "none";
  const spScreen = document.getElementById("spectator-screen");
  spScreen.style.display = "flex";

  const sync = new SyncHub(false);
  const waiting = document.getElementById("waiting-screen");
  const board = document.getElementById("spectator-scoreboard-main");

  sync.onState((state) => {
    if (!state) return;
    waiting.style.display = "none";
    board.style.display = "grid";

    document.getElementById("sp-p1-name").textContent = state.player1;
    document.getElementById("sp-p2-name").textContent = state.player2;
    document.getElementById("sp-p1-legs").textContent = `${state.legsP1} / ${state.legsToWin}`;
    document.getElementById("sp-p2-legs").textContent = `${state.legsP2} / ${state.legsToWin}`;
    document.getElementById("sp-p1-score").textContent = state.scores[0];
    document.getElementById("sp-p2-score").textContent = state.scores[1];

    document.getElementById("sp-p1-checkout").textContent = state.p1Checkout ? `🎯 ${state.p1Checkout}` : "";
    document.getElementById("sp-p2-checkout").textContent = state.p2Checkout ? `🎯 ${state.p2Checkout}` : "";

    document.getElementById("sp-p1-avg").textContent = state.p1Stats ? state.p1Stats.threeDartAvg : "0.00";
    document.getElementById("sp-p2-avg").textContent = state.p2Stats ? state.p2Stats.threeDartAvg : "0.00";

    if (state.lastVisit) {
      const val = state.lastVisit.bust ? "BUST" : state.lastVisit.score;
      if (state.lastVisit.playerIndex === 0) document.getElementById("sp-p1-last").textContent = val;
      else document.getElementById("sp-p2-last").textContent = val;
    }

    if (state.isBullOffDue) {
      document.getElementById("sp-p1-checkout").textContent = "🎯 BULL-OFF DECIDING LEG";
      document.getElementById("sp-p2-checkout").textContent = "🎯 BULL-OFF DECIDING LEG";
    }

    const b1 = document.getElementById("sp-p1-box");
    const b2 = document.getElementById("sp-p2-box");
    if (state.currentTurn === 0) {
      b1.classList.add("active-turn"); b2.classList.remove("active-turn");
    } else {
      b2.classList.add("active-turn"); b1.classList.remove("active-turn");
    }
  });

  sync.request();

  document.getElementById("btn-toggle-fullscreen").addEventListener("click", () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  });
};
