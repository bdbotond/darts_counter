// Tournament UI, Standings & Bracket controller
window.App = window.App || {};

App.registeredPlayers = [];

App.renderPlayerTags = function() {
  const container = document.getElementById("tourney-player-tags");
  container.innerHTML = "";
  App.registeredPlayers.forEach(p => {
    const tag = document.createElement("div");
    tag.className = "player-tag";
    tag.innerHTML = `<span>${p}</span> <span class="remove-tag">&times;</span>`;
    tag.querySelector(".remove-tag").addEventListener("click", () => {
      App.registeredPlayers = App.registeredPlayers.filter(name => name !== p);
      App.renderPlayerTags();
    });
    container.appendChild(tag);
  });
  document.getElementById("tourney-player-count").textContent = App.registeredPlayers.length;
};

App.saveTournamentToStorage = function() {
  if (!App.activeTournament) return;
  try { localStorage.setItem("darts_tournament_data", JSON.stringify(App.activeTournament)); } catch (e) {}
};

App.loadTournamentFromStorage = function() {
  try {
    const raw = localStorage.getItem("darts_tournament_data");
    if (raw) {
      const data = JSON.parse(raw);
      App.activeTournament = Object.assign(new Tournament(), data);
    }
  } catch (e) {}
};

App.renderTournamentDashboard = function() {
  const tourney = App.activeTournament;
  if (!tourney) return;
  document.getElementById("tourney-dash-title").textContent = tourney.name;
  document.getElementById("tourney-dash-meta").innerHTML = `
    <span class="group-badge" style="color: var(--accent); background: rgba(35, 134, 54, 0.15);">
      ${tourney.format === "groups" ? "Groups + Knockout Tree" : "Direct Knockout Tree"}
    </span>
    <span class="group-badge" style="color: var(--accent-gold); background: rgba(227, 179, 65, 0.15); margin-left: 0.5rem;">
      STATUS: ${tourney.status.toUpperCase()}
    </span>
  `;

  const groupsContainer = document.getElementById("tourney-groups-container");
  const advanceBox = document.getElementById("tourney-advance-box");
  const bracketContainer = document.getElementById("tourney-bracket-container");

  if (tourney.format === "groups") {
    groupsContainer.style.display = "grid";
    groupsContainer.innerHTML = "";
    const advance = Math.max(1, tourney.advancePerGroup || 2);

    tourney.groups.forEach(group => {
      const card = document.createElement("div");
      card.className = "group-card";
      const table = (group.standings && group.standings.length) ? group.standings : (tourney.getGroupStandings ? tourney.getGroupStandings(group.id) : []);
      const completedCount = group.matches.filter(m => m.isFinished).length;
      const totalCount = group.matches.length;

      let tableHtml = `
        <div class="group-header">
          <h3 class="group-title">🎯 ${group.name}</h3>
          <span class="group-badge">${group.players.length} Players • Top ${advance} Advance</span>
        </div>

        <div>
          <div class="section-subtitle">
            <span>Standings Table</span>
            <span style="font-size: 0.75rem; color: var(--accent); font-weight: 500;">● Green = Qualifying Zone</span>
          </div>
          <div class="table-wrap">
            <table class="stats-table">
              <thead>
                <tr>
                  <th style="width: 42px; text-align: center;">Pos</th>
                  <th>Player</th>
                  <th style="width: 42px; text-align: center;">Pld</th>
                  <th style="width: 40px; text-align: center;">W</th>
                  <th style="width: 40px; text-align: center;">L</th>
                  <th style="width: 48px; text-align: center;">+/-</th>
                  <th style="width: 48px; text-align: center; color: var(--accent-gold);">Pts</th>
                </tr>
              </thead>
              <tbody>
      `;

      table.forEach((row, idx) => {
        const isQualifying = idx < advance;
        const diffDisplay = row.diff > 0 ? `+${row.diff}` : `${row.diff}`;
        tableHtml += `
          <tr class="${isQualifying ? 'qualifying-row' : ''}">
            <td style="text-align: center; font-weight: 700;">#${idx + 1}</td>
            <td><strong>${row.player}</strong></td>
            <td style="text-align: center;">${row.played}</td>
            <td style="text-align: center;">${row.won}</td>
            <td style="text-align: center;">${row.lost}</td>
            <td style="text-align: center; color: ${row.diff > 0 ? 'var(--accent)' : (row.diff < 0 ? 'var(--accent-red)' : 'var(--text-muted)')}; font-weight: 600;">${diffDisplay}</td>
            <td style="text-align: center; font-weight: 700; color: var(--accent-gold); font-size: 0.95rem;">${row.points}</td>
          </tr>
        `;
      });
      tableHtml += `</tbody></table></div></div>`;

      tableHtml += `
        <div>
          <div class="section-subtitle">
            <span>Matches</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${completedCount}/${totalCount} Completed</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      `;

      group.matches.forEach(m => {
        const isDone = m.isFinished;
        const resText = isDone ? `${m.legsP1} - ${m.legsP2}` : "vs";
        const wClass1 = m.winner === m.player1 ? "winner" : "";
        const wClass2 = m.winner === m.player2 ? "winner" : "";
        tableHtml += `
          <div class="fixture-card ${isDone ? 'finished' : ''}">
            <div class="fixture-matchup">
              <span class="fixture-player p1 ${wClass1}">${m.player1}</span>
              <span class="fixture-score-badge ${isDone ? 'finished' : ''}">${resText}</span>
              <span class="fixture-player p2 ${wClass2}">${m.player2}</span>
            </div>
            <button class="btn ${isDone ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="App.launchTournamentFixture('${m.id}')" style="min-width: 65px;">
              ${isDone ? "Edit" : "Play"}
            </button>
          </div>
        `;
      });

      tableHtml += `</div></div>`;
      card.innerHTML = tableHtml;
      groupsContainer.appendChild(card);
    });

    if (tourney.status === "groups") {
      advanceBox.style.display = "block";
      const allDone = tourney.groups.every(g => g.matches.every(m => m.isFinished));
      const advanceBtn = document.getElementById("btn-advance-to-knockout");
      if (allDone) {
        advanceBtn.className = "btn btn-primary btn-lg";
        advanceBtn.innerHTML = "🏆 All Group Matches Completed! Advance to Knockout Bracket →";
      } else {
        advanceBtn.className = "btn btn-gold btn-lg";
        advanceBtn.innerHTML = "🚀 Advance Qualifiers to Knockout Bracket";
      }
      advanceBtn.onclick = () => {
        if (!allDone && !confirm("Some group matches are still unplayed. Advance top players to knockout anyway?")) {
          return;
        }
        if (tourney.advanceFromGroupsToKnockout) tourney.advanceFromGroupsToKnockout();
        else tourney.generateKnockoutFromGroups();
        App.saveTournamentToStorage();
        App.renderTournamentDashboard();
      };
    } else {
      advanceBox.style.display = "none";
    }
  } else {
    groupsContainer.style.display = "none";
    advanceBox.style.display = "none";
  }

  if (tourney.status === "knockout" || tourney.status === "completed" || tourney.format === "knockout") {
    bracketContainer.style.display = "block";
    App.renderBracketTree();
  } else {
    bracketContainer.style.display = "none";
  }
};

