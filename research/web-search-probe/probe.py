"""Probe what Claude web search / web fetch return for interview-report queries.

Records facts only (domains, field presence, sizes, error codes, user agent).
Never writes page text, snippets, or review content to disk or stdout.
Raw HTTP via stdlib because the SDK can't be installed here (no ensurepip).
"""
import json, os, sys, time, urllib.request, urllib.error
from collections import Counter
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
KEY = os.environ.get("ANTHROPIC_API_KEY") or open(os.path.join(HERE, "anthropic.key")).read().strip()
MODEL = "claude-opus-5-5"
COMPANIES = ["Google", "Microsoft", "Amazon", "Netflix"]
SITES = ["glassdoor", "reddit", "teamblind", "levels.fyi", "leetcode", "interviewing.io"]
FIXED_FETCH = [
    "https://httpbin.org/headers",
    "https://www.glassdoor.com/Interview/Google-Software-Engineer-Interview-Questions-EI_IE9079.0,6_KO7,24.htm",
    "https://www.reddit.com/r/cscareerquestions/",
    "https://www.teamblind.com/company/Google/",
    "https://www.levels.fyi/companies/google/salaries/software-engineer",
    "https://leetcode.com/discuss/interview-question",
    "https://interviewing.io/guides/hiring-process/google",
    "https://www.google.com/about/careers/applications/how-we-hire/",
]
SEARCH_TOOL = {"type": "web_search_20260318", "name": "web_search", "max_uses": 1, "allowed_callers": ["direct"]}
FETCH_TOOL = {"type": "web_fetch_20260318", "name": "web_fetch", "max_uses": 16, "allowed_callers": ["direct"],
              "max_content_tokens": 20000}


def call(messages, tools):
    """POST /v1/messages, resending on pause_turn. Returns (all content blocks, usage list)."""
    blocks, usages = [], []
    for _ in range(6):
        body = json.dumps({"model": MODEL, "max_tokens": 4000, "tools": tools, "messages": messages,
                           "output_config": {"effort": "low"}}).encode()
        req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, headers={
            "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"})
        try:
            resp = json.load(urllib.request.urlopen(req, timeout=600))
        except urllib.error.HTTPError as e:
            sys.exit(f"HTTP {e.code}: {e.read().decode()[:500]}")
        blocks += resp["content"]
        usages.append(resp["usage"])
        if resp["stop_reason"] != "pause_turn":
            return blocks, usages, resp["stop_reason"]
        messages = messages + [{"role": "assistant", "content": resp["content"]}]
    return blocks, usages, "pause_turn_limit"


def site_of(url):
    host = urlparse(url).netloc.lower().removeprefix("www.")
    return host


def search_probe(company):
    q = f"{company} software engineer onsite interview questions"
    blocks, usages, stop = call([{"role": "user", "content":
        f"Run exactly one web search for: {q}\nThen reply with only the word done. Do not quote or summarize any result."}],
        [SEARCH_TOOL])
    results, err, cites = [], None, []
    for b in blocks:
        if b["type"] == "web_search_tool_result":
            if isinstance(b["content"], dict):
                err = b["content"].get("error_code")
            else:
                for r in b["content"]:
                    results.append({"domain": site_of(r["url"]), "url": r["url"],
                                    "has_title": bool(r.get("title")), "page_age": bool(r.get("page_age")),
                                    "encrypted_len": len(r.get("encrypted_content", ""))})
        for c in b.get("citations") or []:
            cites.append({"domain": site_of(c.get("url", "")), "cited_len": len(c.get("cited_text", ""))})
    return {"query_template": "<company> software engineer onsite interview questions", "company": company,
            "stop": stop, "error": err, "results": results, "citations": cites,
            "searches": sum(u.get("server_tool_use", {}).get("web_search_requests", 0) for u in usages),
            "input_tokens": sum(u["input_tokens"] for u in usages)}


def fetch_probe(urls):
    listing = "\n".join(urls)
    blocks, usages, stop = call([{"role": "user", "content":
        "Use web_fetch on each of these URLs, one fetch per URL, even if you expect it to fail:\n" + listing +
        "\nThen reply with only the word done. Do not quote or summarize any content."}], [FETCH_TOOL])
    calls = {b["id"]: b["input"].get("url") for b in blocks if b["type"] == "server_tool_use" and b["name"] == "web_fetch"}
    out, ua = [], None
    for b in blocks:
        if b["type"] != "web_fetch_tool_result":
            continue
        url, c = calls.get(b["tool_use_id"]), b["content"]
        row = {"domain": site_of(url or ""), "url": url}
        if c.get("type") == "web_fetch_tool_result_error":
            row["error"] = c["error_code"]
        else:
            src = c["content"]["source"]
            row.update(media_type=src.get("media_type"), chars=len(src.get("data", "")), has_title=bool(c["content"].get("title")))
            if "httpbin.org" in (url or ""):
                try:
                    ua = json.loads(src["data"])["headers"].get("User-Agent")
                except Exception:
                    ua = "unparsed: " + "".join(l for l in src["data"].splitlines() if "User-Agent" in l)[:200]
        out.append(row)
    attempted = set(calls.values())
    return {"stop": stop, "not_attempted": [u for u in urls if u not in attempted], "results": out, "user_agent": ua,
            "fetches": sum(u.get("server_tool_use", {}).get("web_fetch_requests", 0) for u in usages),
            "input_tokens": sum(u["input_tokens"] for u in usages)}


def main():
    searches = [search_probe(c) for c in COMPANIES]
    # First search-result URL per review site, so fetch also sees the deep pages search surfaces
    extra, seen = [], set()
    for s in searches:
        for r in s["results"]:
            site = next((x for x in SITES if x in r["domain"]), None)
            if site and site not in seen:
                seen.add(site); extra.append(r["url"])
    fetch = fetch_probe(FIXED_FETCH + extra)
    # Strip full URLs of search results from the report: domains are the fact we keep
    for s in searches:
        for r in s["results"]:
            r.pop("url")
    report = {"model": MODEL, "ran_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
              "search": searches, "fetch": fetch,
              "search_domain_counts": Counter(r["domain"] for s in searches for r in s["results"]).most_common()}
    with open(os.path.join(HERE, "probe-report.json"), "w") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
