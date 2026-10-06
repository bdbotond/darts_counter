// Darts Engine: rules, checkout paths, visit processing, and statistics
export const CHECKOUT_TABLE = {
  170: "T20 T20 Bull", 167: "T20 T19 Bull", 164: "T20 T18 Bull", 161: "T20 T17 Bull", 160: "T20 T20 D20",
  158: "T20 T20 D19", 157: "T20 T19 D20", 156: "T20 T20 D18", 155: "T20 T19 D19", 154: "T20 T18 D20",
  153: "T20 T19 D18", 152: "T20 T20 D16", 151: "T20 T17 D20", 150: "T20 T18 D18", 149: "T20 T19 D16",
  148: "T20 T16 D20", 147: "T20 T17 D18", 146: "T20 T18 D16", 145: "T20 T15 D20", 144: "T20 T20 D12",
  143: "T20 T17 D16", 142: "T20 T14 D20", 141: "T20 T15 D18", 140: "T20 T20 D10", 139: "T20 T13 D20",
  138: "T20 T18 D12", 137: "T20 T19 D10", 136: "T20 T20 D8",  135: "T20 T15 D15", 134: "T20 T14 D16",
  133: "T20 T19 D8",  132: "T20 T16 D12", 131: "T20 T13 D16", 130: "T20 T18 D8",  129: "T19 T16 D12",
  128: "T18 T14 D16", 127: "T20 T17 D8",  126: "T19 T19 D6",  125: "25 T20 D20",  124: "T20 T16 D8",
  123: "T19 T16 D9",  122: "T18 T18 D7",  121: "T20 T11 D14", 120: "T20 20 D20",   119: "T19 T10 D16",
  118: "T20 18 D20",  117: "T20 17 D20",  116: "T20 16 D20",  115: "T20 15 D20",  114: "T20 14 D20",
  113: "T20 13 D20",  112: "T20 20 D16",  111: "T20 19 D16",  110: "T20 18 D16",  109: "T20 17 D16",
  108: "T20 16 D16",  107: "T19 18 D16",  106: "T20 14 D16",  105: "T20 13 D16",  104: "T18 18 D16",
  103: "T20 11 D16",  102: "T20 10 D16",  101: "T17 18 D16",  100: "T20 D20",     99: "T19 10 D16",
  98: "T20 D19",      97: "T19 D20",      96: "T20 D18",      95: "T19 D19",      94: "T18 D20",
  93: "T19 D18",      92: "T20 D16",      91: "T17 D20",      90: "T20 D15",      89: "T19 D16",
  88: "T16 D20",      87: "T17 D18",      86: "T18 D16",      85: "T15 D20",      84: "T20 D12",
  83: "T17 D16",      82: "T14 D20",      81: "T15 D18",      80: "T20 D10",      79: "T19 D11",
  78: "T18 D12",      77: "T19 D10",      76: "T20 D8",       75: "T17 D12",      74: "T14 D16",
  73: "T19 D8",       72: "T16 D12",      71: "T13 D16",      70: "T18 D8",       69: "T15 D12",
  68: "T16 D10",      67: "T17 D8",       66: "T14 D12",      65: "25 D20",       64: "T16 D8",
  63: "T13 D12",      62: "T10 D16",      61: "T15 D8",       60: "20 D20",       59: "19 D20",
  58: "18 D20",       57: "17 D20",       56: "16 D20",       55: "15 D20",       54: "14 D20",
  53: "13 D20",       52: "12 D20",       51: "11 D20",       50: "Bull",         49: "9 D20",
  48: "16 D16",       47: "15 D16",       46: "14 D16",       45: "13 D16",       44: "12 D16",
  43: "11 D16",       42: "10 D16",       41: "9 D16",        40: "D20",          39: "7 D16",
  38: "D19",          37: "5 D16",        36: "D18",          35: "3 D16",        34: "D17",
  33: "1 D16",        32: "D16",          31: "15 D8",        30: "D15",          29: "13 D8",
  28: "D14",          27: "11 D8",        26: "D13",          25: "9 D8",         24: "D12",
  23: "7 D8",         22: "D11",          21: "5 D8",         20: "D10",          19: "3 D8",
  18: "D9",           17: "1 D8",         16: "D8",           15: "7 D4",         14: "D7",
  13: "5 D4",         12: "D6",           11: "3 D4",         10: "D5",           9: "1 D4",
  8: "D4",            7: "3 D2",          6: "D3",            5: "1 D2",          4: "D2",
  3: "1 D1",          2: "D1"
};

export function getCheckout(score, doubleOut = true) {
  if (!doubleOut) {
    if (score <= 20) return `${score}`;
    if (score === 50) return "Bull";
    if (score <= 40 && score % 2 === 0) return `D${score / 2}`;
    if (score <= 60 && score % 3 === 0) return `T${score / 3}`;
  }
  return CHECKOUT_TABLE[score] || "";
}

export function isFinishPossible(score, doubleOut = true) {
  if (doubleOut) return score <= 170 && !!CHECKOUT_TABLE[score];
  return score <= 180;
}

