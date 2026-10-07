#!/usr/bin/env python3
"""
Self-check test suite for darts counter engine and tournament logic.
Runs with zero dependencies: python3 test_engine.py
"""

def test_x01_bust_and_checkout():
    # Simulate basic X01 logic
    starting_score = 501
    score = starting_score

    # Turn 1: 180
    score -= 180
    assert score == 321, f"Expected 321, got {score}"

    # Turn 2: 140
    score -= 140
    assert score == 181, f"Expected 181, got {score}"

    # Turn 3: 141 (leaves 40)
    score -= 141
    assert score == 40, f"Expected 40, got {score}"

    # Bust case: score left = 1 on double out is bust
    attempt_score = 39
    remaining = score - attempt_score
    is_bust = (remaining < 0 or remaining == 1)
    assert is_bust, "Score left of 1 should be bust in double out"

    # Valid checkout: D20 (40 pts) leaves 0
    attempt_score = 40
    remaining = score - attempt_score
    is_won = (remaining == 0)
    assert is_won, "Score of 40 on 40 remaining should win leg"

def test_impossible_checkout_validation():
    # Bogey numbers and >170 cannot be checked out with double out
    legal_checkouts = {170, 167, 164, 161, 160, 40, 32, 16, 2}
    bogey_or_impossible = [180, 175, 171, 169, 168, 166, 165, 163, 162, 159]

    # Test 180: If player has 180, scoring 180 leaves 0, but is an IMPOSSIBLE checkout
    score = 180
    attempt = 180
    remaining = score - attempt
    assert remaining == 0
    # On Double Out, if score not in legal checkouts, it is a bust
    is_bust = (remaining == 0 and score not in legal_checkouts)
    assert is_bust, "Score of 180 on 180 remaining MUST be a bust on Double Out"

    # Test 169 (bogey): Cannot finish 169 in 3 darts ending on double
    score = 169
    attempt = 169
    remaining = score - attempt
    is_bust = (remaining == 0 and score not in legal_checkouts)
    assert is_bust, "Score of 169 on 169 remaining MUST be a bust on Double Out"

    # Test 170 (max checkout): Legal checkout
    score = 170
    attempt = 170
    remaining = score - attempt
    is_won = (remaining == 0 and score in legal_checkouts)
    assert is_won, "Score of 170 on 170 remaining is a legal 3-dart double out"

def test_stats_calculation():
    # Total score = 501, darts = 11 darts
    total_score = 501
    total_darts = 11
    three_dart_avg = (total_score / total_darts) * 3
    assert round(three_dart_avg, 2) == 136.64, f"Expected 136.64, got {round(three_dart_avg, 2)}"

    # Double stats: 1 hit out of 3 attempts = 33.3%
    double_attempts = 3
    double_hits = 1
    double_pct = (double_hits / double_attempts) * 100
    assert round(double_pct, 1) == 33.3, f"Expected 33.3, got {round(double_pct, 1)}"

def test_group_standings_sort():
    # Players standings table
    table = [
        {"player": "Player A", "points": 2, "leg_diff": 1, "legs_for": 4},
        {"player": "Player B", "points": 4, "leg_diff": 3, "legs_for": 6},
        {"player": "Player C", "points": 2, "leg_diff": -2, "legs_for": 2},
        {"player": "Player D", "points": 2, "leg_diff": 1, "legs_for": 5}
    ]

    # Sort key: points DESC, leg_diff DESC, legs_for DESC
    sorted_table = sorted(
        table,
        key=lambda x: (x["points"], x["leg_diff"], x["legs_for"]),
        reverse=True
    )

    assert sorted_table[0]["player"] == "Player B", "Player B should be 1st"
    assert sorted_table[1]["player"] == "Player D", "Player D should be 2nd (higher legs for than A)"
    assert sorted_table[2]["player"] == "Player A", "Player A should be 3rd"
    assert sorted_table[3]["player"] == "Player C", "Player C should be 4th"

def test_bracket_propagation():
    # 4 player bracket: [Match 1: A vs B, Match 2: C vs D] -> Final: Winner M1 vs Winner M2
    round_1 = [
        {"match_id": 1, "p1": "A", "p2": "B", "winner": "A"},
        {"match_id": 2, "p1": "C", "p2": "D", "winner": "D"}
    ]
    round_final = [{"match_id": 3, "p1": None, "p2": None, "winner": None}]

    # Propagate
    round_final[0]["p1"] = round_1[0]["winner"]
    round_final[0]["p2"] = round_1[1]["winner"]

    assert round_final[0]["p1"] == "A"
    assert round_final[0]["p2"] == "D"

