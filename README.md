# rinz0x0cruz.github.io

Root of my GitHub Pages domain. This repo exists mainly to serve the
authoritative **`robots.txt`** at the origin root
(`https://rinz0x0cruz.github.io/robots.txt`), which is the only place
crawlers read it from.

That one file sets the crawl policy for **every** project page served under
this domain (exploitrank, jobscope, jobscope-dashboard, …):
keep them out of search engines, web archives, and AI/LLM scrapers.

`robots.txt` only binds well-behaved crawlers — it is not a security control.
Robust bot mitigation would require a reverse proxy / CDN (e.g. Cloudflare)
in front, which needs a custom domain.