App.renderBracketTree = function() {
  const container = document.getElementById("bracket-tree-view");
  container.innerHTML = "";
  if (!App.activeTournament || !App.activeTournament.knockoutRounds) return;

  const totalRounds = App.activeTournament.knockoutRounds.length;
  App.activeTournament.knockoutRounds.forEach((round, rIdx) => {
    const col = document.createElement("div");
    col.className = "bracket-column";
    let roundTitle = `Round ${rIdx + 1}`;
    if (rIdx === totalRounds - 1) roundTitle = "🏆 Final";
    else if (rIdx === totalRounds - 2) roundTitle = "Semi-Finals";
    else if (rIdx === totalRounds - 3) roundTitle = "Quarter-Finals";

    col.innerHTML = `<h4>${roundTitle}</h4>`;
    round.forEach(m => {
      const card = document.createElement("div");
      card.className = "bracket-match";
      const p1 = m.player1 || "TBD";
      const p2 = m.player2 || "TBD";
      const canPlay = m.player1 && m.player2;
      const isDone = m.isFinished;

      card.innerHTML = `
        <div class="bracket-match-p ${m.winner && m.winner === m.player1 ? 'winner' : ''}">
          <span>${p1}</span>
          <strong>${isDone ? m.legsP1 : '-'}</strong>
        </div>
        <div class="bracket-match-p ${m.winner && m.winner === m.player2 ? 'winner' : ''}">
          <span>${p2}</span>
          <strong>${isDone ? m.legsP2 : '-'}</strong>
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:0.4rem;">
          <button class="btn btn-secondary btn-sm" ${!canPlay ? 'disabled' : ''} onclick="App.launchTournamentFixture('${m.id}')">${isDone ? 'Modify / Replay' : 'Play'}</button>
        </div>
      `;
      col.appendChild(card);
    });
    container.appendChild(col);
  });
};

