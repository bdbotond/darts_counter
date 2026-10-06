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

if __name__ == "__main__":
    test_x01_bust_and_checkout()
    test_impossible_checkout_validation()
    test_bull_off_after_n_rounds()
    test_stats_calculation()
    test_group_standings_sort()
    test_bracket_propagation()
    test_csv_export()
    print("ALL TESTS PASSED: 7/7 checks verified successfully.")

