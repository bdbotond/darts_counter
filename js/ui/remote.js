// Mobile remote scorer controller (?screen=remote)
window.App = window.App || {};

App.initRemote = function() {
  const mainApp = document.getElementById("main-app-container");
  const spectatorScreen = document.getElementById("spectator-screen");
  const remoteScreen = document.getElementById("remote-screen");

  if (mainApp) mainApp.style.display = "none";
  if (spectatorScreen) spectatorScreen.style.display = "none";
  if (remoteScreen) remoteScreen.style.display = "flex";

  const sync = new SyncHub(false);
  App.sync = sync;

  let currentState = null;
  let remoteNumVal = "";
  let remoteSelectedDoubleAttempts = 0;
  let remoteDartsCount = 3;

  // 3-Dart keypad state
  let remoteDarts = [];
  let remoteMultiplier = 1;

  // Cache DOM elements
  const elWaiting = document.getElementById("remote-waiting");
  const elContent = document.getElementById("remote-active-content");

  const elP1Box = document.getElementById("rem-p1-box");
  const elP2Box = document.getElementById("rem-p2-box");
  const elP1Name = document.getElementById("rem-p1-name");
  const elP2Name = document.getElementById("rem-p2-name");
  const elP1Score = document.getElementById("rem-p1-score");
  const elP2Score = document.getElementById("rem-p2-score");
  const elP1Legs = document.getElementById("rem-p1-legs");
  const elP2Legs = document.getElementById("rem-p2-legs");
  const elP1Checkout = document.getElementById("rem-p1-checkout");
  const elP2Checkout = document.getElementById("rem-p2-checkout");
  const elTurnBadge = document.getElementById("rem-turn-indicator");

  const elScoreDisplay = document.getElementById("rem-score-display");
  const elDoublePrompt = document.getElementById("rem-double-prompt");
  const elDartsCountSel = document.getElementById("rem-darts-count");

  const elFinishCard = document.getElementById("rem-finish-overlay");
  const elFinishWinner = document.getElementById("rem-finish-winner");
  const elFinishSummary = document.getElementById("rem-finish-summary");
  const elBtnFinishOk = document.getElementById("rem-btn-finish-ok");

  const elBullOffCard = document.getElementById("rem-bulloff-overlay");
  const elBoP1Val = document.getElementById("rem-bo-p1-val");
  const elBoP2Val = document.getElementById("rem-bo-p2-val");
  const elBoStatus = document.getElementById("rem-bo-status");
  let boThrows = { p1: null, p2: null };

  function updateNumpadDisplay() {
    if (elScoreDisplay) {
      elScoreDisplay.textContent = remoteNumVal || "0";
      if (!remoteNumVal) {
        elScoreDisplay.classList.add("placeholder");
      } else {
        elScoreDisplay.classList.remove("placeholder");
      }
    }
  }

  function setRemoteMultiplier(mult) {
    remoteMultiplier = mult;
    const s = document.getElementById("rem-mult-single");
    const d = document.getElementById("rem-mult-double");
    const t = document.getElementById("rem-mult-triple");
    [s, d, t].forEach(b => b && b.classList.remove("active"));
    if (mult === 1 && s) s.classList.add("active");
    if (mult === 2 && d) d.classList.add("active");
    if (mult === 3 && t) t.classList.add("active");
  }

  function updateKeypadSlots() {
    for (let i = 1; i <= 3; i++) {
      const slot = document.getElementById(`rem-slot-${i}`);
      const val = document.getElementById(`rem-slot-val-${i}`);
      const dart = remoteDarts[i - 1];
      if (dart) {
        if (val) val.textContent = dart.label;
        if (slot) slot.classList.remove("active");
      } else {
        if (val) val.textContent = "-";
        if (slot) {
          if (i === remoteDarts.length + 1) slot.classList.add("active");
          else slot.classList.remove("active");
        }
      }
    }
    const total = remoteDarts.reduce((acc, d) => acc + d.score, 0);
    const totalEl = document.getElementById("rem-keypad-total");
    if (totalEl) totalEl.textContent = total;
  }

  function resetRemoteKeypad() {
    remoteDarts = [];
    setRemoteMultiplier(1);
    updateKeypadSlots();
  }

  function handleKeypadTarget(target) {
    if (remoteDarts.length >= 3) return;
    let mult = remoteMultiplier;
    let score = 0, isDouble = false, label = "";

    if (target === 0) { score = 0; label = "Miss"; }
    else if (target === 50) { score = 50; mult = 2; isDouble = true; label = "Bull"; }
    else if (target === 25) { score = 25; mult = 1; label = "25"; }
    else {
      if (mult === 3) label = `T${target}`;
      else if (mult === 2) { label = `D${target}`; isDouble = true; }
      else label = `${target}`;
      score = target * mult;
    }

    remoteDarts.push({ target, multiplier: mult, score, isDouble, label });
    setRemoteMultiplier(1);
    updateKeypadSlots();
  }

  function evaluateBullOffState() {
    if (!elBoStatus) return;
    if (boThrows.p1 === null || boThrows.p2 === null) {
      elBoStatus.textContent = "Throw for both players to determine result:";
      return;
    }
    if (boThrows.p1 > boThrows.p2) {
      elBoStatus.textContent = `🏆 ${currentState.player1} won the Bull-off!`;
    } else if (boThrows.p2 > boThrows.p1) {
      elBoStatus.textContent = `🏆 ${currentState.player2} won the Bull-off!`;
    } else {
      elBoStatus.textContent = `⚖️ Tie (${boThrows.p1} pts each)! Re-throw.`;
    }
  }

  function renderRemoteState(state) {
    currentState = state;
    if (!state || !state.id || state.active === false) {
      if (elWaiting) elWaiting.style.display = "flex";
      if (elContent) elContent.style.display = "none";
      return;
    }

    if (elWaiting) elWaiting.style.display = "none";
    if (elContent) elContent.style.display = "flex";

    // Player Header
    if (elP1Name) elP1Name.textContent = state.player1;
    if (elP2Name) elP2Name.textContent = state.player2;
    if (elP1Score) elP1Score.textContent = state.scores[0];
    if (elP2Score) elP2Score.textContent = state.scores[1];
    if (elP1Legs) elP1Legs.textContent = `${state.legsP1} / ${state.legsToWin}`;
    if (elP2Legs) elP2Legs.textContent = `${state.legsP2} / ${state.legsToWin}`;

    if (elP1Checkout) elP1Checkout.textContent = state.p1Checkout ? `🎯 ${state.p1Checkout}` : "";
    if (elP2Checkout) elP2Checkout.textContent = state.p2Checkout ? `🎯 ${state.p2Checkout}` : "";

    const isP1Turn = state.currentTurn === 0;
    if (elP1Box && elP2Box) {
      if (isP1Turn) {
        elP1Box.classList.add("active-turn");
        elP2Box.classList.remove("active-turn");
      } else {
        elP2Box.classList.add("active-turn");
        elP1Box.classList.remove("active-turn");
      }
    }

    const curPlayerName = isP1Turn ? state.player1 : state.player2;
    if (elTurnBadge) elTurnBadge.textContent = `${curPlayerName}'s Turn`;

    // Double attempts bar visibility
    const activeScore = state.scores[state.currentTurn];
    const canFinish = typeof isFinishPossible === "function" ? isFinishPossible(activeScore, state.doubleOut) : (activeScore <= 170);
    if (elDoublePrompt) {
      elDoublePrompt.style.display = (canFinish && state.doubleOut && state.trackDoubles) ? "flex" : "none";
    }

    // Bull-off overlay
    if (elBullOffCard) {
      if (state.isBullOffDue) {
        elBullOffCard.style.display = "flex";
        document.getElementById("rem-bo-p1-name").textContent = state.player1;
        document.getElementById("rem-bo-p2-name").textContent = state.player2;
        document.getElementById("rem-btn-bo-leg-p1").textContent = `Award Leg: ${state.player1}`;
        document.getElementById("rem-btn-bo-leg-p2").textContent = `Award Leg: ${state.player2}`;
      } else {
        elBullOffCard.style.display = "none";
      }
    }

    // Finish overlay
    if (elFinishCard) {
      if (state.isFinished) {
        elFinishCard.style.display = "flex";
        if (elFinishWinner) elFinishWinner.textContent = `🎉 Winner: ${state.winner}`;
        if (elFinishSummary) elFinishSummary.textContent = `${state.player1} ${state.legsP1} - ${state.legsP2} ${state.player2}`;
      } else {
        elFinishCard.style.display = "none";
      }
    }
  }

  // --- Remote actions dispatcher ---
  function submitScore(score, isBust = false) {
    if (!currentState || currentState.isFinished) return;
    const num = isBust ? 0 : parseInt(score, 10);
    if (isNaN(num) || num < 0 || num > 180) {
      alert("Score must be between 0 and 180");
      return;
    }
    if (!isBust && typeof isValidThreeDartScore === "function" && !isValidThreeDartScore(num)) {
      alert(`Invalid score: ${num} cannot be scored with 3 darts.`);
      return;
    }

    sync.sendAction({
      type: "VISIT",
      score: num,
      dartsCount: remoteDartsCount,
      doubleAttempts: remoteSelectedDoubleAttempts,
      bust: isBust
    });

    remoteNumVal = "";
    remoteSelectedDoubleAttempts = 0;
    document.querySelectorAll(".rem-dbl-btn").forEach((b, idx) => {
      if (idx === 0) b.classList.add("selected");
      else b.classList.remove("selected");
    });
    updateNumpadDisplay();
  }

  function initListeners() {
    // Top player boxes: click to set starter if at start of match
    if (elP1Box) {
      elP1Box.addEventListener("click", () => {
        sync.sendAction({ type: "SET_STARTER", playerIndex: 0 });
      });
    }
    if (elP2Box) {
      elP2Box.addEventListener("click", () => {
        sync.sendAction({ type: "SET_STARTER", playerIndex: 1 });
      });
    }

    // Tab switching (Numpad vs 3-Dart Keypad)
    const tabNum = document.getElementById("rem-tab-numpad");
    const tabKey = document.getElementById("rem-tab-keypad");
    const viewNum = document.getElementById("rem-view-numpad");
    const viewKey = document.getElementById("rem-view-keypad");

    if (tabNum && tabKey && viewNum && viewKey) {
      tabNum.addEventListener("click", () => {
        tabNum.classList.add("active");
        tabKey.classList.remove("active");
        viewNum.style.display = "flex";
        viewKey.style.display = "none";
      });
      tabKey.addEventListener("click", () => {
        tabKey.classList.add("active");
        tabNum.classList.remove("active");
        viewNum.style.display = "none";
        viewKey.style.display = "flex";
        updateKeypadSlots();
      });
    }

    // Calculator Numpad buttons (0-9)
    document.querySelectorAll(".rem-num-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const d = btn.dataset.digit;
        if (!d) return;
        if (remoteNumVal.length >= 3) return;
        const candidate = remoteNumVal + d;
        if (parseInt(candidate, 10) <= 180) {
          remoteNumVal = candidate;
          updateNumpadDisplay();
        }
      });
    });

    // Clear and Backspace
    const btnClear = document.getElementById("rem-btn-clear");
    if (btnClear) {
      btnClear.addEventListener("click", () => {
        remoteNumVal = "";
        updateNumpadDisplay();
      });
    }
    const btnBksp = document.getElementById("rem-btn-backspace");
    if (btnBksp) {
      btnBksp.addEventListener("click", () => {
        remoteNumVal = remoteNumVal.slice(0, -1);
        updateNumpadDisplay();
      });
    }

    // Common quick-score buttons
    document.querySelectorAll(".rem-common-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const sc = btn.dataset.score;
        submitScore(sc, false);
      });
    });

    // Submit & Bust
    const btnSubmit = document.getElementById("rem-btn-submit");
    if (btnSubmit) {
      btnSubmit.addEventListener("click", () => submitScore(remoteNumVal || "0", false));
    }
    const btnBust = document.getElementById("rem-btn-bust");
    if (btnBust) {
      btnBust.addEventListener("click", () => submitScore(0, true));
    }

    // Undo Last Visit
    const btnUndo = document.getElementById("rem-btn-undo");
    if (btnUndo) {
      btnUndo.addEventListener("click", () => {
        sync.sendAction({ type: "UNDO" });
      });
    }

    // Darts at Double buttons
    document.querySelectorAll(".rem-dbl-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".rem-dbl-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        remoteSelectedDoubleAttempts = parseInt(btn.dataset.count, 10) || 0;
      });
    });

    // Darts count in visit select
    if (elDartsCountSel) {
      elDartsCountSel.addEventListener("change", (e) => {
        remoteDartsCount = parseInt(e.target.value, 10) || 3;
      });
    }

    // --- 3-Dart Keypad Mode Listeners ---
    const targetsGrid = document.getElementById("rem-keypad-targets");
    if (targetsGrid) {
      targetsGrid.innerHTML = "";
      const frag = document.createDocumentFragment();
      for (let i = 1; i <= 20; i++) {
        const b = document.createElement("button");
        b.className = "rem-target-btn";
        b.textContent = i;
        b.addEventListener("click", () => handleKeypadTarget(i));
        frag.appendChild(b);
      }
      const miss = document.createElement("button");
      miss.className = "rem-target-btn";
      miss.textContent = "Miss (0)";
      miss.addEventListener("click", () => handleKeypadTarget(0));
      frag.appendChild(miss);

      const bull25 = document.createElement("button");
      bull25.className = "rem-target-btn rem-bull-25";
      bull25.textContent = "25";
      bull25.addEventListener("click", () => handleKeypadTarget(25));
      frag.appendChild(bull25);

      const bull50 = document.createElement("button");
      bull50.className = "rem-target-btn rem-bull-50";
      bull50.textContent = "Bull (50)";
      bull50.addEventListener("click", () => handleKeypadTarget(50));
      frag.appendChild(bull50);

      targetsGrid.appendChild(frag);
    }

    const multS = document.getElementById("rem-mult-single");
    const multD = document.getElementById("rem-mult-double");
    const multT = document.getElementById("rem-mult-triple");
    if (multS) multS.addEventListener("click", () => setRemoteMultiplier(1));
    if (multD) multD.addEventListener("click", () => setRemoteMultiplier(2));
    if (multT) multT.addEventListener("click", () => setRemoteMultiplier(3));

    for (let i = 1; i <= 3; i++) {
      const slot = document.getElementById(`rem-slot-${i}`);
      if (slot) {
        slot.addEventListener("click", () => {
          if (remoteDarts.length >= i) {
            remoteDarts.splice(i - 1);
            updateKeypadSlots();
          }
        });
      }
    }

    const btnClearKeypad = document.getElementById("rem-btn-clear-keypad");
    if (btnClearKeypad) btnClearKeypad.addEventListener("click", resetRemoteKeypad);

    const btnSubmitKeypad = document.getElementById("rem-btn-submit-keypad");
    if (btnSubmitKeypad) {
      btnSubmitKeypad.addEventListener("click", () => {
        if (remoteDarts.length === 0 || !currentState || currentState.isFinished) return;
        const total = remoteDarts.reduce((acc, d) => acc + d.score, 0);
        const doubleAttempts = remoteDarts.filter(d => d.isDouble).length;
        sync.sendAction({
          type: "VISIT",
          score: total,
          dartsCount: remoteDarts.length,
          doubleAttempts,
          dartBreakdown: [...remoteDarts]
        });
        resetRemoteKeypad();
      });
    }

    // --- Bull-off Modal Handlers ---
    document.querySelectorAll(".rem-bo-p1-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".rem-bo-p1-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        boThrows.p1 = parseInt(btn.dataset.val, 10);
        if (elBoP1Val) elBoP1Val.textContent = btn.dataset.val;
        evaluateBullOffState();
        sync.sendAction({ type: "BULL_OFF_THROW", player: "p1", val: boThrows.p1 });
      });
    });

    document.querySelectorAll(".rem-bo-p2-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".rem-bo-p2-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        boThrows.p2 = parseInt(btn.dataset.val, 10);
        if (elBoP2Val) elBoP2Val.textContent = btn.dataset.val;
        evaluateBullOffState();
        sync.sendAction({ type: "BULL_OFF_THROW", player: "p2", val: boThrows.p2 });
      });
    });

    const btnBoLegP1 = document.getElementById("rem-btn-bo-leg-p1");
    const btnBoLegP2 = document.getElementById("rem-btn-bo-leg-p2");
    const btnBoMatchP1 = document.getElementById("rem-btn-bo-match-p1");
    const btnBoMatchP2 = document.getElementById("rem-btn-bo-match-p2");

    if (btnBoLegP1) btnBoLegP1.addEventListener("click", () => sync.sendAction({ type: "BULL_OFF_RESOLVE", winnerIndex: 0, decideEntireMatch: false }));
    if (btnBoLegP2) btnBoLegP2.addEventListener("click", () => sync.sendAction({ type: "BULL_OFF_RESOLVE", winnerIndex: 1, decideEntireMatch: false }));
    if (btnBoMatchP1) btnBoMatchP1.addEventListener("click", () => sync.sendAction({ type: "BULL_OFF_RESOLVE", winnerIndex: 0, decideEntireMatch: true }));
    if (btnBoMatchP2) btnBoMatchP2.addEventListener("click", () => sync.sendAction({ type: "BULL_OFF_RESOLVE", winnerIndex: 1, decideEntireMatch: true }));

    // --- Finish Confirmation ---
    if (elBtnFinishOk) {
      elBtnFinishOk.addEventListener("click", () => {
        sync.sendAction({ type: "FINISH_OK" });
      });
    }
  }

  initListeners();
  sync.onState(renderRemoteState);
  sync.request();
};