App.downloadCSV = function() {
  if (!App.activeTournament) return;
  const csv = App.activeTournament.exportCSV();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${App.activeTournament.name.replace(/\s+/g, "_")}_stats.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

App.initTournamentUI = function() {
  document.getElementById("btn-tourney-add-player").addEventListener("click", () => {
    const input = document.getElementById("tourney-player-input");
    const name = input.value.trim();
    if (name && !App.registeredPlayers.includes(name)) {
      App.registeredPlayers.push(name);
      input.value = "";
      App.renderPlayerTags();
    }
  });

  document.getElementById("tourney-player-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btn-tourney-add-player").click();
  });

  document.getElementById("btn-tourney-shuffle").addEventListener("click", () => {
    for (let i = App.registeredPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [App.registeredPlayers[i], App.registeredPlayers[j]] = [App.registeredPlayers[j], App.registeredPlayers[i]];
    }
    App.renderPlayerTags();
  });

  document.querySelectorAll("input[name='tourney-format']").forEach(radio => {
    radio.addEventListener("change", (e) => {
      document.getElementById("tourney-groups-config").style.display = e.target.value === "groups" ? "grid" : "none";
    });
  });

  const tourneyBullToggle = document.getElementById("tourney-bull-off-toggle");
  document.getElementById("btn-create-tourney-start").addEventListener("click", () => {
    if (App.registeredPlayers.length < 2) { alert("Please register at least 2 players"); return; }
    const format = document.querySelector("input[name='tourney-format']:checked").value;
    const groupCount = parseInt(document.getElementById("tourney-group-count").value, 10) || 2;
    const advancePerGroup = parseInt(document.getElementById("tourney-advance-count").value, 10) || 2;
    const gameScore = parseInt(document.getElementById("tourney-game-type").value, 10) || 501;
    const legsToWin = parseInt(document.getElementById("tourney-legs-to-win").value, 10) || 2;
    const doubleOut = document.getElementById("tourney-out-mode").value === "double";
    const tBullOff = tourneyBullToggle && tourneyBullToggle.checked;
    const tBullRounds = tBullOff ? (parseInt(document.getElementById("tourney-bull-off-rounds").value, 10) || 15) : 0;

    App.activeTournament = new Tournament({
      name: "Darts Championship",
      format,
      players: [...App.registeredPlayers],
      groupCount,
      advancePerGroup,
      startingScore: gameScore,
      legsToWin,
      doubleOut,
      trackDoubles: true,
      bullOffAfterRounds: tBullRounds
    });

    App.activeTournament.start();
    App.saveTournamentToStorage();
    App.renderTournamentDashboard();
    App.showView("tourneyDash");
  });

  document.getElementById("btn-export-csv").addEventListener("click", App.downloadCSV);
  document.getElementById("btn-modal-export-csv").addEventListener("click", App.downloadCSV);

  document.getElementById("btn-new-tournament").addEventListener("click", () => {
    if (confirm("Reset current tournament and create a new one?")) {
      App.activeTournament = null;
      localStorage.removeItem("darts_tournament_data");
      App.showView("tourneySetup");
    }
  });
};
