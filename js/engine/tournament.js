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
        this.groups = [];
        this.knockoutRounds = [];
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
          table[p] = { player: p, played: 0, won: 0, lost: 0, legsFor: 0, legsAgainst: 0, legDiff: 0, points: 0 };
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
              s2.legDiff = s2.legsFor - s2.legsAgainst;
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

        this.createBracket(qualified.filter(Boolean));
        this.status = "knockout";
      }

      initDirectKnockout() {
        this.createBracket([...this.players]);
      }

      createBracket(playerList) {
        let size = 2;
        while (size < playerList.length) size *= 2;

        const bracketPlayers = [...playerList];
        while (bracketPlayers.length < size) bracketPlayers.push("BYE");

        this.knockoutRounds = [];
        const firstRoundMatches = [];
        const roundMatchesCount = size / 2;

        for (let i = 0; i < roundMatchesCount; i++) {
          const p1 = bracketPlayers[i * 2];
          const p2 = bracketPlayers[i * 2 + 1];
          const match = {
            id: `ko_r1_m${i + 1}`,
            roundIndex: 0,
            matchIndex: i,
            player1: p1,
            player2: p2,
            legsP1: 0,
            legsP2: 0,
            winner: null,
            isFinished: false
          };

          if (p2 === "BYE" && p1 !== "BYE") {
            match.winner = p1;
            match.isFinished = true;
            match.legsP1 = this.matchSettings.legsToWin;
          } else if (p1 === "BYE" && p2 !== "BYE") {
            match.winner = p2;
            match.isFinished = true;
            match.legsP2 = this.matchSettings.legsToWin;
          }

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
        this.propagateBracket();
      }

      propagateBracket() {
        for (let r = 0; r < this.knockoutRounds.length - 1; r++) {
          const currentRound = this.knockoutRounds[r];
          const nextRound = this.knockoutRounds[r + 1];

          currentRound.forEach((m, idx) => {
            if (m.isFinished && m.winner) {
              const nextMatchIdx = Math.floor(idx / 2);
              const isSlot1 = (idx % 2 === 0);
              if (nextRound[nextMatchIdx]) {
                if (isSlot1) nextRound[nextMatchIdx].player1 = m.winner;
                else nextRound[nextMatchIdx].player2 = m.winner;
              }
            }
          });
        }
        const finalRound = this.knockoutRounds[this.knockoutRounds.length - 1];
        if (finalRound && finalRound[0] && finalRound[0].isFinished) {
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
              this.propagateBracket();
              break;
            }
          }
        }
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

