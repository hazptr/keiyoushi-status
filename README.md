# keiyoushi extension status

https://hazptr.github.io/keiyoushi-status/

Every 1.6 extension on [keiyoushi](https://github.com/keiyoushi/extensions-source) main, checked
every day. Not affiliated with keiyoushi.

Each extension runs on a JVM harness, no phone. It loads popular, opens a manga and its chapter
list, loads the newest chapter, then downloads and decodes two pages through the extensions own
client. Anything that fails gets one retry before it counts.

- **Working**: all of that went through
- **Failing**: one step failed, the page says which and why
- **Untestable**: we couldnt get a result, usually a Cloudflare challenge the harness cant solve. The
  app handles most of those, so check there

It runs off main, so it can be ahead of whats published. If something shows as failing here, check
it in the app before opening an issue. 1.4 extensions arent covered.

The data is `status.json` on the `gh-pages` branch, replaced on every run.
