# Research: Reddit Data API for interview threads

Ticket: #24 (child of the Personal v1 spec map, #3; follow-up to #18). Researched 2026-10-29. This is not legal advice.

**How the sources were read.** Claude Code's fetcher refuses `redditinc.com` and `reddit.com`, Anthropic's web search won't query them (Reddit blocks Anthropic's agents), and the Reddit help center (`support.reddithelp.com`) returns 403 to the fetcher. So the help-center pages were read **through web-search excerpts of those exact pages**, not as full pages. Spoofing a browser to get past the block was not attempted. The shutdown timeline is confirmed by the official changelog's excerpt and by several news reports that quote the r/redditdev announcement. Re-read the full pages in a browser before relying on any single clause.

## Short answer

**No. Don't build on the Reddit Data API.** Three findings, each enough on its own:

1. **The public Data API is closing.** Reddit's [Changelog - October 8, 2026](https://support.reddithelp.com/hc/en-us/articles/54353370049684-Changelog-October-8-2026) says: "October 31, 2026: New requests for public API access will no longer be accepted. January 12, 2027: API access removal begins for apps and users that haven't registered or responded to Reddit's outreach. March 2027: Remaining public API access ends." The stated exemptions are for "partners with written agreements in place" (per [PPC Land](https://ppc.land/reddit-to-halt-public-data-api-access-in-march-2027-as-14-000-apps-register/), quoting Reddit). No exemption for personal scripts was found.
2. **Access is no longer self-serve, and hasn't been since late 2025.** The [Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy) says: "Approval is required: You must request access and get explicit approval before accessing any Reddit data through our API." It applies to "everyone — whether you're a developer, moderator, researcher, or an app". With two days left before new requests close (2026-10-31), a new app isn't realistic.
3. **The replacement doesn't fit this app.** The Developer Platform (Devvit) runs apps *on Reddit's servers*, for communities: event-triggered tasks, Reddit-hosted storage, outbound requests only to approved domains ([WinBuzzer](https://winbuzzer.com/2026/10/01/reddit-to-end-feed-reader-updates-and-public-api-access-for-apps-a002-xcxwbn/) summary of the r/redditdev post). It is not a way for an off-Reddit Next.js app to pull threads into Claude prompts. Reddit's own [App Migration Program terms](https://support.reddithelp.com/hc/en-us/articles/47822311698452-Reddit-Developer-Platform-App-Migration-Program-2026-Terms) target apps that "provide essential utility or moderation functionality for Reddit communities".

**Recommendation:** keep #18's plan. Reddit threads come in as **Owner-pasted text**, which the Owner reads in their own browser. Use web search only to surface "go read this yourself" links (if Anthropic's index returns Reddit hits at all; unverified). Commercial access later would mean a negotiated data licence with Reddit, which is out of scope for v1.

## Findings by question

### Personal use and rate limits

- **Personal use is gated, not self-serve.** The help page [Developer Platform & Accessing Reddit Data](https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data) lists a separate "sign-up for the Data API for non-commercial purposes". Your App Review answers decide whether you're approved for commercial or non-commercial use. "Commercial" includes use "by a business or on behalf of a business, or as part of a monetized product or service", and needs Reddit's written permission.
- The Responsible Builder Policy also bars "registering multiple accounts or submitting multiple requests for the same use case".
- **Rate limit** (for apps that already have access), from the [Reddit Data API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki): free tier "100 queries per minute (QPM) per OAuth client id", averaged over a rolling window (currently 10 minutes). Unauthenticated traffic is blocked, and usage is reported in the `X-Ratelimit-Used`, `X-Ratelimit-Remaining` and `X-Ratelimit-Reset` headers. The RBP: "You must not circumvent or exceed access limits or engage in excessive usage that disrupts our APIs." For one Owner, that limit was never the problem. Approval and the shutdown are.

### AI / LLM use: training vs prompting

- **Training is explicitly barred without consent.** The RBP says: "You must not sell, license, share, or otherwise commercialize Reddit data without express written approval. This extends to commercial and non-commercial mining, scraping, or using data for purposes like ads targeting or to train machine learning or AI models." Reddit's developer FAQ says: "You may not use content on Reddit as an input for any model training without explicit consent from Reddit. Commercial use of any model trained with Reddit data is prohibited without explicit approval." The 2023 Developer Terms (reported by [The Register](https://www.theregister.com/2023/04/18/reddit_charging_ai_api/)) bar using Reddit Services and Data "through any means to train large language, artificial intelligence, or other algorithmic models".
- **Prompting / inference is not spelled out** in the excerpts found. But two things weigh against it: the RBP's ban on *sharing* Reddit data without approval (sending threads to Anthropic's API is arguably sharing with a third party), and reporting that "AI assistants using Reddit to answer questions will need commercial deals once public access ends" (PPC Land, citing TechCrunch). Treat feeding API-obtained Reddit content to an LLM as needing Reddit's approval. Owner-pasted text is a different case (see Risks).

### Storage, retention and deletion

- The Data API Wiki says: "we strongly recommend routinely deleting any stored user data and content within 48 hours. Note that retention of content and data that has been deleted — even if disassociated, de-identified or anonymized — is a violation of our terms and policies." Also: "When posts and comments are deleted, you must delete all content related to the post and/or comment". When an account is deleted, its author identifiers must be removed.
- On termination (Data API Terms, via search excerpt): "immediately stop using the Reddit APIs, delete any cached or stored content that was permitted or transferred via the Reddit APIs".
- The effect for this app: storing a thread inside an Interview Brief or Prep Task for weeks would conflict with the 48-hour guidance and the duty to propagate deletions. Each stored excerpt would need regular re-checks against the API, which itself ends in March 2027.

### One Owner now, many Owners later

- **Single-Owner:** blocked anyway (approval gate, closing intake, shutdown in March 2027).
- **Multi-Owner product:** if monetized, it's a "commercial" use under the help-center definition and needs a written agreement or licence. Reddit says data licensees must use a Compliance API to propagate deletions, and that its existing licensing deals continue. That is a business negotiation, not an API key. Building v1 on Reddit wouldn't carry over. It would have to be removed.

## Risks and open items

- **Owner-pasted Reddit text.** The User Agreement's scraping ban (see #18) targets automated access. A person reading a thread and pasting excerpts into their own private notes, then asking Claude about them, is ordinary personal use. The RBP covers *API* data. Keep pasted text private to the Owner and never use it for training. For a multi-Owner product, reconsider whether storing and processing users' pasted Reddit content at scale is still "personal".
- **Unverified (pages not loaded in full):** the exact current wording of the Data API Terms (revised 2026-07-20, per #18) and the Developer Terms on LLM *inference*; whether already-approved personal "script" apps get any reprieve past March 2027; the full text of the October 8 changelog. Check the [r/redditdev announcement](https://www.reddit.com/r/redditdev/comments/1wubcvf/moving_data_api_apps_to_the_developer_platform/) in a browser.
- **Anthropic API data use** (inputs aren't used for training by default under commercial terms) wasn't re-checked here. It matters only if Reddit content is ever sent under an approval that permits inference but not training.
