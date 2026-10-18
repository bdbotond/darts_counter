// Keypad and score input controller
window.App = window.App || {};

App.keypadDarts = [];
App.currentMultiplier = 1;
let selectedDoubleAttempts = 0;

App.submitNumericScore = function(val, isBust = false) {
  const match = App.activeMatch;
  if (!match || match.isFinished) return;
  if (match.bullOffAfterRounds > 0 &&
      match.currentLeg.visits[0].length >= match.bullOffAfterRounds &&
      match.currentLeg.visits[1].length >= match.bullOffAfterRounds) {
    App.openBullOffModal();
    return;
  }

  const score = isBust ? 0 : parseInt(val, 10);
  if (isNaN(score) || score < 0 || score > 180) {
    alert("Score must be between 0 and 180");
    return;
  }

  const pIdx = match.currentTurn;
  const currentScore = match.currentLeg.scores[pIdx];
  if (match.doubleOut && !isBust && (currentScore - score === 0) && !isFinishPossible(currentScore, true)) {
    alert(`Bust! Cannot checkout from ${currentScore} on Double Out (maximum finish is 170).`);
  } else if (!isBust && typeof isValidThreeDartScore === "function" && !isValidThreeDartScore(score)) {
    alert(`Invalid score: ${score} cannot be scored with 3 darts.`);
    return;
  }

  const dartsCount = parseInt(document.getElementById("numeric-darts-count").value, 10) || 3;
  match.recordVisit({ score, dartsCount, doubleAttempts: selectedDoubleAttempts, bust: isBust });

  const numInput = document.getElementById("input-numeric-score");
  numInput.value = "";
  selectedDoubleAttempts = 0;
  document.querySelectorAll(".double-count-btn").forEach((b, idx) => {
    if (idx === 0) b.classList.add("selected");
    else b.classList.remove("selected");
  });
  document.getElementById("numeric-darts-count").value = "3";
  App.renderScorer();

  const bullDue = match.bullOffAfterRounds > 0 &&
    match.currentLeg.visits[0].length >= match.bullOffAfterRounds &&
    match.currentLeg.visits[1].length >= match.bullOffAfterRounds;
  if (!match.isFinished && !bullDue) {
    numInput.focus();
  } else {
    numInput.blur();
  }
};

App.setMultiplier = function(mult) {
  App.currentMultiplier = mult;
  const multSingle = document.getElementById("mult-single");
  const multDouble = document.getElementById("mult-double");
  const multTriple = document.getElementById("mult-triple");
  [multSingle, multDouble, multTriple].forEach(b => b.classList.remove("active"));
  if (mult === 1) multSingle.classList.add("active");
  else if (mult === 2) multDouble.classList.add("active");
  else if (mult === 3) multTriple.classList.add("active");
};

App.getKeypadPreviewState = function() {
  const match = App.activeMatch;
  if (!match || !match.currentLeg) return { ended: false, bust: false, won: false };
  let running = match.currentLeg.scores[match.currentTurn];
  for (let i = 0; i < App.keypadDarts.length; i++) {
    const d = App.keypadDarts[i];
    const next = running - d.score;
    if (match.doubleOut) {
      if (next < 0 || next === 1 || (next === 0 && !d.isDouble)) return { ended: true, bust: true, won: false };
      if (next === 0 && d.isDouble) return { ended: true, bust: false, won: true };
    } else {
      if (next < 0) return { ended: true, bust: true, won: false };
      if (next === 0) return { ended: true, bust: false, won: true };
    }
    running = next;
  }
  return { ended: false, bust: false, won: false };
};

App.handleDartInput = function(target) {
  if (App.keypadDarts.length >= 3) return;
  if (App.getKeypadPreviewState().ended) return;

  let mult = App.currentMultiplier;
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

  App.keypadDarts.push({ target, multiplier: mult, score, isDouble, label });
  App.setMultiplier(1);
  App.updateKeypadSlots();
};

App.updateKeypadSlots = function() {
  const preview = App.getKeypadPreviewState();
  for (let i = 1; i <= 3; i++) {
    const slot = document.getElementById(`slot-${i}`);
    const val = document.getElementById(`slot-val-${i}`);
    const dart = App.keypadDarts[i - 1];
    if (dart) {
      val.textContent = dart.label;
      slot.classList.remove("active");
    } else {
      val.textContent = "-";
      if (!preview.ended && i === App.keypadDarts.length + 1) slot.classList.add("active");
      else slot.classList.remove("active");
    }
  }
  const total = App.keypadDarts.reduce((acc, d) => acc + d.score, 0);
  const totalEl = document.getElementById("keypad-visit-total");
  if (preview.bust) totalEl.textContent = "BUST (0)";
  else if (preview.won) totalEl.textContent = `${total} (CHECKOUT!)`;
  else totalEl.textContent = total;
};