export class DartsMatch {
  constructor(config = {}) {
    this.id = config.id || `match_${Date.now()}`;
    this.player1 = config.player1 || "Player 1";
    this.player2 = config.player2 || "Player 2";
    this.startingScore = config.startingScore || 501;
    this.legsToWin = config.legsToWin || 3;
    this.maxLegs = config.maxLegs || 0; // 0 = first to legsToWin, >0 = max legs
    this.doubleOut = config.doubleOut !== false;
    this.trackDoubles = config.trackDoubles !== false;

    this.legsP1 = 0;
    this.legsP2 = 0;
    this.currentLegIndex = 1;
    this.starterP1 = true; // Player 1 starts leg 1, alternates
    this.currentTurn = 0; // 0 = P1, 1 = P2

    this.legs = [];
    this.history = []; // stack of actions for undo
    this.isFinished = false;
    this.winner = null;

    this.initLeg();
  }

  initLeg() {
    const legStarter = (this.currentLegIndex % 2 === 1) ? 0 : 1;
    this.currentTurn = legStarter;
    this.currentLeg = {
      legIndex: this.currentLegIndex,
      starter: legStarter,
      scores: [this.startingScore, this.startingScore],
      visits: [[], []], // visits per player: [{score, dartsCount, doubleAttempts, doubleHit, bust, scoreLeft}]
      winner: null
    };
  }

  getCurrentPlayerName() {
    return this.currentTurn === 0 ? this.player1 : this.player2;
  }

  getCurrentScore() {
    return this.currentLeg.scores[this.currentTurn];
  }

  getSuggestedCheckout(playerIndex) {
    const score = this.currentLeg.scores[playerIndex];
    return getCheckout(score, this.doubleOut);
  }

  recordVisit({ score, dartsCount = 3, doubleAttempts = 0, dartBreakdown = null }) {
    if (this.isFinished) return { error: "Match already finished" };

    const pIdx = this.currentTurn;
    const currentScore = this.currentLeg.scores[pIdx];
    let isBust = false;
    let isWon = false;
    let actualDoubleAttempts = Number(doubleAttempts) || 0;
    let actualDoubleHit = 0;
    let finalDartsCount = Math.min(Math.max(dartsCount, 1), 3);
    let finalScoreLeft = currentScore;
    let visitScore = score;

    if (dartBreakdown && dartBreakdown.length > 0) {
      // Dart-by-dart exact verification (keypad mode)
      let running = currentScore;
      let thrown = 0;
      let totalPts = 0;

      for (let i = 0; i < dartBreakdown.length; i++) {
        const d = dartBreakdown[i];
        thrown++;
        totalPts += d.score;
        const next = running - d.score;

        if (this.doubleOut) {
          if (next < 0 || next === 1) {
            isBust = true;
            break;
          } else if (next === 0) {
            if (d.isDouble) {
              isWon = true;
              actualDoubleHit = 1;
              running = 0;
              break;
            } else {
              // Reached 0 without a double = BUST in double out
              isBust = true;
              break;
            }
          } else {
            running = next;
          }
        } else {
          // Single out
          if (next < 0) {
            isBust = true;
            break;
          } else if (next === 0) {
            isWon = true;
            running = 0;
            break;
          } else {
            running = next;
          }
        }
      }

      finalDartsCount = thrown;
      if (isBust) {
        finalScoreLeft = currentScore;
        visitScore = 0;
      } else {
        finalScoreLeft = running;
        visitScore = totalPts;
      }
    } else {
      // Numeric visit input
      const remaining = currentScore - score;

      if (this.doubleOut) {
        if (remaining < 0 || remaining === 1) {
          isBust = true;
        } else if (remaining === 0) {
          // In Double Out, checkout is only possible if currentScore has a valid double finish (<=170 and not a bogey number)
          if (CHECKOUT_TABLE[currentScore]) {
            isWon = true;
            actualDoubleHit = 1;
            if (actualDoubleAttempts === 0) actualDoubleAttempts = 1;
          } else {
            // Impossible checkout from 180, 169, 168, etc. -> BUST
            isBust = true;
          }
        }
      } else {
        if (remaining < 0) {
          isBust = true;
        } else if (remaining === 0) {
          isWon = true;
        }
      }

      finalScoreLeft = isBust ? currentScore : remaining;
      visitScore = isBust ? 0 : score;
    }

    this.currentLeg.scores[pIdx] = finalScoreLeft;

    const visitRecord = {
      playerIndex: pIdx,
      score: visitScore,
      enteredScore: score,
      dartsCount: finalDartsCount,
      doubleAttempts: actualDoubleAttempts,
      doubleHit: actualDoubleHit,
      bust: isBust,
      scoreBefore: currentScore,
      scoreLeft: finalScoreLeft,
      dartBreakdown
    };

    this.currentLeg.visits[pIdx].push(visitRecord);

    const historyEntry = {
      type: "visit",
      legIndex: this.currentLegIndex,
      turn: pIdx,
      visit: visitRecord,
      legWon: isWon,
      matchWon: false
    };

    if (isWon) {
      this.currentLeg.winner = pIdx;
      if (pIdx === 0) this.legsP1++;
      else this.legsP2++;

      this.legs.push(JSON.parse(JSON.stringify(this.currentLeg)));

      // Check match win condition
      const wonByLegs = (this.legsP1 >= this.legsToWin || this.legsP2 >= this.legsToWin);
      const totalLegsPlayed = this.legsP1 + this.legsP2;
      const reachedMaxLegs = this.maxLegs > 0 && totalLegsPlayed >= this.maxLegs;

      if (wonByLegs || reachedMaxLegs) {
        this.isFinished = true;
        if (this.legsP1 > this.legsP2) this.winner = this.player1;
        else if (this.legsP2 > this.legsP1) this.winner = this.player2;
        else this.winner = "Draw";
        historyEntry.matchWon = true;
      } else {
        this.currentLegIndex++;
        this.initLeg();
      }
    } else {
      // Alternate turn
      this.currentTurn = 1 - this.currentTurn;
    }

    this.history.push(historyEntry);
    return { success: true, visit: visitRecord, isWon, isFinished: this.isFinished };
  }

