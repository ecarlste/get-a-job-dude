# Inbound email provider for forwarded job mail

Research for [#17](https://github.com/ecarlste/get-a-job-dude/issues/17), following decision [#12](https://github.com/ecarlste/get-a-job-dude/issues/12) (forward job mail to a per-Owner unguessable inbound address; the app reads `Message-ID`/`References` and Gmail's forwarding markers).

All sources were read on **2026-10-29** unless stated otherwise. Anything not confirmed from a first-party page is marked **Unverified**.

## What the app needs

1. **Cost:** free, or close to it, at personal volume (tens to low hundreds of messages a month).
2. **Address:** one unguessable address per Owner that can be rotated, through plus-addressing or a catch-all. It must work for many Owners, not just one.
3. **Payload:** the raw RFC 822 message, or at least every header (`Message-ID`, `References`, `X-Forwarded-For`, `X-Forwarded-To`), delivered to a webhook on Vercel Hobby.
4. **Confirmation:** the Owner can see Gmail's forwarding-confirmation message.
5. **Domain:** whether the option needs a custom domain. None has been chosen yet.

## Constraints from the platform and from Gmail

- **Vercel request body limit:** a Vercel Function accepts at most **4.5 MB** of request body. Larger bodies get `413 FUNCTION_PAYLOAD_TOO_LARGE`. Hobby functions can run for up to 300 s. ([Vercel Functions limits](https://vercel.com/docs/functions/limitations), page last updated 2026-08-24.) A push webhook that carries the full MIME message plus attachments (and Postmark's JSON also base64-encodes attachments) will fail for large mail unless the provider hands over a download link instead, or something in between stores the message first.
- **Gmail forwarding setup:** the Owner adds the address under Settings > Forwarding and POP/IMAP. Gmail then sends "a verification message ... to the forwarding address" containing a **verification link**, which must be clicked before forwarding can be selected. Filter-based forwarding ("Forward it") uses the same verified address. ([Gmail Help: automatically forward messages](https://support.google.com/mail/answer/10957).) Many write-ups say the message also includes a numeric confirmation code. **Unverified**: the help page mentions only the link.
- **Effect on the #12 drop rule:** Gmail itself sends the verification message straight to the inbound address. It is not a forwarded message, so it presumably has no `X-Forwarded-For`/`X-Forwarded-To` headers (**Unverified**). Under #12's rule ("mail without Gmail's forwarding markers ... is dropped") it would be thrown away. The ingest path therefore needs a narrow exception that recognises and shows this message, or its link, to the Owner. This applies whichever provider is chosen.
- **Gmail forwarding headers:** Google's help pages do not document `X-Forwarded-For`/`X-Forwarded-To`. That Gmail adds them on auto-forward is widely observed but **Unverified** from a first-party source. A real forward should be captured during the spike.
- **Forwarding to plus addresses:** whether Gmail accepts a `+tag` forwarding address is **Unverified** from a first-party source. It is commonly reported to work.

## Candidates

### Postmark (inbound)

- **Plans:** inbound processing is listed only on **Pro ($16.50/mo, 10k emails)** and **Platform ($18/mo)**. Free (100 emails/mo) and Basic ($15/mo) show no inbound. ([Postmark pricing](https://postmarkapp.com/pricing).) Whether inbound messages count toward the monthly volume is not stated there (**Unverified**).
- **Address without a domain: yes.** "A server's inbound mailbox is a unique hash generated when the server is created", in the form `yourhash@inbound.postmarkapp.com`. ([Parse an email](https://postmarkapp.com/developer/user-guide/inbound/parse-an-email).)
- **Per-Owner addresses:** plus-addressing is supported. In `hash+tag@inbound.postmarkapp.com`, the `tag` is returned as `MailboxHash`. ([Parse an email](https://postmarkapp.com/developer/user-guide/inbound/parse-an-email); [Inbound webhook](https://postmarkapp.com/developer/webhooks/inbound-webhook).) One server can therefore hold one unguessable `+token` per Owner, and the token can be rotated without changing DNS. A custom domain is optional: point its MX at `inbound.postmarkapp.com` and "receive emails sent to any address on the inbound forwarding domain". ([Inbound domain forwarding](https://postmarkapp.com/developer/user-guide/inbound/inbound-domain-forwarding).)
- **Payload:** JSON POST with parsed fields, a `Headers` name/value array (the docs say the payload has "all email headers, content, and attachments"), base64 `Attachments`, and an optional `RawEmail`. The `RawEmail` key is added when the server's `RawEmailEnabled` flag is on: "the raw email content will be included with inbound webhook payloads under the `RawEmail` key". ([Servers API](https://postmarkapp.com/developer/api/servers-api).) Attachments are capped at 35 MB in total. Postmark waits 2 minutes for a response. ([Parse an email](https://postmarkapp.com/developer/user-guide/inbound/parse-an-email).)
- **Retries:** a non-200 response is retried up to 10 times over roughly 10.5 hours, and a 403 stops the retries. Messages that still fail show as "Inbound Error" and can be retried through the API. ([Inbound webhook](https://postmarkapp.com/developer/webhooks/inbound-webhook).)
- **Fit with Vercel:** JSON containing the parsed body, base64 attachments and `RawEmail` roughly doubles the size of a message. Messages over about 2 MB with attachments could exceed Vercel's 4.5 MB limit (inferred from the two limits above).

### SendGrid (Twilio) Inbound Parse

- **Plans:** there is **no permanent free plan**. The free trial lasts 60 days at 100 emails/day, and the cheapest paid plan is Essentials, "starting at $19.95/mo". ([Twilio SendGrid Email API pricing](https://www.twilio.com/en-us/products/email-api/pricing).) The pricing page lists an "Inbound Parse Webhook" feature but doesn't make clear which plans include it (**Unverified**).
- **Domain: required.** You create an MX record pointing your parse hostname to `mx.sendgrid.net`. ([Setting up the Inbound Parse Webhook](https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/setting-up-the-inbound-parse-webhook).) A catch-all on that (sub)domain gives per-Owner local parts.
- **Payload:** an optional "POST the raw, full MIME message" setting. SendGrid advises keeping messages under 30 MB in total. (Same page.) Retry behaviour is not described there (**Unverified**).

### Mailgun routes

- **Plans:** the **Free plan has 100 emails/day, 1 custom sending domain and 1 inbound route**. Basic ($15/mo) has 5 routes, and Foundation ($35/mo) has "full access to inbound routing". ([Mailgun pricing](https://www.mailgun.com/pricing/).) One route can serve every Owner, because filters include `match_recipient()` and `catchall()`. ([Routes](https://documentation.mailgun.com/docs/mailgun/user-manual/receive-forward-store/routes).)
- **Domain: required in practice.** The sandbox domain allows "Receiving Messages (limited to one Route)" but limits recipients to authorised addresses, and real receiving needs MX records on a verified domain. ([Sandbox domain](https://documentation.mailgun.com/docs/mailgun/user-manual/domains/domains-sandbox); [FAQ](https://documentation.mailgun.com/docs/mailgun/faq/faqs).)
- **Payload:** if the `forward()` URL ends in `mime` or `raw-mime`, Mailgun posts a `body-mime` field with the raw MIME. `message-headers` holds the headers as an ordered list. Requests are signed with HMAC (`signature`/`timestamp`/`token`, or `X-Mailgun-Signature` headers for JSON). ([Receive via HTTP](https://documentation.mailgun.com/docs/mailgun/user-manual/receive-forward-store/receive-http).)
- **Retries:** at 10, 15 and 30 minutes, then 1, 2 and 4 hours, stopping after 8 hours. A `406` response rejects the message without retrying. (Same page.)

### Cloudflare Email Routing + Email Workers

- **Cost:** Email Routing is "Available on Free and Paid plans", and forwarding to verified destination addresses is free. ([Email Routing overview](https://developers.cloudflare.com/email-routing/).) Workers Free allows 100,000 requests/day, **10 ms CPU** per invocation and 50 subrequests. ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/).) Cloudflare warns that "complex handlers may fail with `EXCEEDED_CPU`" on Free. ([Email Routing limits](https://developers.cloudflare.com/email-routing/limits/).) A Worker that only streams `message.raw` to a webhook does little CPU work, but this is **Unverified** in practice.
- **Domain: required, and its DNS must be on Cloudflare.** "You must be using Cloudflare DNS". ([Enable Email Routing](https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/).) Whether a subdomain or a partial (CNAME) setup is enough is **Unverified**.
- **Per-Owner addresses:** a catch-all rule (`*@domain`) can use the "Send to a Worker" action. Subaddressing (RFC 5233) has been supported since 2025-07-21, with `+detail` kept in `message.to`. ([Email routing addresses](https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/); [changelog 2025-07-21](https://developers.cloudflare.com/changelog/2025-07-21-subaddressing).) Limits are 200 rules per domain, 25 MiB per inbound message and 200 destination addresses. Destination addresses are not needed when a Worker handles the mail. ([Limits](https://developers.cloudflare.com/email-routing/limits/).)
- **Payload:** the Worker receives `ForwardableEmailMessage` with `from`/`to` (envelope), `headers`, `raw` (a `ReadableStream` of the raw MIME) and `rawSize`. It can call `setReject()`. ([Runtime API](https://developers.cloudflare.com/email-routing/email-workers/runtime-api/).) The webhook to Vercel is code you write yourself (a `fetch()` POST of `raw`). The docs don't describe this pattern, so it is **Unverified** but standard Workers behaviour. Messages over 4.5 MB would need to go to object storage first (for example Cloudflare R2) rather than straight to Vercel.
- **Retries:** none are built in. If the Worker can't reach the app, it can `setReject()`, which bounces the message back to the sender, here Gmail's forwarder. Whether Gmail retries or notifies the Owner is **Unverified**. Durable buffering needs extra pieces such as R2 or Queues.

### AWS SES email receiving

- **Cost:** $0.10 per 1,000 inbound emails plus $0.09 per 1,000 incoming 256 KB chunks. New accounts get "up to $200 in AWS Free Tier credits", which must be used within 12 months. There is no permanent free inbound allowance. ([SES pricing](https://aws.amazon.com/ses/pricing/).) At personal volume this costs pennies a month after the credits run out.
- **Domain: required.** Prerequisites are to verify the domain, publish an MX record and grant SES permissions. ([Setting up receiving](https://docs.aws.amazon.com/ses/latest/dg/receiving-email-setting-up.html).) Receiving works only in certain regions. ([Receiving overview](https://docs.aws.amazon.com/ses/latest/dg/receiving-email.html).)
- **Payload:** the SNS action delivers "a raw, unmodified copy of the email" (UTF-8 or Base64) but only up to **150 KB**, and larger messages bounce. Bigger mail needs the S3 action plus a notification or Lambda. ([SNS action](https://docs.aws.amazon.com/ses/latest/dg/receiving-email-action-sns.html).) Getting it to Vercel therefore means wiring up SNS→HTTPS or S3→Lambda→webhook yourself. This option has the most moving parts.

### Resend receiving (other strong candidate)

- **Plans:** the **Free plan has 3,000 emails/mo, 100/day, 3 domains and 30-day retention**. "Each received email counts towards your transactional emails quota". Pro costs $20/mo. ([Resend pricing](https://resend.com/pricing).) Whether the 100/day cap also applies to received mail is **Unverified**.
- **Address without a domain: yes.** Each account has a `<id>.resend.app` subdomain, and you "will receive emails sent to any address" there. A custom domain is optional through MX. ([Receiving introduction](https://resend.com/docs/dashboard/receiving/introduction).) Any local part can serve as the per-Owner token.
- **Payload:** the `email.received` webhook carries **metadata only**: "Webhooks do not include the email body, headers, or attachments". ([Get email content](https://resend.com/docs/dashboard/receiving/get-email-content).) The app then calls the Received emails API, which returns `headers`, `message_id` and `raw.download_url`, "a signed URL to download the original email file including all attachments", along with `expires_at`. ([Retrieve received email](https://resend.com/docs/api-reference/emails/retrieve-received-email).) Fetching the raw message this way sidesteps Vercel's 4.5 MB request limit. Whether `headers` contains every header is not stated (**Unverified**), but the raw download covers that.
- **Retries / signing:** not checked for receiving specifically (**Unverified**).

### CloudMailin (other candidate)

- **Plans:** the plans page lists a **Free plan of 10,000 emails/mo with a 512 KB per-message cap**, and "no credit card required". Starter costs $25/mo (2 MB per message). "Use your own domain" and catch-all appear under paid plans. ([CloudMailin plans](https://www.cloudmailin.com/plans).) Whether the free plan supplies a `@cloudmailin.net` address, and in what format, is **Unverified**. The homepage says only that CloudMailin "gives you an email address to send to". ([cloudmailin.com](https://www.cloudmailin.com/).)
- **Per-Owner addresses:** "You can also use a plus in your email address to create a disposable email address". ([FAQ](https://docs.cloudmailin.com/getting_started/faqs/).)
- **Payload:** the raw format POSTs `message` ("The entire email as a string. This is unaltered") plus an `envelope` (to, from, remote IP, SPF). ([Raw format](https://docs.cloudmailin.com/http_post_formats/raw/).) The free plan's 512 KB cap would reject many messages that carry attachments.

## Domain cost if one is needed

Cloudflare Registrar charges at cost with "no markup". ([Cloudflare Registrar](https://www.cloudflare.com/products/registrar/).) For a `.com`, third-party price trackers put this at about **$10.46/yr**, rising to about **$11.17/yr** after a Verisign wholesale increase reported for 2026-11-01. **Unverified**: these figures come from aggregators, not Cloudflare's own price list. Other registrars charge more, and cheaper TLDs exist. The same domain would probably also serve the app itself, which is a separate open item.

## Options for the decision

| Option | Free path | Custom domain needed | Per-Owner address mechanism | Raw message / all headers | Large-mail fit with Vercel 4.5 MB | Built-in retries | Moving parts |
|---|---|---|---|---|---|---|---|
| Postmark | No; inbound needs Pro ($16.50/mo) | No (`hash@inbound.postmarkapp.com`); optional | `+token` → `MailboxHash` | Yes (`RawEmailEnabled` → `RawEmail`; `Headers` array) | Push JSON; large attachments can exceed 4.5 MB | Yes, ~10.5 h, 10 tries | Low |
| SendGrid Inbound Parse | No; 60-day trial, then $19.95+/mo | Yes (MX) | Catch-all on the parse (sub)domain | Yes (raw MIME option) | Push; can exceed 4.5 MB | Unverified | Low |
| Mailgun routes | Yes (Free: 1 route, 100/day) | Yes (MX on a verified domain) | One `match_recipient`/catch-all route | Yes (`…/mime` → `body-mime`) | Push; can exceed 4.5 MB | Yes, 8 h | Low |
| Cloudflare Email Routing + Worker | Yes (Routing free, Workers Free) | Yes, with DNS on Cloudflare | Catch-all to Worker; `+detail` supported | Yes (`message.raw` stream; you write the POST) | You control it (e.g. store in R2, send a reference) | None built in; you build it | Medium (a Worker to deploy) |
| AWS SES receiving | Credits only, then ~$0.10/1k | Yes (verify + MX) | Receipt rule on the domain | Yes (SNS ≤150 KB, else S3) | Needs S3 + Lambda/SNS wiring | Via AWS services | High |
| Resend receiving | Yes (Free: 3k/mo incl. received, 100/day) | No (`<id>.resend.app`); optional | Any local part on the subdomain | Yes (API `raw.download_url`, `headers`) | Webhook is metadata only; app pulls raw, so no body limit | Unverified | Low (webhook + one API call) |
| CloudMailin | Yes (Free: 10k/mo, 512 KB/msg) | Address supplied (format Unverified); own domain paid | `+` disposable addresses | Yes (raw `message` field) | 512 KB free cap rejects bigger mail first | Unverified | Low |

Notes common to all options:

- Every option ends in an HTTPS POST to a Next.js route on Vercel. The route should verify the provider's signature or a secret and pull the Owner token out of the recipient address.
- Gmail's verification message needs a carve-out from the "drop mail without forwarding markers" rule, whichever provider is chosen.
- To confirm during a spike: Gmail accepts a `+token` forwarding address, Gmail auto-forward adds `X-Forwarded-For`/`X-Forwarded-To` and keeps `Message-ID`/`References`, and the chosen provider passes them through unchanged.
