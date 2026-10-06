class DartsMatch {
      constructor(config = {}) {
        this.id = config.id || `match_${Date.now()}`;
        this.player1 = config.player1 || "Player 1";
        this.player2 = config.player2 || "Player 2";
        this.startingScore = config.startingScore || 501;
        this.legsToWin = config.legsToWin || 3;
        this.maxLegs = config.maxLegs || 0;
        this.doubleOut = config.doubleOut !== false;
        this.trackDoubles = config.trackDoubles !== false;
        this.bullOffAfterRounds = parseInt(config.bullOffAfterRounds, 10) || 0;
        this.startingPlayer = (config.startingPlayer === 1 || config.startingPlayer === "1") ? 1 : 0;

        this.legsP1 = 0;
        this.legsP2 = 0;
        this.currentLegIndex = 1;
        this.currentTurn = this.startingPlayer;
        this.legs = [];
        this.history = [];
        this.isFinished = false;
        this.winner = null;

        this.initLeg();
      }

      initLeg() {
        const legStarter = (this.currentLegIndex % 2 === 1) ? this.startingPlayer : (1 - this.startingPlayer);
        this.currentTurn = legStarter;
        this.currentLeg = {
          legIndex: this.currentLegIndex,
          starter: legStarter,
          scores: [this.startingScore, this.startingScore],
          visits: [[], []],
          winner: null
        };
      }

      setStartingPlayer(playerIndex) {
        if (this.history.length > 0) return false;
        this.startingPlayer = playerIndex === 1 ? 1 : 0;
        this.currentLegIndex = 1;
        this.initLeg();
        return true;
      }

      getSuggestedCheckout(playerIndex) {
        const score = this.currentLeg.scores[playerIndex];
        return getCheckout(score, this.doubleOut);
      }

      recordVisit({ score, dartsCount = 3, doubleAttempts = 0, dartBreakdown = null }) {
        if (this.isFinished) return;
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
                  // Reached 0 on single/triple in double out = BUST
                  isBust = true;
                  break;
                }
              } else {
                running = next;
              }
            } else {
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
              // Valid checkout must be in CHECKOUT_TABLE (<=170 and not a bogey number)
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
          this.currentTurn = 1 - this.currentTurn;
        }

        this.history.push(historyEntry);
      }

      getCurrentRound() {
        if (!this.currentLeg) return 1;
        const v1 = this.currentLeg.visits[0].length;
        const v2 = this.currentLeg.visits[1].length;
        return Math.min(v1, v2) + 1;
      }

      resolveBullOff(winnerIndex, decideEntireMatch = false) {
        if (this.isFinished) return false;
        this.currentLeg.winner = winnerIndex;
        this.currentLeg.decidedBy = "bull_off";

        if (decideEntireMatch) {
          if (winnerIndex === 0) {
            this.legsP1 = Math.max(this.legsP1 + 1, this.legsToWin);
            this.winner = this.player1;
          } else {
            this.legsP2 = Math.max(this.legsP2 + 1, this.legsToWin);
            this.winner = this.player2;
          }
          this.isFinished = true;
          this.legs.push(JSON.parse(JSON.stringify(this.currentLeg)));
          this.history.push({
            type: "bull_off",
            legIndex: this.currentLegIndex,
            turn: winnerIndex,
            winner: winnerIndex,
            legWon: true,
            matchWon: true
          });
          return { success: true, isFinished: true, winner: this.winner };
        }

        if (winnerIndex === 0) this.legsP1++;
        else this.legsP2++;

        this.legs.push(JSON.parse(JSON.stringify(this.currentLeg)));

        const wonByLegs = (this.legsP1 >= this.legsToWin || this.legsP2 >= this.legsToWin);
        const totalLegsPlayed = this.legsP1 + this.legsP2;
        const reachedMaxLegs = this.maxLegs > 0 && totalLegsPlayed >= this.maxLegs;

        const historyEntry = {
          type: "bull_off",
          legIndex: this.currentLegIndex,
          turn: winnerIndex,
          winner: winnerIndex,
          legWon: true,
          matchWon: false
        };

        if (wonByLegs || reachedMaxLegs) {
          this.isFinished = true;
          if (this.legsP1 > this.legsP2) this.winner = this.player1;
          else if (this.legsP2 > this.legsP1) this.winner = this.player2;
          else {
            // Bull-off tiebreaker resolves winner
            this.winner = winnerIndex === 0 ? this.player1 : this.player2;
          }
          historyEntry.matchWon = true;
        } else {
          this.currentLegIndex++;
          this.initLeg();
        }

        this.history.push(historyEntry);
        return { success: true, isFinished: this.isFinished, winner: this.winner };
      }

      undo() {
        if (this.history.length === 0) return false;
        const lastAction = this.history.pop();

        if (lastAction.matchWon) {
          this.isFinished = false;
          this.winner = null;
        }

        if (lastAction.type === "bull_off") {
          const restoredLeg = this.legs.pop();
          if (lastAction.winner === 0) this.legsP1--;
          else this.legsP2--;

          this.currentLegIndex = restoredLeg.legIndex;
          this.currentLeg = restoredLeg;
          this.currentLeg.winner = null;
          this.currentLeg.decidedBy = null;
          const v1 = this.currentLeg.visits[0].length;
          const v2 = this.currentLeg.visits[1].length;
          this.currentTurn = (v1 === v2) ? this.currentLeg.starter : (v1 > v2 ? 1 : 0);
          return true;
        }

        if (lastAction.legWon) {
          const restoredLeg = this.legs.pop();
          if (lastAction.turn === 0) this.legsP1--;
          else this.legsP2--;

          this.currentLegIndex = restoredLeg.legIndex;
          this.currentLeg = restoredLeg;
          this.currentLeg.winner = null;
          this.currentLeg.visits[lastAction.turn].pop();
          this.currentLeg.scores[lastAction.turn] = lastAction.visit.scoreBefore;
          this.currentTurn = lastAction.turn;
        } else {
          const pIdx = lastAction.turn;
          this.currentLeg.visits[pIdx].pop();
          this.currentLeg.scores[pIdx] = lastAction.visit.scoreBefore;
          this.currentTurn = pIdx;
        }
        return true;
      }

      getPlayerStats(pIdx) {
        const name = pIdx === 0 ? this.player1 : this.player2;
        let totalScore = 0, totalDarts = 0, doubleAttempts = 0, doubleHits = 0;
        let count180 = 0, count140 = 0, count100 = 0, count60 = 0, highestCheckout = 0;

        const allLegs = [...this.legs];
        if (!this.isFinished && this.currentLeg) allLegs.push(this.currentLeg);

        allLegs.forEach(leg => {
          (leg.visits[pIdx] || []).forEach(v => {
            const sc = v.bust ? 0 : v.score;
            totalScore += sc;
            totalDarts += v.dartsCount;
            doubleAttempts += (v.doubleAttempts || 0);
            doubleHits += (v.doubleHit || 0);

            if (v.score === 180) count180++;
            else if (v.score >= 140) count140++;
            else if (v.score >= 100) count100++;
            else if (v.score >= 60) count60++;

            if (v.doubleHit && v.score > highestCheckout) highestCheckout = v.score;
          });
        });

        const threeDartAvg = totalDarts > 0 ? (totalScore / totalDarts) * 3 : 0;
        const checkoutPct = doubleAttempts > 0 ? (doubleHits / doubleAttempts) * 100 : 0;

        return {
          name,
          legsWon: pIdx === 0 ? this.legsP1 : this.legsP2,
          legsLost: pIdx === 0 ? this.legsP2 : this.legsP1,
          threeDartAvg: Number(threeDartAvg.toFixed(2)),
          doubleAttempts,
          doubleHits,
          checkoutPct: Number(checkoutPct.toFixed(1)),
          highestCheckout,
          count180, count140, count100, count60,
          totalDarts, totalScore
        };
      }

      getStatePayload() {
        return {
          id: this.id,
          player1: this.player1,
          player2: this.player2,
          startingPlayer: this.startingPlayer,
          legStarter: this.currentLeg ? this.currentLeg.starter : this.startingPlayer,
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
          bullOffAfterRounds: this.bullOffAfterRounds,
          currentRound: this.getCurrentRound(),
          isBullOffDue: (this.bullOffAfterRounds > 0 && !this.isFinished &&
                         this.currentLeg.visits[0].length >= this.bullOffAfterRounds &&
                         this.currentLeg.visits[1].length >= this.bullOffAfterRounds),
          lastVisit: this.history.length > 0 ? this.history[this.history.length - 1].visit : null
        };
      }
    }

    window.DartsMatch = DartsMatch;
