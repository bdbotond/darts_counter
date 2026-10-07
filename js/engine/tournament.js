    // --- 3. TOURNAMENT CLASS ---
    class Tournament {
      constructor(config = {}) {
        this.id = config.id || `tourney_${Date.now()}`;
        this.name = config.name || "Darts Tournament";
        this.format = config.format || "groups";
        this.players = config.players ? [...config.players] : [];
        this.groupCount = config.groupCount || 2;
        this.advancePerGroup = config.advancePerGroup || 2;
        this.matchSettings = {
          startingScore: config.startingScore || 501,
          legsToWin: config.legsToWin || 3,
          maxLegs: config.maxLegs || 0,
          doubleOut: config.doubleOut !== false,
          trackDoubles: config.trackDoubles !== false,
          bullOffAfterRounds: parseInt(config.bullOffAfterRounds, 10) || 0
        };
        this.repechageConfig = config.repechageConfig || {
          enabled: false,
          fromRound: 0,
          toRound: 0,
          reEntryRound: 1
        };
        this.enableBronzeMatch = config.enableBronzeMatch !== false;
        this.seedBracket = config.seedBracket;
        this.groups = [];
        this.knockoutRounds = [];
        this.repechageRounds = [];
        this.bronzeMatch = null;
        this.matchStatsRegistry = {};
        this.status = "setup";
      }

      start() {
        if (this.players.length < 2) return false;
        if (this.format === "groups") {
          this.initGroups();
          this.status = "groups";
        } else {
          this.initDirectKnockout();
          this.status = "knockout";
        }
        return true;
      }

      initGroups() {
        const numGroups = Math.max(1, Math.min(this.groupCount, Math.floor(this.players.length / 2)));
        this.groups = [];
        const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        for (let i = 0; i < numGroups; i++) {
          this.groups.push({
            id: labels[i],
            name: `Group ${labels[i]}`,
            players: [],
            matches: [],
            standings: []
          });
        }

        this.players.forEach((player, idx) => {
          this.groups[idx % numGroups].players.push(player);
        });

        this.groups.forEach(group => {
          const plist = group.players;
          let mIdx = 1;
          for (let i = 0; i < plist.length; i++) {
            for (let j = i + 1; j < plist.length; j++) {
              group.matches.push({
                id: `g_${group.id}_m${mIdx++}`,
                groupId: group.id,
                stage: "group",
                stageName: group.name,
                player1: plist[i],
                player2: plist[j],
                legsP1: 0,
                legsP2: 0,
                winner: null,
                isFinished: false
              });
            }
          }
          this.updateGroupStandings(group);
        });
      }

      updateGroupStandings(group) {
        const table = {};
        group.players.forEach(p => {
          table[p] = { player: p, played: 0, won: 0, lost: 0, legsFor: 0, legsAgainst: 0, legDiff: 0, diff: 0, points: 0 };
        });

        group.matches.forEach(m => {
          if (m.isFinished) {
            const s1 = table[m.player1];
            const s2 = table[m.player2];
            if (s1 && s2) {
              s1.played++; s2.played++;
              s1.legsFor += m.legsP1; s1.legsAgainst += m.legsP2;
              s2.legsFor += m.legsP2; s2.legsAgainst += m.legsP1;

              if (m.winner === m.player1) { s1.won++; s1.points += 2; s2.lost++; }
              else if (m.winner === m.player2) { s2.won++; s2.points += 2; s1.lost++; }
              else { s1.points += 1; s2.points += 1; }

              s1.legDiff = s1.legsFor - s1.legsAgainst;
              s1.diff = s1.legDiff;
              s2.legDiff = s2.legsFor - s2.legsAgainst;
              s2.diff = s2.legDiff;
            }
          }
        });

        group.standings = Object.values(table).sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.legDiff !== a.legDiff) return b.legDiff - a.legDiff;
          return b.legsFor - a.legsFor;
        });
      }

      getGroupStandings(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        return group ? group.standings : [];
      }

      advanceFromGroupsToKnockout() {
        return this.generateKnockoutFromGroups();
      }

      generateKnockoutFromGroups() {
        const qualified = [];
        const advance = Math.max(1, this.advancePerGroup);

        if (this.groups.length === 2 && advance >= 1) {
          const gA = this.groups[0].standings;
          const gB = this.groups[1].standings;
          if (advance === 1) {
            qualified.push(gA[0]?.player || "A1", gB[0]?.player || "B1");
          } else if (advance === 2) {
            qualified.push(gA[0]?.player, gB[1]?.player, gB[0]?.player, gA[1]?.player);
          } else {
            for (let i = 0; i < advance; i++) {
              if (gA[i]) qualified.push(gA[i].player);
              if (gB[i]) qualified.push(gB[i].player);
            }
          }
        } else {
          this.groups.forEach(g => {
            for (let i = 0; i < advance; i++) {
              if (g.standings[i]) qualified.push(g.standings[i].player);
            }
          });
        }

        this.createBracket(qualified.filter(Boolean), false);
        this.status = "knockout";
      }

      initDirectKnockout() {
        this.createBracket([...this.players]);
      }

      static getBracketSeedOrder(size) {
        let order = [1, 2];
        while (order.length < size) {
          const nextOrder = [];
          const sum = order.length * 2 + 1;
          for (const seed of order) {
            nextOrder.push(seed);
            nextOrder.push(sum - seed);
          }
          order = nextOrder;
        }
        return order;
      }

      createBracket(playerList, seedOverride = undefined) {
        let size = 2;
        while (size < playerList.length) size *= 2;
        const repEnabled = Boolean(this.repechageConfig && this.repechageConfig.enabled && playerList.length >= 3);
        if (size < 4 && repEnabled) size = 4;

        const shouldSeed = (seedOverride !== undefined) ? Boolean(seedOverride) : ((this.seedBracket !== undefined) ? Boolean(this.seedBracket) : (playerList.length < size));
        let bracketPlayers;
        if (shouldSeed) {
          const seedOrder = Tournament.getBracketSeedOrder(size);
          bracketPlayers = seedOrder.map(s => s <= playerList.length ? playerList[s - 1] : "BYE");
        } else {
          bracketPlayers = [...playerList];
          while (bracketPlayers.length < size) bracketPlayers.push("BYE");
        }

        this.knockoutRounds = [];

        if (!repEnabled) {
          // Standard single elimination bracket without repechage
          const firstRoundMatches = [];
          const roundMatchesCount = size / 2;

          for (let i = 0; i < roundMatchesCount; i++) {
            const match = {
              id: `ko_r1_m${i + 1}`,
              roundIndex: 0,
              matchIndex: i,
              stage: "knockout",
              stageName: (size === 2) ? "🏆 Grand Final" : ((size === 4) ? "Semi-Finals" : ((size === 8) ? "Quarter-Finals" : "Round 1")),
              player1: bracketPlayers[i * 2],
              player2: bracketPlayers[i * 2 + 1],
              legsP1: 0,
              legsP2: 0,
              winner: null,
              isFinished: false
            };
            this.checkByeMatch(match);
            firstRoundMatches.push(match);
          }
          this.knockoutRounds.push(firstRoundMatches);

          let currentCount = roundMatchesCount / 2;
          let rIdx = 1;
          while (currentCount >= 1) {
            const round = [];
            for (let i = 0; i < currentCount; i++) {
              round.push({
                id: `ko_r${rIdx + 1}_m${i + 1}`,
                roundIndex: rIdx,
                matchIndex: i,
                stage: "knockout",
                stageName: (currentCount === 1) ? "🏆 Grand Final" : ((currentCount === 2) ? "Semi-Finals" : ((currentCount === 4) ? "Quarter-Finals" : `Round ${rIdx + 1}`)),
                player1: null,
                player2: null,
                legsP1: 0,
                legsP2: 0,
                winner: null,
                isFinished: false
              });
            }
            this.knockoutRounds.push(round);
            currentCount /= 2;
            rIdx++;
          }
          this.repechageRounds = [];
        } else {
          // Universal Symmetric Double-Elimination Repechage with Semi-Finals Crossover (size >= 4)
          const roundMatchesCount = size / 2;
          const firstRoundMatches = [];

          for (let i = 0; i < roundMatchesCount; i++) {
            const match = {
              id: `ko_r1_m${i + 1}`,
              roundIndex: 0,
              matchIndex: i,
              stage: "knockout",
              stageName: (size === 4) ? "Round 1 (Half-Finals)" : ((size === 8) ? "Quarter-Finals" : "Round 1"),
              player1: bracketPlayers[i * 2],
              player2: bracketPlayers[i * 2 + 1],
              legsP1: 0,
              legsP2: 0,
              winner: null,
              isFinished: false
            };
            this.checkByeMatch(match);
            firstRoundMatches.push(match);
          }
          this.knockoutRounds.push(firstRoundMatches);

          let currentCount = roundMatchesCount / 2;
          let rIdx = 1;
          while (currentCount >= 2) {
            const round = [];
            for (let i = 0; i < currentCount; i++) {
              round.push({
                id: `ko_r${rIdx + 1}_m${i + 1}`,
                roundIndex: rIdx,
                matchIndex: i,
                stage: "knockout",
                stageName: (currentCount === 2) ? "Main Half-Finals" : `Round ${rIdx + 1}`,
                player1: null,
                player2: null,
                legsP1: 0,
                legsP2: 0,
                winner: null,
                isFinished: false
              });
            }
            this.knockoutRounds.push(round);
            currentCount /= 2;
            rIdx++;
          }

          // Semi-Finals (2 matches)
          this.knockoutRounds.push([
            {
              id: `ko_r${rIdx + 1}_m1`,
              roundIndex: rIdx,
              matchIndex: 0,
              stage: "knockout",
              stageName: "Semi-Final 1 (Top Main vs Bottom Rep)",
              player1: null,
              player2: null,
              legsP1: 0,
              legsP2: 0,
              winner: null,
              isFinished: false
            },
            {
              id: `ko_r${rIdx + 1}_m2`,
              roundIndex: rIdx,
              matchIndex: 1,
              stage: "knockout",
              stageName: "Semi-Final 2 (Bottom Main vs Top Rep)",
              player1: null,
              player2: null,
              legsP1: 0,
              legsP2: 0,
              winner: null,
              isFinished: false
            }
          ]);
          rIdx++;

          // Grand Final (1 match)
          this.knockoutRounds.push([
            {
              id: `ko_r${rIdx + 1}_m1`,
              roundIndex: rIdx,
              matchIndex: 0,
              stage: "knockout",
              stageName: "🏆 Grand Final",
              player1: null,
              player2: null,
              legsP1: 0,
              legsP2: 0,
              winner: null,
              isFinished: false
            }
          ]);

          // Repechage rounds
          const p = Math.round(Math.log2(size));
          this.repechageRounds = [];
          if (p === 2) {
            // size 4
            this.repechageRounds.push([
              {
                id: "ko_rep_r1_m1",
                roundIndex: 0,
                matchIndex: 0,
                stage: "repechage",
                stageName: "Top Repechage Final",
                player1: null,
                player2: "BYE",
                legsP1: 0,
                legsP2: 0,
                winner: null,
                isFinished: false
              },
              {
                id: "ko_rep_r1_m2",
                roundIndex: 0,
                matchIndex: 1,
                stage: "repechage",
                stageName: "Bottom Repechage Final",
                player1: null,
                player2: "BYE",
                legsP1: 0,
                legsP2: 0,
                winner: null,
                isFinished: false
              }
            ]);
          } else {
            const totalRepRounds = 2 * (p - 2);
            let curRepCount = size / 4;
            for (let s = 0; s < totalRepRounds; s++) {
              const isRepFinal = (s === totalRepRounds - 1);
              const isHalving = (s > 0 && s % 2 === 0);
              if (isHalving) curRepCount /= 2;
              const round = [];
              for (let i = 0; i < curRepCount; i++) {
                let name = `Repechage Round ${s + 1}`;
                if (isRepFinal) name = (i === 0) ? "Top Repechage Final" : "Bottom Repechage Final";
                else if (s === 0) name = `Repechage Round 1 (${i < curRepCount / 2 ? "Top" : "Bottom"})`;
                round.push({
                  id: `ko_rep_r${s + 1}_m${i + 1}`,
                  roundIndex: s,
                  matchIndex: i,
                  stage: "repechage",
                  stageName: name,
                  player1: null,
                  player2: null,
                  legsP1: 0,
                  legsP2: 0,
                  winner: null,
                  isFinished: false
                });
              }
              this.repechageRounds.push(round);
            }
          }
        }

        if (this.enableBronzeMatch && this.knockoutRounds.length >= 2) {
          this.bronzeMatch = {
            id: "ko_bronze_m1",
            roundIndex: -1,
            matchIndex: 0,
            stage: "bronze",
            stageName: "🥉 3rd Place Playoff",
            player1: null,
            player2: null,
            legsP1: 0,
            legsP2: 0,
            winner: null,
            isFinished: false
          };
        } else {
          this.bronzeMatch = null;
        }

        this.propagateBracket();
      }

      checkByeMatch(match) {
        if (!match || match.isFinished) return false;
        if (match.player1 === "BYE" && match.player2 === "BYE") {
          match.winner = "BYE";
          match.isFinished = true;
          return true;
        }
        if (match.player1 && match.player1 !== "BYE" && match.player2 === "BYE") {
          match.winner = match.player1;
          match.isFinished = true;
          match.legsP1 = this.matchSettings.legsToWin;
          return true;
        } else if (match.player2 && match.player2 !== "BYE" && match.player1 === "BYE") {
          match.winner = match.player2;
          match.isFinished = true;
          match.legsP2 = this.matchSettings.legsToWin;
          return true;
        }
        return false;
      }

      setMatchSlot(match, slot, newPlayer) {
        if (!match || match[slot] === newPlayer) return false;
        match[slot] = newPlayer;
        if (match.isFinished) {
          match.isFinished = false;
          match.winner = null;
          match.legsP1 = 0;
          match.legsP2 = 0;
        }
        return true;
      }

      getMatchLoser(m) {
        if (!m || !m.isFinished || !m.winner) return null;
        return (m.player1 === m.winner) ? m.player2 : m.player1;
      }

      propagateBracket() {
        const repEnabled = Boolean(this.repechageConfig && this.repechageConfig.enabled && this.repechageRounds.length > 0);

        let changed = false;
        do {
          changed = false;

          if (!repEnabled) {
            for (let r = 0; r < this.knockoutRounds.length - 1; r++) {
              const currentRound = this.knockoutRounds[r];
              const nextRound = this.knockoutRounds[r + 1];

              currentRound.forEach((m, idx) => {
                if (m.isFinished && m.winner) {
                  const nextMatchIdx = Math.floor(idx / 2);
                  const slot = (idx % 2 === 0) ? "player1" : "player2";
                  if (nextRound && nextRound[nextMatchIdx]) {
                    if (this.setMatchSlot(nextRound[nextMatchIdx], slot, m.winner)) changed = true;
                    if (this.checkByeMatch(nextRound[nextMatchIdx])) changed = true;
                  }
                }
              });
            }

            if (this.enableBronzeMatch && this.knockoutRounds.length >= 2) {
              const semiRound = this.knockoutRounds[this.knockoutRounds.length - 2];
              if (semiRound && semiRound.length >= 2 && semiRound[0].isFinished && semiRound[1].isFinished) {
                if (this.bronzeMatch) {
                  const l1 = this.getMatchLoser(semiRound[0]);
                  const l2 = this.getMatchLoser(semiRound[1]);
                  if (this.setMatchSlot(this.bronzeMatch, "player1", l1)) changed = true;
                  if (this.setMatchSlot(this.bronzeMatch, "player2", l2)) changed = true;
                  if (this.checkByeMatch(this.bronzeMatch)) changed = true;
                }
              }
            }
          } else {
            // Universal Symmetric Double-Elimination Repechage with Semi-Finals Crossover
            const sfRoundIdx = this.knockoutRounds.length - 2;
            const finalRoundIdx = this.knockoutRounds.length - 1;
            const mainHalfFinalIdx = sfRoundIdx - 1;

            // Initial BYE check for KO Round 0
            if (this.knockoutRounds[0]) {
              this.knockoutRounds[0].forEach(m => {
                if (this.checkByeMatch(m)) changed = true;
              });
            }

            if (this.knockoutRounds.length === 3 && this.repechageRounds.length === 1) {
              // Size 4 (p = 2): R0 (2 matches) -> SF (2 matches) -> Final (1 match)
              const r0 = this.knockoutRounds[0];
              const sfRound = this.knockoutRounds[sfRoundIdx];
              const repFinalRound = this.repechageRounds[0];

              // Main R0 winners -> SF slot 1
              if (r0[0].isFinished && r0[0].winner && this.setMatchSlot(sfRound[0], "player1", r0[0].winner)) {
                changed = true;
              }
              if (r0[1].isFinished && r0[1].winner && this.setMatchSlot(sfRound[1], "player1", r0[1].winner)) {
                changed = true;
              }

              // Main R0 losers -> Rep Final slot 1 (slot 2 is already "BYE")
              if (r0[0].isFinished && r0[0].winner) {
                const loser = this.getMatchLoser(r0[0]);
                if (this.setMatchSlot(repFinalRound[0], "player1", loser)) changed = true;
              }
              if (r0[1].isFinished && r0[1].winner) {
                const loser = this.getMatchLoser(r0[1]);
                if (this.setMatchSlot(repFinalRound[1], "player1", loser)) changed = true;
              }
              repFinalRound.forEach(m => {
                if (this.checkByeMatch(m)) changed = true;
              });

              // Rep Final winners crossover -> SF slot 2
              if (repFinalRound[0].isFinished && repFinalRound[0].winner && this.setMatchSlot(sfRound[1], "player2", repFinalRound[0].winner)) {
                changed = true;
              }
              if (repFinalRound[1].isFinished && repFinalRound[1].winner && this.setMatchSlot(sfRound[0], "player2", repFinalRound[1].winner)) {
                changed = true;
              }

              sfRound.forEach(m => {
                if (this.checkByeMatch(m)) changed = true;
              });

              // Semi-Finals -> Grand Final and Bronze Match
              const finalMatch = this.knockoutRounds[finalRoundIdx][0];
              if (sfRound[0].isFinished && sfRound[0].winner && this.setMatchSlot(finalMatch, "player1", sfRound[0].winner)) {
                changed = true;
              }
              if (sfRound[1].isFinished && sfRound[1].winner && this.setMatchSlot(finalMatch, "player2", sfRound[1].winner)) {
                changed = true;
              }
              if (sfRound[0].isFinished && sfRound[0].winner && this.bronzeMatch) {
                const l = this.getMatchLoser(sfRound[0]);
                if (this.setMatchSlot(this.bronzeMatch, "player1", l)) changed = true;
              }
              if (sfRound[1].isFinished && sfRound[1].winner && this.bronzeMatch) {
                const l = this.getMatchLoser(sfRound[1]);
                if (this.setMatchSlot(this.bronzeMatch, "player2", l)) changed = true;
              }
              if (finalMatch && this.checkByeMatch(finalMatch)) changed = true;
              if (this.bronzeMatch && this.checkByeMatch(this.bronzeMatch)) changed = true;
            } else {
              // Size >= 8 (p >= 3)
              // 1. KO rounds before Half-Finals
              for (let r = 0; r < mainHalfFinalIdx; r++) {
                const curRound = this.knockoutRounds[r];
                const nextRound = this.knockoutRounds[r + 1];
                curRound.forEach((m, idx) => {
                  if (m.isFinished && m.winner) {
                    const targetIdx = Math.floor(idx / 2);
                    const slot = (idx % 2 === 0) ? "player1" : "player2";
                    if (nextRound && nextRound[targetIdx]) {
                      if (this.setMatchSlot(nextRound[targetIdx], slot, m.winner)) changed = true;
                      if (this.checkByeMatch(nextRound[targetIdx])) changed = true;
                    }
                  }
                });
              }

              // 2. Main R0 losers -> Rep R0
              const r0 = this.knockoutRounds[0];
              const rep0 = this.repechageRounds[0];
              if (r0 && rep0) {
                r0.forEach((m, idx) => {
                  if (m.isFinished && m.winner) {
                    const loser = this.getMatchLoser(m);
                    const targetIdx = Math.floor(idx / 2);
                    const slot = (idx % 2 === 0) ? "player1" : "player2";
                    if (rep0[targetIdx]) {
                      if (this.setMatchSlot(rep0[targetIdx], slot, loser)) changed = true;
                      if (this.checkByeMatch(rep0[targetIdx])) changed = true;
                    }
                  }
                });
              }

              // 3. Repechage progression
              for (let s = 0; s < this.repechageRounds.length - 1; s++) {
                const curRep = this.repechageRounds[s];
                const nextRep = this.repechageRounds[s + 1];
                const nextIsIntake = (s % 2 === 0);

                if (nextIsIntake) {
                  // Intake round: winners of curRep -> slot 1 of nextRep
                  // Losers of Main round (s/2 + 1) -> slot 2 of nextRep
                  const mainIntakeRoundIdx = (s / 2) + 1;
                  const mainIntakeRound = this.knockoutRounds[mainIntakeRoundIdx];
                  curRep.forEach((m, idx) => {
                    if (m.isFinished && m.winner && nextRep[idx]) {
                      if (this.setMatchSlot(nextRep[idx], "player1", m.winner)) changed = true;
                      if (this.checkByeMatch(nextRep[idx])) changed = true;
                    }
                  });
                  if (mainIntakeRound) {
                    mainIntakeRound.forEach((m, idx) => {
                      if (m.isFinished && m.winner && nextRep[idx]) {
                        const loser = this.getMatchLoser(m);
                        if (this.setMatchSlot(nextRep[idx], "player2", loser)) changed = true;
                        if (this.checkByeMatch(nextRep[idx])) changed = true;
                      }
                    });
                  }
                } else {
                  // Halving round: winners of curRep -> slot 1 / slot 2 of nextRep
                  curRep.forEach((m, idx) => {
                    if (m.isFinished && m.winner) {
                      const targetIdx = Math.floor(idx / 2);
                      const slot = (idx % 2 === 0) ? "player1" : "player2";
                      if (nextRep[targetIdx]) {
                        if (this.setMatchSlot(nextRep[targetIdx], slot, m.winner)) changed = true;
                        if (this.checkByeMatch(nextRep[targetIdx])) changed = true;
                      }
                    }
                  });
                }
              }

              // 4. Main Half-Finals winners -> SF slot 1
              const mainHalfRound = this.knockoutRounds[mainHalfFinalIdx];
              const sfRound = this.knockoutRounds[sfRoundIdx];
              if (mainHalfRound && sfRound) {
                mainHalfRound.forEach((m, idx) => {
                  if (m.isFinished && m.winner && sfRound[idx]) {
                    if (this.setMatchSlot(sfRound[idx], "player1", m.winner)) changed = true;
                    if (this.checkByeMatch(sfRound[idx])) changed = true;
                  }
                });
              }

              // 5. Rep Finals -> SF crossover slot 2
              const repFinalRound = this.repechageRounds[this.repechageRounds.length - 1];
              if (repFinalRound && sfRound) {
                // Top Rep (idx 0) -> SF 2 (sfRound[1].player2)
                if (repFinalRound[0] && repFinalRound[0].isFinished && repFinalRound[0].winner) {
                  if (this.setMatchSlot(sfRound[1], "player2", repFinalRound[0].winner)) changed = true;
                  if (this.checkByeMatch(sfRound[1])) changed = true;
                }
                // Bottom Rep (idx 1) -> SF 1 (sfRound[0].player2)
                if (repFinalRound[1] && repFinalRound[1].isFinished && repFinalRound[1].winner) {
                  if (this.setMatchSlot(sfRound[0], "player2", repFinalRound[1].winner)) changed = true;
                  if (this.checkByeMatch(sfRound[0])) changed = true;
                }
              }

              // 6. Semi-Finals -> Grand Final and Bronze Match
              const finalMatch = this.knockoutRounds[finalRoundIdx][0];
              if (sfRound[0] && sfRound[0].isFinished && sfRound[0].winner) {
                if (this.setMatchSlot(finalMatch, "player1", sfRound[0].winner)) changed = true;
                if (this.bronzeMatch) {
                  const l = this.getMatchLoser(sfRound[0]);
                  if (this.setMatchSlot(this.bronzeMatch, "player1", l)) changed = true;
                }
              }
              if (sfRound[1] && sfRound[1].isFinished && sfRound[1].winner) {
                if (this.setMatchSlot(finalMatch, "player2", sfRound[1].winner)) changed = true;
                if (this.bronzeMatch) {
                  const l = this.getMatchLoser(sfRound[1]);
                  if (this.setMatchSlot(this.bronzeMatch, "player2", l)) changed = true;
                }
              }
              if (finalMatch && this.checkByeMatch(finalMatch)) changed = true;
              if (this.bronzeMatch && this.checkByeMatch(this.bronzeMatch)) changed = true;
            }
          }
        } while (changed);

        const finalRound = this.knockoutRounds[this.knockoutRounds.length - 1];
        const finalFinished = Boolean(finalRound && finalRound[0] && finalRound[0].isFinished);
        const bronzeFinished = !this.enableBronzeMatch || !this.bronzeMatch || Boolean(this.bronzeMatch.isFinished);
        if (finalFinished && bronzeFinished) {
          this.status = "finished";
        }
      }

      recordMatchResult(matchId, { winner, legsP1, legsP2, p1Stats, p2Stats }) {
        this.matchStatsRegistry[matchId] = { winner, legsP1, legsP2, p1Stats, p2Stats, timestamp: Date.now() };

        let found = false;
        for (const group of this.groups) {
          const match = group.matches.find(m => m.id === matchId);
          if (match) {
            match.winner = winner;
            match.legsP1 = legsP1;
            match.legsP2 = legsP2;
            match.isFinished = true;
            this.updateGroupStandings(group);
            found = true;
            break;
          }
        }

        if (!found) {
          for (const round of this.knockoutRounds) {
            const match = round.find(m => m.id === matchId);
            if (match) {
              match.winner = winner;
              match.legsP1 = legsP1;
              match.legsP2 = legsP2;
              match.isFinished = true;
              found = true;
              break;
            }
          }
        }

        if (!found && this.repechageRounds) {
          for (const round of this.repechageRounds) {
            const match = round.find(m => m.id === matchId);
            if (match) {
              match.winner = winner;
              match.legsP1 = legsP1;
              match.legsP2 = legsP2;
              match.isFinished = true;
              found = true;
              break;
            }
          }
        }

        if (!found && this.bronzeMatch && this.bronzeMatch.id === matchId) {
          this.bronzeMatch.winner = winner;
          this.bronzeMatch.legsP1 = legsP1;
          this.bronzeMatch.legsP2 = legsP2;
          this.bronzeMatch.isFinished = true;
          found = true;
        }

        this.propagateBracket();
      }

      getOverallPlayerStats() {
        const statsMap = {};
        const initPlayer = (name) => {
          if (!statsMap[name]) {
            statsMap[name] = {
              player: name, matchesPlayed: 0, matchesWon: 0, matchesLost: 0,
              legsWon: 0, legsLost: 0, totalScore: 0, totalDarts: 0,
              doubleAttempts: 0, doubleHits: 0, count180: 0, count140: 0, count100: 0,
              highestCheckout: 0
            };
          }
          return statsMap[name];
        };

        this.players.forEach(p => initPlayer(p));

        Object.values(this.matchStatsRegistry).forEach(reg => {
          const { winner, p1Stats, p2Stats } = reg;
          [p1Stats, p2Stats].forEach(st => {
            if (st && st.name) {
              const p = initPlayer(st.name);
              p.matchesPlayed++;
              if (winner === st.name) p.matchesWon++;
              else if (winner) p.matchesLost++;
              p.legsWon += (st.legsWon || 0);
              p.legsLost += (st.legsLost || 0);
              p.totalScore += (st.totalScore || 0);
              p.totalDarts += (st.totalDarts || 0);
              p.doubleAttempts += (st.doubleAttempts || 0);
              p.doubleHits += (st.doubleHits || 0);
              p.count180 += (st.count180 || 0);
              p.count140 += (st.count140 || 0);
              p.count100 += (st.count100 || 0);
              if (st.highestCheckout > p.highestCheckout) p.highestCheckout = st.highestCheckout;
            }
          });
        });

        return Object.values(statsMap).map(p => {
          const threeDartAvg = p.totalDarts > 0 ? (p.totalScore / p.totalDarts) * 3 : 0;
          const checkoutPct = p.doubleAttempts > 0 ? (p.doubleHits / p.doubleAttempts) * 100 : 0;
          const winPct = p.matchesPlayed > 0 ? (p.matchesWon / p.matchesPlayed) * 100 : 0;
          return {
            ...p,
            threeDartAvg: Number(threeDartAvg.toFixed(2)),
            checkoutPct: Number(checkoutPct.toFixed(1)),
            winPct: Number(winPct.toFixed(1))
          };
        }).sort((a, b) => b.threeDartAvg - a.threeDartAvg);
      }

      exportCSV() {
        const stats = this.getOverallPlayerStats();
        const headers = ["Player", "Matches Played", "Matches Won", "Matches Lost", "Win %", "Legs Won", "Legs Lost", "3-Dart Avg", "Checkout %", "Doubles Hit", "Doubles Attempted", "180s", "140+", "100+", "Highest Checkout", "Total Darts"];
        const rows = stats.map(s => [
          `"${s.player.replace(/"/g, '""')}"`, s.matchesPlayed, s.matchesWon, s.matchesLost, s.winPct + "%", s.legsWon, s.legsLost, s.threeDartAvg, s.checkoutPct + "%", s.doubleHits, s.doubleAttempts, s.count180, s.count140, s.count100, s.highestCheckout, s.totalDarts
        ]);
        return [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
      }
    }

    window.Tournament = Tournament;