  undo() {
    if (this.history.length === 0) return false;
    const lastAction = this.history.pop();

    if (lastAction.matchWon) {
      this.isFinished = false;
      this.winner = null;
    }

    if (lastAction.legWon) {
      // Restore previous leg
      const restoredLeg = this.legs.pop();
      if (lastAction.turn === 0) this.legsP1--;
      else this.legsP2--;

      this.currentLegIndex = restoredLeg.legIndex;
      this.currentLeg = restoredLeg;
      this.currentLeg.winner = null;
      // Remove winning visit
      this.currentLeg.visits[lastAction.turn].pop();
      this.currentLeg.scores[lastAction.turn] = lastAction.visit.scoreBefore;
      this.currentTurn = lastAction.turn;
    } else {
      // Regular visit undo
      const pIdx = lastAction.turn;
      this.currentLeg.visits[pIdx].pop();
      this.currentLeg.scores[pIdx] = lastAction.visit.scoreBefore;
      this.currentTurn = pIdx;
    }

    return true;
  }

  getPlayerStats(pIdx) {
    const name = pIdx === 0 ? this.player1 : this.player2;
    let totalScore = 0;
    let totalDarts = 0;
    let first9Score = 0;
    let first9Darts = 0;
    let doubleAttempts = 0;
    let doubleHits = 0;
    let count180 = 0;
    let count140 = 0;
    let count100 = 0;
    let count60 = 0;
    let highestCheckout = 0;

    const allLegs = [...this.legs];
    if (!this.isFinished && this.currentLeg) {
      allLegs.push(this.currentLeg);
    }

    allLegs.forEach(leg => {
      const visits = leg.visits[pIdx] || [];
      let legDarts = 0;
      visits.forEach(v => {
        const sc = v.bust ? 0 : v.score;
        totalScore += sc;
        totalDarts += v.dartsCount;

        if (legDarts < 9) {
          first9Score += sc;
          first9Darts += v.dartsCount;
        }
        legDarts += v.dartsCount;

        doubleAttempts += (v.doubleAttempts || 0);
        doubleHits += (v.doubleHit || 0);

        if (v.score === 180) count180++;
        else if (v.score >= 140) count140++;
        else if (v.score >= 100) count100++;
        else if (v.score >= 60) count60++;

        if (v.doubleHit && v.score > highestCheckout) {
          highestCheckout = v.score;
        }
      });
    });

    const threeDartAvg = totalDarts > 0 ? (totalScore / totalDarts) * 3 : 0;
    const first9Avg = first9Darts > 0 ? (first9Score / first9Darts) * 3 : 0;
    const checkoutPct = doubleAttempts > 0 ? (doubleHits / doubleAttempts) * 100 : 0;
    const legsWon = pIdx === 0 ? this.legsP1 : this.legsP2;
    const legsLost = pIdx === 0 ? this.legsP2 : this.legsP1;

    return {
      name,
      legsWon,
      legsLost,
      threeDartAvg: Number(threeDartAvg.toFixed(2)),
      first9Avg: Number(first9Avg.toFixed(2)),
      doubleAttempts,
      doubleHits,
      checkoutPct: Number(checkoutPct.toFixed(1)),
      highestCheckout,
      count180,
      count140,
      count100,
      count60,
      totalDarts,
      totalScore
    };
  }

  getStatePayload() {
    return {
      id: this.id,
      player1: this.player1,
      player2: this.player2,
      legsP1: this.legsP1,
      legsP2: this.legsP2,
      legsToWin: this.legsToWin,
      maxLegs: this.maxLegs,
      doubleOut: this.doubleOut,
      trackDoubles: this.trackDoubles,
      currentTurn: this.currentTurn,
      currentLegIndex: this.currentLegIndex,
      scores: [...this.currentLeg.scores],
      p1Checkout: this.getSuggestedCheckout(0),
      p2Checkout: this.getSuggestedCheckout(1),
      p1Stats: this.getPlayerStats(0),
      p2Stats: this.getPlayerStats(1),
      isFinished: this.isFinished,
      winner: this.winner,
      lastVisit: this.history.length > 0 ? this.history[this.history.length - 1].visit : null
    };
  }
}
