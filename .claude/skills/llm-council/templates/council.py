#!/usr/bin/env python3
"""Reference implementation of the three-stage LLM council pattern.

Stage 1 (dispatch)    -> query every council member with the same prompt, in parallel
Stage 2 (peer review) -> each member ranks every anonymized response, in parallel
Stage 3 (chairman)    -> a chairman model synthesizes a final answer from
                         the responses and rankings

Usage:
    pip install openai anthropic
    export OPENAI_API_KEY=...
    export ANTHROPIC_API_KEY=...
    python council.py --prompt "Should we use optimistic or pessimistic locking here?"

Only providers whose API key is present in the environment are used, so
this also runs with a single provider (degrading to same-model repeats --
see references/bias-mitigation.md for why that's weaker than a true
multi-provider council).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import string
from dataclasses import dataclass, field


@dataclass
class CouncilMember:
    name: str
    call: "callable"  # async (prompt: str) -> str


@dataclass
class Response:
    member: str
    text: str
    label: str = ""  # assigned per-review, e.g. "Response A"


@dataclass
class Review:
    reviewer: str
    ranking: list[str] = field(default_factory=list)  # response labels, best -> worst
    justification: str = ""


async def _call_openai(model: str, prompt: str) -> str:
    from openai import AsyncOpenAI

    client = AsyncOpenAI()
    resp = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.choices[0].message.content or ""


async def _call_anthropic(model: str, prompt: str) -> str:
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic()
    resp = await client.messages.create(
        model=model,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    return "".join(block.text for block in resp.content if block.type == "text")


def build_council() -> list[CouncilMember]:
    """Only includes members whose provider API key is set."""
    members: list[CouncilMember] = []
    if os.environ.get("ANTHROPIC_API_KEY"):
        members.append(CouncilMember(
            name="claude",
            call=lambda p: _call_anthropic("claude-sonnet-4-5", p),
        ))
    if os.environ.get("OPENAI_API_KEY"):
        members.append(CouncilMember(
            name="gpt",
            call=lambda p: _call_openai("gpt-4o", p),
        ))
    if not members:
        raise SystemExit(
            "No provider API keys found. Set ANTHROPIC_API_KEY and/or OPENAI_API_KEY."
        )
    return members


async def stage1_dispatch(members: list[CouncilMember], prompt: str) -> list[Response]:
    results = await asyncio.gather(*(m.call(prompt) for m in members))
    return [Response(member=m.name, text=text) for m, text in zip(members, results)]


def _labels(n: int) -> list[str]:
    return [f"Response {c}" for c in string.ascii_uppercase[:n]]


def _review_prompt(original_prompt: str, shuffled: list[Response]) -> str:
    body = "\n\n".join(f"### {r.label}\n{r.text}" for r in shuffled)
    return f"""You are one reviewer on a council of independent evaluators. \
You do not know which model produced which response below -- evaluate on \
merit only.

Original question:
{original_prompt}

Candidate responses:
{body}

Rank all {len(shuffled)} responses from best to worst on: factual accuracy, \
reasoning quality, completeness, and honesty about uncertainty. Length and \
formatting are NOT merit criteria -- a short correct answer should outrank \
a long answer padded with irrelevant material.

Respond with strict JSON only, no other text:
{{"ranking": ["Response X", "Response Y", ...], "justification": "one paragraph explaining the ranking"}}
"""


async def stage2_peer_review(
    members: list[CouncilMember], prompt: str, responses: list[Response]
) -> list[Review]:
    async def review_one(member: CouncilMember) -> Review:
        shuffled = responses.copy()
        random.shuffle(shuffled)
        for r, label in zip(shuffled, _labels(len(shuffled))):
            r.label = label
        raw = await member.call(_review_prompt(prompt, shuffled))
        try:
            parsed = json.loads(raw)
            return Review(
                reviewer=member.name,
                ranking=parsed["ranking"],
                justification=parsed.get("justification", ""),
            )
        except (json.JSONDecodeError, KeyError):
            return Review(reviewer=member.name, ranking=[], justification=f"[unparseable] {raw[:200]}")

    return await asyncio.gather(*(review_one(m) for m in members))


def _chairman_prompt(prompt: str, responses: list[Response], reviews: list[Review]) -> str:
    label_map = {r.label: r for r in responses if r.label}
    responses_block = "\n\n".join(
        f"### {r.label} (from {r.member})\n{r.text}" for r in responses
    )
    reviews_block = "\n\n".join(
        f"Reviewer {rv.reviewer} ranked: {rv.ranking}\nJustification: {rv.justification}"
        for rv in reviews
    )
    return f"""You are the council chairman. Synthesize a final answer from \
the independent responses and peer reviews below. Identify points of \
agreement, adjudicate disagreements using the justifications (not just \
vote counts), and note which response(s) contributed which parts of your \
synthesis so the result stays auditable.

Original question:
{prompt}

Responses:
{responses_block}

Peer reviews:
{reviews_block}

Produce the final synthesized answer.
"""


async def stage3_chairman(chairman: CouncilMember, prompt: str, responses: list[Response], reviews: list[Review]) -> str:
    return await chairman.call(_chairman_prompt(prompt, responses, reviews))


def borda_count(reviews: list[Review]) -> dict[str, int]:
    scores: dict[str, int] = {}
    for review in reviews:
        n = len(review.ranking)
        for i, label in enumerate(review.ranking):
            scores[label] = scores.get(label, 0) + (n - 1 - i)
    return scores


async def run_council(prompt: str) -> dict:
    members = build_council()
    responses = await stage1_dispatch(members, prompt)
    reviews = await stage2_peer_review(members, prompt, responses)
    chairman = members[0]
    final_answer = await stage3_chairman(chairman, prompt, responses, reviews)
    scores = borda_count(reviews)

    return {
        "prompt": prompt,
        "responses": [{"member": r.member, "label": r.label, "text": r.text} for r in responses],
        "reviews": [
            {"reviewer": rv.reviewer, "ranking": rv.ranking, "justification": rv.justification}
            for rv in reviews
        ],
        "borda_scores": scores,
        "chairman": chairman.name,
        "final_answer": final_answer,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run an LLM council on a prompt.")
    parser.add_argument("--prompt", required=True, help="The question to put to the council.")
    parser.add_argument("--out", default=None, help="Optional path to write the full JSON transcript.")
    args = parser.parse_args()

    result = asyncio.run(run_council(args.prompt))

    if args.out:
        with open(args.out, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Full transcript written to {args.out}")

    print("\n=== FINAL ANSWER ===\n")
    print(result["final_answer"])
    print("\n=== BORDA SCORES ===\n")
    print(json.dumps(result["borda_scores"], indent=2))


if __name__ == "__main__":
    main()
