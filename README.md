# Darts Match Counter & Tournament Organizer

A fast, lightweight, dependency-free web-based darts match counter and tournament management app.
Works anywhere: locally, offline, and hosted directly via **GitHub Pages**.

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/bdbotond)

## Features
- **All-in-one Single File**: Entire application runs self-contained from [`index.html`](index.html).
- **Dual-Screen Scoreboard**: Open a second screen (`index.html?screen=display`) on a TV or second monitor. Synchronizes in real time with zero lag via browser `BroadcastChannel` and `localStorage`.
- **Match Scoring**:
  - Standard X01 games (501, 301, 701, custom).
  - Single or Double Out, First to N legs.
  - Live checkout recommendations (170 down to 2).
  - Two input modes: Fast numeric input (with common shortcuts like 180, 140, 100) and 3-Dart dartboard matrix keypad.
  - Double attempt & checkout percentage tracking.
  - Undo turn support.
- **Tournament Organizer**:
  - Groups + Knockout Tree (Round-robin groups, automated standings, top N advance to playoff bracket).
  - Direct Knockout Tree (Single-elimination bracket).
  - Mid-tournament live player statistics modal.
  - One-click CSV export of tournament statistics.


## Local Usage
Download the reop and simply double-click `index.html` in your browser. No server required.
