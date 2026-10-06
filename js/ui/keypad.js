// Keypad and score input controller
window.App = window.App || {};

App.keypadDarts = [];
App.currentMultiplier = 1;
let selectedDoubleAttempts = 0;

App.submitNumericScore = function(val, isBust = false) {
  const match = App.activeMatch;
  if (!match || match.isFinished) return;
  const score = isBust ? 0 : parseInt(val, 10);
  if (isNaN(score) || score < 0 || score > 180) {
    alert("Score must be between 0 and 180");
    return;
  }

  const pIdx = match.currentTurn;
  const currentScore = match.currentLeg.scores[pIdx];
  if (match.doubleOut && !isBust && (currentScore - score === 0) && !isFinishPossible(currentScore, true)) {
    alert(`Bust! Cannot checkout from ${currentScore} on Double Out (maximum finish is 170).`);
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
  numInput.focus();
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

App.handleDartInput = function(target) {
  if (App.keypadDarts.length >= 3) return;
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
  for (let i = 1; i <= 3; i++) {
    const slot = document.getElementById(`slot-${i}`);
    const val = document.getElementById(`slot-val-${i}`);
    const dart = App.keypadDarts[i - 1];
    if (dart) { val.textContent = dart.label; slot.classList.remove("active"); }
    else {
      val.textContent = "-";
      if (i === App.keypadDarts.length + 1) slot.classList.add("active");
      else slot.classList.remove("active");
    }
  }
  const total = App.keypadDarts.reduce((acc, d) => acc + d.score, 0);
  document.getElementById("keypad-visit-total").textContent = total;
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
  });

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
  for (let i = 1; i <= 20; i++) {
    const btn = document.createElement("button");
    btn.className = "target-btn";
    btn.textContent = i;
    btn.addEventListener("click", () => App.handleDartInput(i));
    targets.appendChild(btn);
  }
  const miss = document.createElement("button");
  miss.className = "target-btn";
  miss.textContent = "Miss (0)";
  miss.addEventListener("click", () => App.handleDartInput(0));
  targets.appendChild(miss);

  const bull = document.createElement("button");
  bull.className = "target-btn bull";
  bull.textContent = "25";
  bull.addEventListener("click", () => App.handleDartInput(25));
  targets.appendChild(bull);

  const dbull = document.createElement("button");
  dbull.className = "target-btn d-bull";
  dbull.textContent = "Bull (50)";
  dbull.addEventListener("click", () => App.handleDartInput(50));
  targets.appendChild(dbull);

  document.getElementById("mult-single").addEventListener("click", () => App.setMultiplier(1));
  document.getElementById("mult-double").addEventListener("click", () => App.setMultiplier(2));
  document.getElementById("mult-triple").addEventListener("click", () => App.setMultiplier(3));

  document.getElementById("btn-clear-keypad-darts").addEventListener("click", App.resetKeypad);
  document.getElementById("btn-submit-keypad-visit").addEventListener("click", () => {
    if (App.keypadDarts.length === 0 || !App.activeMatch) return;
    const total = App.keypadDarts.reduce((acc, d) => acc + d.score, 0);
    const doubleAttempts = App.keypadDarts.filter(d => d.isDouble).length;
    App.activeMatch.recordVisit({ score: total, dartsCount: App.keypadDarts.length, doubleAttempts, dartBreakdown: [...App.keypadDarts] });
    App.resetKeypad();
    App.renderScorer();
  });
};
