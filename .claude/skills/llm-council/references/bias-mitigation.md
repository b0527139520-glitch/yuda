# Bias Mitigation

A council is only as trustworthy as its review stage. These are the
biases that most commonly invalidate council results, and concrete
mitigations for each.

## Self-preference bias

Models systematically rate their own (even anonymized) output higher
than independent human or cross-model judges do — the style, phrasing,
and reasoning structure a model produces is the structure it's most
"comfortable" scoring highly, even without knowing it wrote it.

**Mitigations:**
- When aggregating scores (Borda count, average rank), **exclude a
  model's ranking of its own response** from that response's score.
  You know which response came from which model even though reviewers
  don't — use that to filter, not to inform reviewers.
- Track the gap between a model's self-rank and its peer-average-rank
  across many council runs. A consistently large gap tells you that
  model's self-assessment can't be trusted standalone in other contexts
  (e.g. self-critique loops without a council).
- If feasible, have each model review only the *other* responses (never
  including its own in the batch it ranks) rather than relying on
  post-hoc exclusion. This is cleaner but requires generating a
  per-reviewer response subset, which adds bookkeeping.

## Position bias

Responses placed first (or, with some models, last) in the review prompt
get a systematic boost independent of quality — an artifact of how
transformers attend over long contexts.

**Mitigations:**
- Shuffle the order of anonymized responses **independently for every
  reviewer** — never reuse the same `Response A/B/C/D` ordering across
  reviewers.
- For high-stakes councils, run each review twice with the order
  reversed and check whether the ranking flips. A ranking that survives
  order reversal is much more trustworthy than one that doesn't.

## Verbosity bias

Longer, more hedged, more structured (bullet points, headers) responses
tend to be rated higher independent of correctness — reviewers conflate
"thorough-looking" with "correct."

**Mitigations:**
- State explicitly in the review prompt: "Length and formatting are not
  merit criteria; a short correct answer should outrank a long answer
  that includes irrelevant or incorrect material."
- Consider normalizing response formatting before review (same structure,
  no bullet/header differences) so the *content* is what's compared, not
  presentation. Only do this if it doesn't strip content — reformatting
  should never delete substance.

## Anchoring / groupthink

If a reviewer sees other reviewers' rankings before finalizing its own,
it anchors on the earlier verdict instead of forming an independent
judgment — this defeats the purpose of having multiple reviewers.

**Mitigations:**
- Collect all reviews **in parallel**, not sequentially with visibility
  into prior reviews. The three-stage pattern in SKILL.md is explicit
  about this: no cross-talk mid-review.
- If you do want a deliberation round (reviewers see each other's
  rankings and can revise), keep it as an explicit *fourth* stage after
  the blind first pass, and log both the blind and post-deliberation
  rankings separately — collapsing them loses the signal of how much
  groupthink shifted the outcome.

## Correlated failure across same-family models

Two models fine-tuned from similar base weights, or trained with similar
RLHF recipes, tend to share blind spots and biases. A "council" of three
models from the same provider/family is much closer to querying one
model three times than to genuine independent judgment.

**Mitigations:**
- Prefer council members from different providers/training lineages.
- If only same-family models are available, treat the council's output
  as reducing *variance* (sampling noise, one-off hallucinations) but
  explicitly not as reducing *bias* — don't claim the council result is
  more objective than a single call from that family, only more stable.

## Anonymization checklist

Before sending responses to reviewers, strip or normalize:
- [ ] Model self-identification ("As an AI developed by...", signature
      sign-offs)
- [ ] Distinctive formatting fingerprints if you're worried about
      reviewers guessing authorship from style (optional — often not
      worth the effort since content matters more than style-based
      guessing)
- [ ] Any metadata field (timestamps, token counts, model name) attached
      to the response object
- [ ] A consistent, freshly-shuffled `Response A/B/C/...` labeling
      per reviewer call