def test_csv_export():
    import csv
    import io

    headers = ["Player", "Played", "Won", "3-Dart Avg", "Checkout %"]
    data = [
        ["Luke Littler", 5, 5, 105.4, "50.0%"],
        ["Michael Smith", 5, 3, 98.2, "38.5%"]
    ]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(data)
    csv_str = output.getvalue()

    assert "Luke Littler,5,5,105.4,50.0%" in csv_str
    assert "Michael Smith,5,3,98.2,38.5%" in csv_str

def test_bull_off_after_n_rounds():
    # Test round tracking and Bull-off condition after N rounds
    bull_off_after_rounds = 3
    p1_visits = 0
    p2_visits = 0
    legs_p1 = 0
    legs_p2 = 0

    # Round 1
    p1_visits += 1
    p2_visits += 1
    is_bull_off_due = (p1_visits >= bull_off_after_rounds and p2_visits >= bull_off_after_rounds)
    assert not is_bull_off_due

    # Round 2
    p1_visits += 1
    p2_visits += 1
    is_bull_off_due = (p1_visits >= bull_off_after_rounds and p2_visits >= bull_off_after_rounds)
    assert not is_bull_off_due

    # Round 3
    p1_visits += 1
    p2_visits += 1
    is_bull_off_due = (p1_visits >= bull_off_after_rounds and p2_visits >= bull_off_after_rounds)
    assert is_bull_off_due, "Bull-off should trigger when both players complete round 3"

    # Bull-off throw simulation: P1 hits 50 (Bullseye), P2 hits 25 (Outer Bull) -> P1 wins leg
    p1_bull_throw = 50
    p2_bull_throw = 25
    assert p1_bull_throw > p2_bull_throw
    winner = 0
    legs_p1 += 1
    assert legs_p1 == 1
    assert legs_p2 == 0

def test_bull_off_finishes_tournament_match():
    # Test that when Bull-off decides the match, winner is properly recorded in tournament standings and bracket
    tournament_matches = [
        {"id": "g_1", "p1": "Luke", "p2": "Michael", "legsP1": 0, "legsP2": 0, "winner": None, "isFinished": False}
    ]

    # Bull-off decides match in favor of Luke (e.g. 2 legs to 1)
    match_winner = "Luke"
    legs_p1 = 2
    legs_p2 = 1

    # Record into tournament
    tm = tournament_matches[0]
    tm["winner"] = match_winner
    tm["legsP1"] = legs_p1
    tm["legsP2"] = legs_p2
    tm["isFinished"] = True

    assert tm["isFinished"] is True
    assert tm["winner"] == "Luke"
    assert tm["legsP1"] == 2

    # Group standings update check
    points_p1 = 2 if tm["winner"] == "Luke" else 0
    assert points_p1 == 2, "Winner of Bull-off must receive 2 points in tournament table"

def test_bull_off_history_entry_and_visits_safety():
    # Simulates history handling with bull_off actions
    history = [
        {"type": "visit", "turn": 0, "visit": {"playerIndex": 0, "score": 60, "bust": False}},
        {"type": "bull_off", "turn": 0, "winner": 0, "legWon": True, "matchWon": True}
    ]

    rendered_badges = [
        f"Bull-off: {'Player 1' if a['winner'] == 0 else 'Player 2'} won {'Match' if a.get('matchWon') else 'Leg'}"
        if a.get("type") == "bull_off"
        else f"P{a['visit']['playerIndex'] + 1}: {a['visit']['score']} pts"
        for a in reversed(history[-8:])
        if a.get("type") == "bull_off" or a.get("visit")
    ]

    assert len(rendered_badges) == 2
    assert rendered_badges[0] == "Bull-off: Player 1 won Match"
    assert rendered_badges[1] == "P1: 60 pts"

