# Aggregation Methods

How to turn N responses + a matrix of peer rankings into a single verdict.
Pick the method that matches what you actually need out of the council:
a synthesized answer, a single winner, a discrete decision, or a
long-run reliability estimate per model.

## Chairman free-text synthesis

**Use when** the ideal output isn't any single response but a blend —
most open-ended technical or research questions.

The chairman model is given the original prompt, every anonymized
response, and every reviewer's ranking + justification, then asked to:
1. Identify points of agreement across responses (high-confidence claims)
2. Identify points of disagreement and adjudicate using the
   justifications, not just the vote count
3. Note any claim only one response made that the others may have missed,
   and independently assess whether it's still worth including
4. Produce a final answer that cites which response(s) contributed which
   parts, so the synthesis stays auditable

This is the default for the three-stage pattern in SKILL.md.

## Borda count / rank aggregation

**Use when** you need to pick exactly one winning response (e.g.
selecting the best of N candidate PR descriptions, the best of N
proposed fixes) rather than blending them.

For each reviewer's ranked list of N responses, assign points:
1st place = N-1 points, 2nd = N-2, ..., last = 0 points. Sum points for
each response across all reviewers (excluding a response's own
self-ranking — see `bias-mitigation.md`). Highest total wins.

```python
def borda_count(rankings: list[list[str]]) -> dict[str, int]:
    """rankings: one ordered list (best→worst) of response IDs per reviewer."""
    scores: dict[str, int] = {}
    for ranking in rankings:
        n = len(ranking)
        for i, response_id in enumerate(ranking):
            scores[response_id] = scores.get(response_id, 0) + (n - 1 - i)
    return scores
```

Borda count is robust to a single reviewer's outlier ranking (unlike
majority vote) but assumes rank *intervals* are roughly comparable across
reviewers, which is a real approximation — a reviewer that ranks
everything 1-2-3-4 in a near-tie contributes the same point spread as one
with strong opinions.

## Majority vote

**Use when** the question reduces to a small set of discrete choices
(approve/reject, ship A vs ship B, flag/don't-flag) rather than ranking
open-ended prose.

Each reviewer casts one vote for the discrete option it judges best;
tally and take the plurality. Record dissent explicitly — a 2-1 split is
a materially weaker signal than 5-0, and that should propagate to
whatever downstream decision consumes the council's output (e.g. "flag
for human review if not unanimous").

## Elo-style pairwise updates

**Use when** you run councils repeatedly over many items (e.g. an
ongoing eval harness) and want a calibrated, comparable strength estimate
per model over time, not just a one-off verdict.

Treat each pairwise ranking within a single review (response A ranked
above response B by reviewer X) as one Elo "match" between the *models*
that produced A and B, and update ratings with the standard Elo formula:

```python
def elo_update(rating_winner: float, rating_loser: float, k: float = 32) -> tuple[float, float]:
    expected_winner = 1 / (1 + 10 ** ((rating_loser - rating_winner) / 400))
    delta = k * (1 - expected_winner)
    return rating_winner + delta, rating_loser - delta
```

Run this update for every pairwise comparison implied by each reviewer's
full ranking (a ranking of N responses implies C(N,2) pairwise
comparisons). Over many council runs this produces a leaderboard that's
far more informative than any single verdict, and is the right tool if
the actual goal is "which model should we default to," not "what's the
answer to this one question."

## Combining methods

These aren't mutually exclusive. A common setup: use Borda count or
majority vote as a fast automated gate (e.g. auto-merge if consensus is
unanimous and score gap is large), fall back to chairman free-text
synthesis when the vote is split or scores are close, and log every
pairwise comparison into a running Elo table regardless, so you build up
model-reliability data for free even when councils only run occasionally.
