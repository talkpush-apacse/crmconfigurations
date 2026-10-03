# TA / BPO gap check

Run `run_gap_check`. Output tiers:

- **Blocker**: list it and stop. The diagram cannot be built or configured honestly without an answer.
- **Assumption**: write "Assumed [thing] because [reason]. If incorrect, [what changes]."
- **Nice to know**: mention briefly.

Emoji and tiers are for the SE-facing summary, never text inside a diagram shape.

Rules the tool checks: no entry channel; decision paths without a label; integrations with no named system; manual steps with no role or no turnaround time; steps that lead nowhere; paths with no failure route (outside system, no answer); loops with no limit; voice or AI steps with no earlier disclosure or recording consent; no consent to use candidate data; and the usual Talkpush patterns when relevant (prescreening drop-off recovery 1H/3H/24H/36H/48H/72H then Unresponsive after 15 days and Rejected after 30; interview no-show recovery with a 48H reminder; attribute-driven routing; reprofiling usually capped at 3; round-robin assignment; job-offer disposition; channel ownership / cooling period, commonly 90/30 days: confirm per client).

You may add judgement the rules cannot: ask about volume, timezone and locale signals, who owns a hand-off, and parallel versus sequential steps. State your confidence.