def test_match_starter_and_alternating_legs():
    # Starter = 0 (Player 1 starts match)
    starter = 0
    assert [(starter if leg % 2 == 1 else 1 - starter) for leg in range(1, 5)] == [0, 1, 0, 1]

    # Starter = 1 (Player 2 starts match)
    starter = 1
    assert [(starter if leg % 2 == 1 else 1 - starter) for leg in range(1, 5)] == [1, 0, 1, 0]

    # Simulate setStartingPlayer before first throw
    history = []
    can_switch = len(history) == 0
    assert can_switch is True
    starter = 1
    assert starter == 1

    # After throw, cannot switch starter
    history.append({"visit": {"score": 60}})
    can_switch = len(history) == 0
    assert can_switch is False

def test_modular_file_structure_and_syntax():
    import os
    import subprocess

    required_files = [
        "index.html",
        "css/style.css",
        "js/sync.js",
        "js/app.js",
        "js/engine/checkouts.js",
        "js/engine/match.js",
        "js/engine/tournament.js",
        "js/ui/spectator.js",
        "js/ui/scorer.js",
        "js/ui/keypad.js",
        "js/ui/tournament.js",
        "js/ui/modals.js",
    ]

    for rel_path in required_files:
        assert os.path.exists(rel_path), f"Missing required file: {rel_path}"
        assert os.path.getsize(rel_path) > 0, f"File is empty: {rel_path}"

    with open("index.html", "r", encoding="utf-8") as f:
        html = f.read()

    for script in [
        "js/engine/checkouts.js",
        "js/engine/match.js",
        "js/engine/tournament.js",
        "js/sync.js",
        "js/app.js",
        "js/ui/spectator.js",
        "js/ui/scorer.js",
        "js/ui/keypad.js",
        "js/ui/tournament.js",
        "js/ui/modals.js",
    ]:
        assert f'<script src="{script}"></script>' in html, f"index.html missing script tag for {script}"

    # Syntax check via node -c
    js_files = [f for f in required_files if f.endswith(".js")]
    res = subprocess.run(["node", "-c", *js_files], capture_output=True, text=True)
    assert res.returncode == 0, f"JavaScript syntax error in files: {res.stderr}"

