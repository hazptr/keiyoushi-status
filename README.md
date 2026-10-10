# keiyoushi extension status

Weekly automated status of every [keiyoushi](https://github.com/keiyoushi/extensions-source)
1.6 extension, built from `main`. Unofficial; not affiliated with keiyoushi.

**Page:** https://hazptr.github.io/keiyoushi-status/

## What's checked

Each extension's real code runs on a JVM harness, not on a phone:

1. Popular, page 1
2. Details and chapter list of a popular entry
3. That chapter's page list
4. Two page images, downloaded through the extension's own HTTP client (so its interceptors run:
   descrambling, retries) and decoded

A failure is retried before it counts.

| Status | Meaning |
|---|---|
| Working | every step passed |
| Failing | a step failed; the page shows which, with a short error |
| Untestable | the harness couldn't get a result for a reason that doesn't mean the extension is broken: a Cloudflare challenge it can't solve, a build or harness error, a timeout |

1.4 extensions aren't covered. Results reflect `main` at the commit shown on the page, which can be
ahead of the published APKs. A failure here is a hint, not a verdict: check in the app before
reporting it upstream.

## Data

`status.json` on the `gh-pages` branch. It's regenerated after each weekly run and replaced in a
single commit, so the branch has no history.