App.resetKeypad = function() {
  App.keypadDarts = [];
  App.setMultiplier(1);
  App.updateKeypadSlots();
};

App.initKeypad = function() {
  const tabNum = document.getElementById("tab-mode-numeric");
  const tabKey = document.getElementById("tab-mode-keypad");
  const wrapNum = document.getElementById("mode-numeric-wrap");
  const wrapKey = document.getElementById("mode-keypad-wrap");

  tabNum.addEventListener("click", () => {
    tabNum.classList.add("active"); tabKey.classList.remove("active");
    wrapNum.style.display = "flex"; wrapKey.style.display = "none";
    document.getElementById("input-numeric-score").focus();
  });

  tabKey.addEventListener("click", () => {
    tabKey.classList.add("active"); tabNum.classList.remove("active");
    wrapNum.style.display = "none"; wrapKey.style.display = "flex";
    App.updateKeypadSlots();
  });

  for (let i = 1; i <= 3; i++) {
    const slotEl = document.getElementById(`slot-${i}`);
    if (slotEl) {
      slotEl.style.cursor = "pointer";
      slotEl.title = "Click to remove dart";
      slotEl.addEventListener("click", () => {
        if (App.keypadDarts.length >= i) {
          App.keypadDarts.splice(i - 1);
          App.updateKeypadSlots();
        }
      });
    }
  }

  const numInput = document.getElementById("input-numeric-score");
  document.querySelectorAll(".double-count-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".double-count-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedDoubleAttempts = parseInt(btn.dataset.count, 10);
    });
  });

  document.getElementById("btn-submit-numeric").addEventListener("click", () => App.submitNumericScore(numInput.value));
  numInput.addEventListener("keydown", (e) => { if (e.key === "Enter") App.submitNumericScore(numInput.value); });
  document.getElementById("btn-bust-numeric").addEventListener("click", () => App.submitNumericScore(0, true));

  document.querySelectorAll(".common-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      numInput.value = btn.dataset.score;
      App.submitNumericScore(btn.dataset.score);
    });
  });

  const targets = document.getElementById("keypad-targets");
  targets.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= 20; i++) {
    const btn = document.createElement("button");
    btn.className = "target-btn";
    btn.textContent = i;
    btn.addEventListener("click", () => App.handleDartInput(i));
    frag.appendChild(btn);
  }
  const miss = document.createElement("button");
  miss.className = "target-btn";
  miss.textContent = "Miss (0)";
  miss.addEventListener("click", () => App.handleDartInput(0));
  frag.appendChild(miss);

  const bull = document.createElement("button");
  bull.className = "target-btn bull";
  bull.textContent = "25";
  bull.addEventListener("click", () => App.handleDartInput(25));
  frag.appendChild(bull);

  const dbull = document.createElement("button");
  dbull.className = "target-btn d-bull";
  dbull.textContent = "Bull (50)";
  dbull.addEventListener("click", () => App.handleDartInput(50));
  frag.appendChild(dbull);
  targets.appendChild(frag);

  document.getElementById("mult-single").addEventListener("click", () => App.setMultiplier(1));
  document.getElementById("mult-double").addEventListener("click", () => App.setMultiplier(2));
  document.getElementById("mult-triple").addEventListener("click", () => App.setMultiplier(3));

  document.getElementById("btn-clear-keypad-darts").addEventListener("click", App.resetKeypad);
  document.getElementById("btn-submit-keypad-visit").addEventListener("click", () => {
    const match = App.activeMatch;
    if (App.keypadDarts.length === 0 || !match || match.isFinished) return;
    if (match.bullOffAfterRounds > 0 &&
        match.currentLeg.visits[0].length >= match.bullOffAfterRounds &&
        match.currentLeg.visits[1].length >= match.bullOffAfterRounds) {
      App.openBullOffModal();
      return;
    }
    const total = App.keypadDarts.reduce((acc, d) => acc + d.score, 0);
    const doubleAttempts = App.keypadDarts.filter(d => d.isDouble).length;
    match.recordVisit({ score: total, dartsCount: App.keypadDarts.length, doubleAttempts, dartBreakdown: [...App.keypadDarts] });
    App.resetKeypad();
    App.renderScorer();
  });
};
