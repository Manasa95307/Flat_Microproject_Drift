GitHub repo link: https://github.com/Manasa95307/Flat_Microproject_Drift.git

Deployment Link: https://drift-indol-eight.vercel.app/


NEBULA NFA — THE AUTOMATA MAZE

A complete college microproject built with only HTML, CSS and vanilla JavaScript.

RUN:
1. Extract the folder.
2. Open index.html in Chrome/Edge/Firefox.
3. No server, installation, internet or dependencies are required.

CONTROLS:
- Click 0/1/A/B or use keyboard 0/1/A/B.
- START / Enter begins simulation.
- NEXT STEP advances one NFA input symbol.
- AUTO PLAY or Space advances automatically.
- CLEAR resets the input.
- ↻ starts a NEW GAME with a freshly generated valid NFA.

LEVELS:
1. NFA Basics — states, transitions, input symbols and accepting states.
2. Multiple Paths — true nondeterminism: one input symbol can lead to multiple states.
3. ε-Transitions — real epsilon closure.
4. Branching Paths — several simultaneous branches.
5. Dead States — dead branches terminate while valid paths continue.

CORE IMPLEMENTATION:
- Procedural constrained NFA generation in JavaScript.
- New valid automaton on every NEW GAME.
- Stable automaton during RUN / NEXT STEP / AUTO PLAY.
- Automaton ID for each generated graph.
- states, transitions, start state and accept states.
- Multiple destinations for the same input symbol.
- Real epsilon closure.
- Step-by-step simulation.
- Active-state and active-transition highlighting.
- Input-character progress.
- Compact path trace.
- Acceptance / rejection statistics.
- Level unlocking stored in browser localStorage.
- Smart predefined graph layouts to keep generated diagrams readable.
- Opposite-direction transitions are drawn on separate curves so their arrowheads and labels are easier to distinguish.

IMPORTANT:
The generated NFAs are validated before use. The generator guarantees a reachable accepting path, valid transition references, no duplicate transitions, supported symbols and a readable graph structure.
