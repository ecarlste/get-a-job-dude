# Clera's AI integration and data access

Research for [#14](https://github.com/ecarlste/get-a-job-dude/issues/14). Checked on 2026-10-29.

## Answer

Clera's "AI integration" is a **remote MCP server** at `https://mcp.getclera.com` (Streamable HTTP). The same server serves hiring teams and candidates. A candidate account gets its own tools, including an application tracker (`listApplications`) that returns each application with its stage. Auth is **per-user OAuth 2.1** (authorization code + PKCE, dynamic client registration) through Clerk. No REST API is documented. That fits a per-Owner connection: each Owner connects their own Clera account, and the app holds no shared credential.

## Findings

### Interface
- The MCP server is at `https://mcp.getclera.com`. Any client that can add a remote MCP server by URL can use it, and Claude web, Claude desktop and Claude Code are listed. Source: [getclera.com/mcp](https://www.getclera.com/mcp)
- The docs describe no REST API. The tool reference covers MCP only. Source: [getclera.com/mcp/docs](https://www.getclera.com/mcp/docs)
- Clera also publishes an agent skill. Source: [getclera.com/SKILL.md](https://www.getclera.com/SKILL.md)

### Candidate-side tools relevant to us ([mcp/docs](https://www.getclera.com/mcp/docs))
- `listApplications`: "Your application tracker, newest first, with each one's stage."
- `trackApplication` (takes a posting link), `updateApplication` (edits notes and details), `deleteApplication`
- `applyToJob` and `getApplicationRun`: the second reports whether an application was "sent, or what it still needs from you." This is the closest thing to the CSV's "Sent by Clera" column.
- `listMyPipeline`: every opportunity in every state, with interview dates where one is booked. `listInterviewRequests`, `listMatches`, `readMatch`
- `whoami`: email, account kind, and org memberships
- Clera also has tools for resumes, preferences, job search and account deletion. The read-only tools are the ones that matter here.

### Mapping to the CSV export columns
| CSV column | MCP coverage |
|---|---|
| Company, Position | Likely in `listApplications`, but not documented as fields |
| Stage | Documented ("with each one's stage") |
| Sent by Clera | Indirect, via `getApplicationRun` and `applyToJob` |
| Job link | Accepted as input by `trackApplication`. Not documented as an output |
| Notes | Editable via `updateApplication`. No documented read |
| Applied, Added | Not documented. The list is sorted newest first |
| Location | Not documented |

The docs give **no response schemas**, so whether each field comes back has to be confirmed with a live, authenticated call.

### Auth (probed directly)
- An unauthenticated POST returns `401` with `WWW-Authenticate: Bearer ... resource_metadata="https://mcp.getclera.com/.well-known/oauth-protected-resource"`.
- The protected-resource metadata gives the authorization server `https://clerk.getclera.com` and the scopes `profile`, `email` and `offline_access`.
- The authorization-server metadata lists the `authorization_code` and `refresh_token` grants, `S256` PKCE, and a `registration_endpoint` (dynamic client registration).
- Clera describes the flow as: sign in with your Clera account in the browser, then approve a consent screen ([SKILL.md](https://www.getclera.com/SKILL.md)). Removing the connector revokes access ([mcp](https://www.getclera.com/mcp)).

### Terms, limits, privacy
- Clera is free for candidates. Companies pay a success fee, and MCP is free for early-access companies during the beta ([mcp](https://www.getclera.com/mcp)).
- Clera logs each tool call against the account. "Clera sees the tool call. Never your chat." ([mcp](https://www.getclera.com/mcp))
- The skill tells agents not to submit applications on a candidate's behalf without the candidate. Write tools wait for user approval.
- No rate limits are documented. Tool schemas "change on deploys", so clients should expect drift and reconnect when they do ([SKILL.md](https://www.getclera.com/SKILL.md)).

## Fit with a per-Owner connection
This fits well. Auth is standard per-user MCP OAuth with refresh tokens, so a future product could store one token per Owner. Read-only use needs only `listApplications`, `listMyPipeline` and `whoami`. The risks are the beta status, undocumented schemas and rate limits, and tool names that may change.

## Not verified
- What `listApplications` actually returns, and whether it includes Company, Position, Location, Job link, the dates and Notes. No authenticated call was made.
- Whether applications Clera sends automatically appear in `listApplications` or only in the pipeline and application-run tools.
- Rate limits, data retention, and whether Clera's terms permit a third-party app (as opposed to an end-user AI client) to hold candidate tokens.
- Whether the "AI integration" shown in Clera's UI is this MCP server. That is likely, but the UI was not inspected.
- [getclera.com/auth.md](https://www.getclera.com/auth.md), [llms.txt](https://www.getclera.com/llms.txt) and the `/.well-known/api-catalog` index were not read.