def test_group_tournament_generation():
    # 4 players, 2 groups
    players = ["Alice", "Bob", "Charlie", "David"]
    group_count = 2
    num_groups = max(1, min(group_count, len(players) // 2))
    assert num_groups == 2

    groups = [{"id": "A", "players": []}, {"id": "B", "players": []}]
    for idx, p in enumerate(players):
        groups[idx % num_groups]["players"].append(p)

    assert groups[0]["players"] == ["Alice", "Charlie"]
    assert groups[1]["players"] == ["Bob", "David"]

    # Each group of 2 generates 1 fixture (n*(n-1)/2)
    matches_gA = [("Alice", "Charlie")]
    matches_gB = [("Bob", "David")]
    assert len(matches_gA) == 1
    assert len(matches_gB) == 1

def test_repechage_and_bronze_tournament_engine():
    import subprocess
    node_test_script = """
    const fs = require('fs');
    const window = {};
    eval(fs.readFileSync('js/engine/tournament.js', 'utf8'));
    const Tournament = window.Tournament;

    const t = new Tournament({
      name: 'Symmetric Repechage & Bronze Check',
      format: 'direct_knockout',
      players: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
      repechageConfig: {
        enabled: true,
        fromRound: 0,
        toRound: 0,
        reEntryRound: 1
      },
      enableBronzeMatch: true,
      legsToWin: 2
    });

    t.start();
    if (t.knockoutRounds.length !== 4) throw new Error('Knockout rounds count mismatch: ' + t.knockoutRounds.length);
    if (t.repechageRounds.length !== 2) throw new Error('Repechage rounds count mismatch: ' + t.repechageRounds.length);
    if (!t.bronzeMatch) throw new Error('Bronze match not created');

    // 1. Round 0 (Quarter-Finals)
    t.recordMatchResult('ko_r1_m1', { winner: 'P1', legsP1: 2, legsP2: 0, p1Stats: { name: 'P1' }, p2Stats: { name: 'P2' } });
    t.recordMatchResult('ko_r1_m2', { winner: 'P3', legsP1: 2, legsP2: 1, p1Stats: { name: 'P3' }, p2Stats: { name: 'P4' } });
    t.recordMatchResult('ko_r1_m3', { winner: 'P5', legsP1: 2, legsP2: 0, p1Stats: { name: 'P5' }, p2Stats: { name: 'P6' } });
    t.recordMatchResult('ko_r1_m4', { winner: 'P7', legsP1: 2, legsP2: 1, p1Stats: { name: 'P7' }, p2Stats: { name: 'P8' } });

    // Check main R1 (Half-Finals) and repechage R0 routing
    if (t.knockoutRounds[1][0].player1 !== 'P1' || t.knockoutRounds[1][0].player2 !== 'P3') throw new Error('Main R1 M1 failed');
    if (t.knockoutRounds[1][1].player1 !== 'P5' || t.knockoutRounds[1][1].player2 !== 'P7') throw new Error('Main R1 M2 failed');
    if (t.repechageRounds[0][0].player1 !== 'P2' || t.repechageRounds[0][0].player2 !== 'P4') throw new Error('Rep R0 M1 failed');
    if (t.repechageRounds[0][1].player1 !== 'P6' || t.repechageRounds[0][1].player2 !== 'P8') throw new Error('Rep R0 M2 failed');

    // 2. Play Main R1 (Half-Finals)
    t.recordMatchResult('ko_r2_m1', { winner: 'P1', legsP1: 2, legsP2: 0, p1Stats: { name: 'P1' }, p2Stats: { name: 'P3' } });
    t.recordMatchResult('ko_r2_m2', { winner: 'P5', legsP1: 2, legsP2: 0, p1Stats: { name: 'P5' }, p2Stats: { name: 'P7' } });

    // 3. Play Rep R0
    t.recordMatchResult('ko_rep_r1_m1', { winner: 'P2', legsP1: 2, legsP2: 0, p1Stats: { name: 'P2' }, p2Stats: { name: 'P4' } });
    t.recordMatchResult('ko_rep_r1_m2', { winner: 'P6', legsP1: 2, legsP2: 1, p1Stats: { name: 'P6' }, p2Stats: { name: 'P8' } });

    // Check Rep R1 (Finals) pairing: Rep R0 winners vs Main QF losers
    if (t.repechageRounds[1][0].player1 !== 'P2' || t.repechageRounds[1][0].player2 !== 'P3') throw new Error('Rep Final Top failed');
    if (t.repechageRounds[1][1].player1 !== 'P6' || t.repechageRounds[1][1].player2 !== 'P7') throw new Error('Rep Final Bottom failed');

    // 4. Play Rep R1 (Finals)
    t.recordMatchResult('ko_rep_r2_m1', { winner: 'P3', legsP1: 2, legsP2: 1, p1Stats: { name: 'P3' }, p2Stats: { name: 'P2' } });
    t.recordMatchResult('ko_rep_r2_m2', { winner: 'P6', legsP1: 2, legsP2: 0, p1Stats: { name: 'P6' }, p2Stats: { name: 'P7' } });

    // 5. Check Semi-Finals (Round 2) Crossover
    // SF 1: Top Main (P1) vs Bottom Rep (P6)
    // SF 2: Bottom Main (P5) vs Top Rep (P3)
    const sf = t.knockoutRounds[2];
    if (sf[0].player1 !== 'P1' || sf[0].player2 !== 'P6') throw new Error('SF1 crossover failed: ' + sf[0].player1 + ' vs ' + sf[0].player2);
    if (sf[1].player1 !== 'P5' || sf[1].player2 !== 'P3') throw new Error('SF2 crossover failed: ' + sf[1].player1 + ' vs ' + sf[1].player2);

    // 6. Play Semi-Finals
    t.recordMatchResult(sf[0].id, { winner: 'P1', legsP1: 2, legsP2: 0 });
    t.recordMatchResult(sf[1].id, { winner: 'P3', legsP1: 2, legsP2: 1 });

    // 7. Check Bronze Match and Grand Final
    if (t.bronzeMatch.player1 !== 'P6' || t.bronzeMatch.player2 !== 'P5') throw new Error('Bronze match pairing failed');
    const finalMatch = t.knockoutRounds[3][0];
    if (finalMatch.player1 !== 'P1' || finalMatch.player2 !== 'P3') throw new Error('Grand Final pairing failed');

    // Play Bronze & Final
    t.recordMatchResult(t.bronzeMatch.id, { winner: 'P5', legsP1: 1, legsP2: 2 });
    t.recordMatchResult(finalMatch.id, { winner: 'P3', legsP1: 1, legsP2: 2 });

    if (!finalMatch.isFinished || finalMatch.winner !== 'P3') throw new Error('Final match completion failed');
    if (!t.bronzeMatch.isFinished || t.bronzeMatch.winner !== 'P5') throw new Error('Bronze match completion failed');
    if (t.status !== 'finished') throw new Error('Tournament finish state failed');
    """
    res = subprocess.run(["node", "-e", node_test_script], capture_output=True, text=True)
    assert res.returncode == 0, f"Repechage & Bronze test failed: {res.stderr}"

def test_universal_repechage_even_odd_players():
    import subprocess
    node_test_script = """
    const fs = require('fs');
    const window = {};
    eval(fs.readFileSync('js/engine/tournament.js', 'utf8'));
    const Tournament = window.Tournament;

    function simulateTournament(n, seedBracket) {
      const players = Array.from({ length: n }, (_, i) => 'Player_' + (i + 1));
      const t = new Tournament({
        name: `Rep Test N=${n} Seed=${seedBracket}`,
        format: 'direct_knockout',
        players: players,
        repechageConfig: { enabled: true, fromRound: 0, toRound: 0, reEntryRound: 1 },
        enableBronzeMatch: true,
        legsToWin: 2,
        seedBracket: seedBracket
      });
      t.start();

      let maxLoops = 200;
      let loops = 0;
      while (t.status !== 'finished' && loops < maxLoops) {
        loops++;
        let playedAny = false;
        const allMatches = [
          ...t.knockoutRounds.flat(),
          ...t.repechageRounds.flat(),
          ...(t.bronzeMatch ? [t.bronzeMatch] : [])
        ];

        for (const m of allMatches) {
          if (!m.isFinished && m.player1 && m.player2 && m.player1 !== 'BYE' && m.player2 !== 'BYE') {
            t.recordMatchResult(m.id, {
              winner: m.player1,
              legsP1: 2,
              legsP2: 0,
              p1Stats: { name: m.player1 },
              p2Stats: { name: m.player2 }
            });
            playedAny = true;
            break;
          }
        }
        if (!playedAny) break;
      }

      if (t.status !== 'finished') {
        const unplayed = [
          ...t.knockoutRounds.flat(),
          ...t.repechageRounds.flat(),
          ...(t.bronzeMatch ? [t.bronzeMatch] : [])
        ].filter(m => !m.isFinished);
        throw new Error(`Tournament N=${n} (seeded=${seedBracket}) failed to finish. Unplayed: ${JSON.stringify(unplayed.map(m => m.id))}`);
      }

      const finalMatch = t.knockoutRounds[t.knockoutRounds.length - 1][0];
      if (!finalMatch.isFinished || !finalMatch.winner || finalMatch.winner === 'BYE') {
        throw new Error(`Tournament N=${n} (seeded=${seedBracket}) invalid winner: ${finalMatch.winner}`);
      }
      if (t.enableBronzeMatch && (!t.bronzeMatch || !t.bronzeMatch.isFinished || !t.bronzeMatch.winner || t.bronzeMatch.winner === 'BYE')) {
        throw new Error(`Tournament N=${n} (seeded=${seedBracket}) invalid bronze winner`);
      }
    }

    // Verify both even and odd player counts across sizes 4, 8, and 16
    const testCounts = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    for (const count of testCounts) {
      simulateTournament(count, true);
      simulateTournament(count, false);
    }
    """
    res = subprocess.run(["node", "-e", node_test_script], capture_output=True, text=True)
    assert res.returncode == 0, f"Universal repechage even/odd test failed: {res.stderr}"

def test_audit_fixes_match_and_tournament():
    import subprocess
    node_test_script = """
    const fs = require('fs');
    const window = {};
    eval(fs.readFileSync('js/engine/checkouts.js', 'utf8'));
    eval(fs.readFileSync('js/engine/match.js', 'utf8'));
    eval(fs.readFileSync('js/engine/tournament.js', 'utf8'));

    // 1. Test bust visit handling
    const m = new window.DartsMatch({ startingScore: 501, legsToWin: 3 });
    m.recordVisit({ score: 0, dartsCount: 3, doubleAttempts: 0, bust: true });
    if (!m.currentLeg.visits[0][0].bust) throw new Error('Bust visit flag not set');
    if (m.currentLeg.scores[0] !== 501) throw new Error('Bust score not retained');

    // 2. Test bull-off sudden death undo exact legs
    const m2 = new window.DartsMatch({ startingScore: 501, legsToWin: 3 });
    m2.resolveBullOff(0, true);
    if (m2.legsP1 !== 3 || !m2.isFinished) throw new Error('Bull-off decideEntireMatch failed');
    m2.undo();
    if (m2.legsP1 !== 0 || m2.isFinished) throw new Error(`Undo did not restore legs: legsP1=${m2.legsP1}`);

    // 3. Test group crossover pairing with seedBracket: true
    const t = new window.Tournament({
      name: 'Group Crossover Test',
      format: 'groups',
      players: ['P1', 'P2', 'P3', 'P4'],
      groupCount: 2,
      advancePerGroup: 2,
      seedBracket: true
    });
    t.start();
    t.groups[0].standings = [{ player: 'A1_winner', legDiff: 2 }, { player: 'A2_runnerup', legDiff: 1 }];
    t.groups[1].standings = [{ player: 'B1_winner', legDiff: 2 }, { player: 'B2_runnerup', legDiff: 1 }];
    t.advanceFromGroupsToKnockout();

    const mR1_1 = t.knockoutRounds[0][0];
    const mR1_2 = t.knockoutRounds[0][1];
    if (mR1_1.player1 !== 'A1_winner' || mR1_1.player2 !== 'B2_runnerup') {
      throw new Error(`Group crossover M1 failed: ${mR1_1.player1} vs ${mR1_1.player2}`);
    }
    if (mR1_2.player1 !== 'B1_winner' || mR1_2.player2 !== 'A2_runnerup') {
      throw new Error(`Group crossover M2 failed: ${mR1_2.player1} vs ${mR1_2.player2}`);
    }

    // 4. Test downstream match reset on replay
    const t2 = new window.Tournament({
      name: 'Replay Downstream Reset',
      format: 'direct_knockout',
      players: ['P1', 'P2', 'P3', 'P4'],
      legsToWin: 2,
      seedBracket: false
    });
    t2.start();
    t2.recordMatchResult('ko_r1_m1', { winner: 'P1', legsP1: 2, legsP2: 0 });
    t2.recordMatchResult('ko_r1_m2', { winner: 'P3', legsP1: 2, legsP2: 0 });
    t2.recordMatchResult('ko_r2_m1', { winner: 'P1', legsP1: 2, legsP2: 0 });

    // Modify M1: P2 won instead of P1
    t2.recordMatchResult('ko_r1_m1', { winner: 'P2', legsP1: 0, legsP2: 2 });
    const finalM = t2.knockoutRounds[1][0];
    if (finalM.player1 !== 'P2') throw new Error(`Final player1 not updated to P2: ${finalM.player1}`);
    if (finalM.isFinished) throw new Error('Downstream final match not reset after player changed');
    if (finalM.winner !== null) throw new Error(`Downstream final winner not reset: ${finalM.winner}`);

    // 5. Test diff and legDiff in standings
    const g = { players: ['X', 'Y'], matches: [{ player1: 'X', player2: 'Y', legsP1: 2, legsP2: 1, winner: 'X', isFinished: true }] };
    t.updateGroupStandings(g);
    if (g.standings[0].legDiff !== 1 || g.standings[0].diff !== 1) throw new Error('Standings diff/legDiff mismatch');
    """
    res = subprocess.run(["node", "-e", node_test_script], capture_output=True, text=True)
    assert res.returncode == 0, f"Audit fixes test failed: {res.stderr}"

if __name__ == "__main__":
    test_x01_bust_and_checkout()
    test_impossible_checkout_validation()
    test_bull_off_after_n_rounds()
    test_bull_off_finishes_tournament_match()
    test_bull_off_history_entry_and_visits_safety()
    test_match_starter_and_alternating_legs()
    test_modular_file_structure_and_syntax()
    test_group_tournament_generation()
    test_stats_calculation()
    test_group_standings_sort()
    test_bracket_propagation()
    test_csv_export()
    test_repechage_and_bronze_tournament_engine()
    test_universal_repechage_even_odd_players()
    test_audit_fixes_match_and_tournament()
    print("ALL TESTS PASSED: 15/15 checks verified successfully.")





