# Numbering

- The main path is **1, 2, 3**, drawn as circled numerals (①-⑳, then ㉑-㉟, ㊱-㊿, then (51)).
- Where a decision forks, its other paths are numbered **5.1, 5.2**. The number names the *branch*, not the position: every step in the 5.1 path carries **5.1**.
- A deeper number appears only when a step inside a path is itself a fork: **10.1** splits into **10.1.1** and **10.1.2**. Inside a path, if no connector is marked as the main line, every path out of the fork is numbered.
- **Never number a terminator**, an entry channel, a jump marker or a note.
- The connector that starts a numbered path carries the number: "5.1 · Declines". Main-path outputs keep their plain label ("Yes").
- Branch order at a fork follows the page: higher first, then left to right (drawing order when nothing is placed yet).
- Numbers are worked out every time the diagram is drawn, so editing the main path renumbers every later branch as part of the edit. Never type numbers by hand.
- A path that runs into a step that already belongs to another path is a **join**: it keeps its arrow and adds no number.
- **Marking a path as the main line changes the numbers.** Mark one path out of a fork as primary (`update_edge isPrimary`) and it keeps its parent's number while the other path takes the next one (7.1 and 7.1.1). Leave none marked and every path is numbered (7.1.1 and 7.1.2). Both are valid; the build check no longer asks for a main line when every path out of a Process Map fork has a label.
