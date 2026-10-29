# Research: Gmail access for a personal app

Ticket: #7. Context: map #3 (Personal v1). Release 1 needs no Gmail; this feeds a later release where the app reads the Owner's job-related mail, raises Proposals for Interview Loops, and sends Drafts the Owner has approved. Non-job mail is off limits.

Sources checked 2026-10-29. "Unverified" means I could not confirm the claim from a primary source.

## 1. OAuth scopes and how Google classifies them

Source: https://developers.google.com/workspace/gmail/api/auth/scopes

| Scope | Class | Use here |
|---|---|---|
| `gmail.send` | Sensitive | Send approved Drafts. Cannot read mail. |
| `gmail.labels` | Non-sensitive | Create and manage labels only. Cannot read messages. |
| `gmail.metadata` | Restricted | Headers and labels, "but not the email body". |
| `gmail.readonly` | Restricted | Read messages and settings. |
| `gmail.compose` | Restricted | Create Gmail drafts and send. |
| `gmail.modify` | Restricted | Read, compose, send, and label. |
| `https://mail.google.com/` | Restricted | Full access. Avoid. |

- Reading message bodies needs a restricted scope. No Gmail API scope restricts reading to one label: `gmail.readonly` can read the whole mailbox. Filtering by label (`q`/`labelIds`) is something the app does, not something Google enforces.
- The smallest useful set is `gmail.readonly` + `gmail.send`. The Draft can be kept in the app's own database and sent through `messages.send`, so `gmail.compose` is not needed.

## 2. Verification and CASA for an app only its developer uses

- Verification is not needed for "Personal Use apps" (you plus a small group, fewer than 100 people) or for apps in "development/testing/staging mode". Source: https://support.google.com/cloud/answer/13464323
- In Testing status an app is limited to 100 test users listed on the consent screen, and each user sees an "unverified app" warning before granting access. Source: https://support.google.com/cloud/answer/15549945
- The annual CASA security assessment applies to apps that request restricted scopes and go through restricted-scope verification. It is the last step of that review. Source: https://support.google.com/cloud/answer/13465431. For a personal-use or testing app, verification is exempt (above), so CASA does not come up.
- A multi-user product would need restricted-scope verification plus an annual CASA. Google's pages did not state a cost.

## 3. The 7-day refresh-token rule

- An app in Testing status with External user type gets refresh tokens that expire after 7 days, unless it asks only for `openid`/`email`/`profile`. Sources: https://developers.google.com/identity/protocols/oauth2 and https://support.google.com/cloud/answer/15549945
- Each account can hold 100 refresh tokens per client; when that is exceeded, the oldest is revoked without notice. Source: https://developers.google.com/identity/protocols/oauth2
- How to avoid it:
  - **Internal user type.** This needs a Google Cloud Organization (Workspace or Cloud Identity), and it rejects accounts outside that organization with `org_internal` (https://support.google.com/cloud/answer/15549945). That does not fit the Owner's consumer @gmail.com account.
  - **Publish to "In production" and stay unverified under the Personal Use exemption.** The Testing-status expiry rule then no longer applies. Users still see an unverified-app screen. Unverified: I did not find a primary-source page that explicitly confirms a production, unverified, restricted-scope app keeps long-lived refresh tokens and has no hard user cap. Check this with a real consent run before relying on it.
  - **Stay in Testing** and have the Owner re-consent every week. This works, but it is tedious.

## 4. Alternatives that reduce scope

| Option | What the app sees | Trade-offs | Multi-user? |
|---|---|---|---|
| **Gmail filter that forwards to an inbound address** (SES, Postmark, SendGrid, Mailgun inbound) | Only what the Owner's filter forwards | Gmail can forward selected mail through a filter, and the destination address must confirm a verification link first (https://support.google.com/mail/answer/10957). No Google OAuth or verification at all. Filters miss mail they don't match, so recall depends on the filter. Forwarded copies lose the Gmail thread/message IDs, so replying in the original thread needs `gmail.send` (or SMTP) plus the original `Message-ID`/`References` headers. This enforces "non-job mail is off limits" most strongly. | Yes. Each user gets a unique inbound address and sets up their own filter. Onboarding has friction, but no restricted scope is involved. |
| **IMAP/SMTP with an app password** | The whole mailbox (the scope is not limited) | Requires 2-Step Verification. Google says app passwords "aren't recommended" and they can be unavailable on some accounts (Advanced Protection, work accounts, security-key-only 2SV) (https://support.google.com/accounts/answer/185833). The app stores a credential with full access. | No. It is a single-person shortcut, which #3 rules out. |
| **IMAP with XOAUTH2** | The whole mailbox | Supported (https://developers.google.com/workspace/gmail/imap/imap-smtp). Unverified: I believe it needs `https://mail.google.com/`, the broadest restricted scope, but the page linked here does not name the scope. | It runs into the same verification and CASA requirements as the API, with a broader scope. |
| **`gmail.metadata`** | Headers and labels, no bodies | Still restricted, so it saves no verification work. It is too little to build Proposals from. It could support a cheap job-mail triage step (sender/subject) before reading anything. | Same verification and CASA requirements as `readonly`. |
| **`gmail.labels` + label-scoped reading** | Nothing: `gmail.labels` cannot read messages | Not possible. No scope limits reading to a label. | n/a |
| **Push via Pub/Sub (`users.watch`)** | Only a change signal (`emailAddress`, `historyId`) | Not a separate access method: it adds to whichever read scope is used. You can filter by `labelIds` (for example, a "Jobs" label set by a Gmail filter). The watch must be renewed at least every 7 days; Google recommends daily. Changes come from `history.list`. Source: https://developers.google.com/workspace/gmail/api/guides/push | Yes, and it is the standard pattern for many users. |

## 5. LinkedIn messages by email

- LinkedIn emails a notification of new member messages to your primary address, depending on your notification settings. Replies are made through LinkedIn messaging. Source: https://www.linkedin.com/help/linkedin/answer/a541934/replying-to-a-message?lang=en
- Candidates respond to Recruiter InMail inside LinkedIn, through the "Yes, interested…" / "No thanks…" templates or a free-form reply. Source: https://www.linkedin.com/help/linkedin/answer/a552643/
- The one primary-source mention of replying by email is on the **recruiter** side: when a recruiter replies through their own email provider, the reply goes to the candidate's email and their LinkedIn account. Source: https://www.linkedin.com/help/recruiter/answer/a418049/reply-to-messages-in-the-recruiter-inbox?lang=en. This describes the recruiter's view, not the Owner's.
- Unverified: whether member and InMail notification emails include the full message text (in my experience they often show a preview or all of it), and whether replying to such an email from Gmail posts the reply on LinkedIn. LinkedIn's help center does not document either for members. Assume email replies do **not** reach LinkedIn, and treat LinkedIn notification emails as read-only signals that link back to LinkedIn.

## Options for the decision

1. **Forward plus inbound address (read) + `gmail.send` (send).** Least access, and no restricted scope. Recall depends on a filter the Owner maintains. Sending stays Sensitive-only.
2. **Gmail API with `gmail.readonly` + `gmail.send`, personal-use, unverified,** plus Pub/Sub watch on a "Jobs" label. Highest fidelity, including threads. The app has to ignore non-job mail itself. A product later would need verification plus an annual CASA.
3. **Option 2, staying in Testing mode,** with weekly re-consent. The fastest way to prototype. Not something to run long-term.
4. **IMAP with an app password.** Simplest to code, but a single-person shortcut, and #3 rules it out.

LinkedIn: whichever option is chosen, treat LinkedIn notification emails as read-only signals and keep replies on LinkedIn.
