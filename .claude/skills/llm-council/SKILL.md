---
name: llm-council
description: Guides running a "council of LLMs" deliberation pattern — dispatch the same prompt to several models from different providers, have each model anonymously review and rank the others' answers, then synthesize a final response with a chairman model. Use when a question benefits from multiple independent model perspectives, when reducing single-model bias/hallucination risk matters, for high-stakes research judgments, model-as-judge evaluation, or building consensus/voting systems across LLMs. Do not use for latency-sensitive or low-stakes queries where one well-chosen model is sufficient.
version: 1.0.0
author: yuda
license: MIT
tags: [Agents, Multi-Model, Ensembling, LLM-as-Judge, Consensus, Evaluation, Orchestration, Bias Reduction]
dependencies: [openai>=1.0.0, anthropic>=0.40.0]
---

# LLM Council

A structured pattern for getting a decision or answer from *several* LLMs
instead of one, so the final output reflects cross-model agreement rather
than a single model's blind spots, hallucinations, or stylistic quirks.
Popularized as a self-hosted pattern ("council of models" / "chairman
synthesis") for research judgment calls and high-stakes Q&A.

## When to use this skill

**Use an LLM council when:**
- The question is judgment-heavy and a single model's answer is hard to
  independently verify (open research questions, ambiguous code review
  calls, "which approach is better" tradeoff analysis)
- You are building an LLM-as-judge evaluation pipeline and want to reduce
  the judge's own bias by cross-checking against other judges
- You want a defensible, auditable answer — the ranked transcript itself
  is evidence of *why* the final answer was chosen
- Errors are costly and worth the extra latency/cost of N model calls
  instead of 1

**Do NOT use this skill when:**
- The task is a simple factual lookup, deterministic transformation, or
  narrow coding task — one capable model is faster and cheaper
- Latency matters (interactive UI, live user-facing chat) — council rounds
  take multiple sequential LLM calls
- You only have access to one model/provider — a "council" of identical
  models under the same weights correlates its errors and mostly
  reproduces self-preference bias rather than independent judgment (see
  `references/bias-mitigation.md`)

## The three-stage pattern

```
Stage 1: DISPATCH          Stage 2: PEER REVIEW           Stage 3: CHAIRMAN
┌─────────────┐            ┌──────────────────┐           ┌────────────────┐
│ same prompt │  ────────► │ anonymize answers │  ───────► │ synthesize      │
│ → N models  │            │ each model ranks  │           │ final answer    │
│ (parallel)  │            │ all answers blind │           │ from responses  │
└─────────────┘            └──────────────────┘           │ + rankings      │
                                                            └────────────────┘
```

### Stage 1 — Dispatch

Send the identical prompt to every council member in parallel. Council
members should be **heterogeneous** — different providers/model families
(e.g. one Anthropic, one OpenAI, one Google/open-weight model), not the
same model called three times. Same-model repeats mostly just re-sample
temperature noise, not independent judgment.

In Claude Code, if you don't have direct API access to other providers,
approximate diversity by varying persona/instructions strongly across
parallel `Agent` tool calls (e.g., "argue from a systems-reliability
perspective" vs "argue from a research-novelty perspective" vs "argue
as a skeptical reviewer looking for flaws") — this is weaker than true
model diversity but still surfaces perspectives a single pass misses.
Prefer real multi-provider calls (see `templates/council.py`) whenever
API keys for multiple providers are available.

### Stage 2 — Anonymous peer review

Before showing responses to any reviewing model:
1. Strip all identifying information (model name, formatting tells,
   signature phrasing) from each response as much as practical.
2. Assign each response a neutral label (`Response A`, `Response B`, ...)
   in an order that is **shuffled per reviewer** — never a fixed order,
   or you introduce position bias (see `references/bias-mitigation.md`).
3. Ask each council member to rank all responses (including, unknowingly,
   its own) on explicit criteria: factual accuracy, reasoning quality,
   completeness, and honesty about uncertainty. Require a short
   justification per ranking, not just a number — justifications are what
   make the transcript auditable.
4. Collect the rankings. Do not let a model see other models' rankings
   before submitting its own (no cross-talk mid-review).

### Stage 3 — Chairman synthesis

A designated chairman model (can be one of the council members, or a
separate stronger model) receives:
- The original prompt
- All (anonymized) responses
- All peer rankings + justifications

It synthesizes a final answer that explicitly reconciles disagreement
("Response B and C agreed on X; Response A's objection about Y is valid
and is incorporated below") rather than picking one response verbatim.
The chairman's job is synthesis, not popularity-contest tallying — see
`references/aggregation-methods.md` for when a numeric aggregate (Borda
count, weighted vote) is more appropriate than free-text synthesis.

## Quick start

```bash
pip install openai anthropic
export OPENAI_API_KEY=...
export ANTHROPIC_API_KEY=...
python templates/council.py --prompt "Should we use optimistic or pessimistic locking for this booking system?"
```

See `templates/council.py` for a runnable reference implementation
(async, provider-agnostic via a thin client wrapper, JSON transcript
output).

## Aggregating the verdict

Once every reviewer has ranked every response, pick an aggregation method
appropriate to the stakes:

| Method | When to use |
|---|---|
| Chairman free-text synthesis | Open-ended questions where the best answer is a synthesis, not a single existing response |
| Borda count / rank aggregation | You need a single winning response, not a blend |
| Majority vote on a binary/discrete choice | The question reduces to a small set of discrete options (approve/reject, A vs B) |
| Elo-style pairwise updates | Running a council repeatedly over many items and want calibrated model-strength estimates over time |

Full details and formulas: `references/aggregation-methods.md`.

## Known failure modes

- **Self-preference bias**: models tend to rate their own (anonymized)
  output higher than peers rate it. Mitigate by excluding a model's
  self-ranking from the aggregate score, or by tracking and reporting the
  gap between self-rank and peer-rank.
- **Verbosity bias**: longer answers get ranked higher independent of
  correctness. State explicitly in the review prompt that length is not
  a merit criterion.
- **Position bias**: first-listed or last-listed response gets
  disproportionate preference. Shuffle order per reviewer.
- **Correlated errors**: models trained on similar data/RLHF recipes
  share blind spots; a council is not a substitute for a human expert
  check on genuinely novel or safety-critical claims.
- **Cost/latency blowup**: a naive council is O(N) generation calls +
  O(N²) review calls (each model reviews every response). For N > 4,
  consider sampling reviewer pairs rather than full round-robin.

See `references/bias-mitigation.md` for mitigations in more depth.

## References

- **[Aggregation Methods](references/aggregation-methods.md)** — Borda count, majority vote, Elo updates, when to use each
- **[Bias Mitigation](references/bias-mitigation.md)** — self-preference, position, and verbosity bias, anonymization checklist
- **[templates/council.py](templates/council.py)** — runnable async multi-provider council implementation
