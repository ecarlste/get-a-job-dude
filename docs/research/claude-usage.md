# Research: Using Claude from the app

Ticket: #8. Researched 2026-10-29 against primary sources. Prices are USD, Claude API first-party rates.

## 1. Subscription (Pro/Max) vs. API key

**Short answer: the app must use an API key (Claude Console) with separate, pay-as-you-go billing.** The Owner's Pro/Max subscription can't power a self-built app.

- Agent SDK overview: "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods..." Use of the SDK falls under the Commercial Terms. https://code.claude.com/docs/en/agent-sdk/overview
- Claude Code Legal and compliance: OAuth (subscription) authentication "is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications." "Developers building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication through Claude Console." It also says Anthropic "may" enforce this "without prior notice". https://code.claude.com/docs/en/legal-and-compliance
- Consumer Terms (which cover Pro/Max) forbid accessing the Services "through automated or non-human means, whether through a bot, script, or otherwise", "Except when you are accessing our Services via an Anthropic API Key". https://www.anthropic.com/legal/consumer-terms
- The same compliance page lets the key owner configure their own API key in a secrets manager or other environment "for use by the customer's own authorized users", as long as usage is billed to the key owner. One Owner-held key serving the Owner and the Viewer fits that wording. https://code.claude.com/docs/en/legal-and-compliance

A background service that classifies email, triggered by a server rather than a person at a terminal, is "automated" use. A subscription token in a self-built app would be one of the "single-person shortcuts" the map rules out. The one exception the docs allow is the Owner signing in to the *unmodified* Claude Code CLI with their own subscription for hands-on use, such as running a prep session by hand. Those docs describe that as "ordinary, individual usage" (same page), not as something the app can call.

## 2. Models that fit each use

From https://platform.claude.com/docs/en/about-claude/pricing (per million tokens, MTok):

| Model | ID | Input | 5m cache write | Cache hit | Output | Fit |
|---|---|---|---|---|---|---|
| Claude Haiku 5.5 (prompts up to 100K) | `claude-haiku-5-5` | $0.10 | $0.125 | $0.01 | $0.50 | Is-this-job-related filter, Proposal extraction (Phase/date/contact) |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | $2 | $2.50 | $0.10 | $10 | Drafts; fallback for emails Haiku is unsure about |
| Claude Opus 5.5 | `claude-opus-5-5` | $4 | $5 | $0.20 | $20 | Interview prep: research synthesis, likely questions, practice Interviews; top-quality Drafts |

- Haiku 5.5 costs more on prompts over 100K tokens ($0.50 in / $2.50 out). That won't happen for single emails.
- The Batch API takes 50% off input and output, but results arrive asynchronously, so use it only where latency doesn't matter (for example, a nightly re-scan). Same pricing page.

## 3. Rough monthly cost at the Owner's volume

Assumptions: 50 emails/day (the high end) x 30 days = 1,500 emails/month. 5 Drafts/day = 150/month. 3 prep sessions/week = about 13/month. Token counts are estimates, not measurements.

| Use | Model | Per-unit assumption | Monthly |
|---|---|---|---|
| Email filter + Proposal extraction (one call per email) | Haiku 5.5 | ~3K in (1K cached system prompt/schema + 2K email), ~200 out | ~$0.60 (4.5M in x $0.10 + 0.3M out x $0.50). The same workload on Sonnet 5.5 is ~$12 |
| Drafts | Sonnet 5.5 | ~8K in (thread + loop context), ~800 out | ~$3.60 (1.2M x $2 + 0.12M x $10). On Opus 5.5 ~$7.20 |
| Interview prep (research + likely questions + one practice Interview) | Opus 5.5 + web search | ~150K in (mostly search results), ~10K out, ~15 searches; practice Interview ~30 turns on a cached prefix | ~$1-2/session, so ~$15-25 |
| **Total** | | | **~$20-30/month**, dominated by prep |

Ways to cut cost:
- **Prompt caching**: keep the system prompt, Proposal schema, and Owner/loop context as a stable prefix. A cache hit costs 0.1x base input on Haiku and 0.05x on Sonnet/Opus 5.5. This saves the most in multi-turn practice Interviews, which resend the whole history on every turn. https://platform.claude.com/docs/en/about-claude/pricing
- **Batch** (-50%): only for non-urgent email backfills. The live email path needs low latency to raise Proposals promptly.
- Setting a spend limit in the Console caps the risk. Pay-as-you-go means a quiet month costs only a few dollars.

## 4. Relevant capabilities

- **Web search tool** (server-side, `web_search_20260209` on Opus/Sonnet 5.5): $10 per 1,000 searches plus tokens, and "Web search results retrieved throughout a conversation are counted as input tokens". https://platform.claude.com/docs/en/about-claude/pricing. It supports `allowed_domains`/`blocked_domains` and `max_uses`. A companion `web_fetch` tool reads specific URLs, such as a company careers page or an interviewer's public profile.
- **Structured outputs**: `output_config.format` (JSON schema) guarantees "valid, parseable JSON that matches your schema", and `strict: true` on a tool validates its inputs. Supported on Haiku/Sonnet/Opus 5.5. https://platform.claude.com/docs/en/build-with-claude/structured-outputs. This fits Proposal extraction well: the model returns `{ job_related, proposals: [{ kind, loop, phase, date, ... }] }`, and the app shows it as a Proposal for the Owner to accept, edit, or reject.
- On the 5.5 models, forced `tool_choice` (`any`/`tool`) returns a 400. Use structured outputs or `auto` + `strict` instead.
- **Integration surface**: the plain Client SDK (`@anthropic-ai/sdk`, Node) covers all three uses. The Agent SDK (Claude Code as a library) has built-in WebSearch/WebFetch and an agent loop, but it is optimized for filesystem/coding agents. Both need an API key in the app. https://code.claude.com/docs/en/agent-sdk/overview

## Options for the decision

1. **API key, mixed models** (Haiku for email, Sonnet for Drafts, Opus for prep). Roughly $20-30/month at the volume above. Compliant, and per-Owner keys keep a future product open.
2. **API key, one model everywhere** (for example Sonnet 5.5, or Opus 5.5 at lower effort). Simpler, one cache namespace, roughly $30-50/month.
3. **Hybrid**: API key for everything automated (email, Proposals, Drafts). The Owner runs deep prep by hand in Claude.ai / the unmodified Claude Code CLI on the subscription and pastes the results into the app. Cheapest API bill, but prep lives partly outside the app.
4. **Ask Anthropic for approval** to use subscription login (the SDK note says "Unless previously approved"). Unlikely to be worth it for a personal app, and it doesn't serve the Nov 13 deadline.

## Unverified / caveats

- Token counts per email, Draft, and prep session are guesses. Measure them with `count_tokens` once real prompts exist.
- The forced-`tool_choice` 400 note and the `web_search_20260209` / `web_fetch` details come from Anthropic's claude-api skill reference, not from a page fetched for this note.
- Whether a Viewer using features that call Claude counts as the key owner's "own authorized users" is my reading of the compliance page, not an explicit ruling.
