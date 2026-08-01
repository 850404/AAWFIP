# AAWFIP — Live web check setup

This repo adds one thing on top of AAWFIP.html itself: a scheduled,
serverless check of each funder's real website, so the "Live web
check" section in the Notes & Tracker view can flag when a funder's
page actually changes — without you (or Claude) having to run and
maintain a server.

## How it works

1. `.github/workflows/check-funders.yml` runs on a schedule (daily by
   default — edit the cron line to change that).
2. It runs `scripts/check-funders.mjs`, which fetches every URL in
   `data/funder-sources.json`, hashes the page content, and writes the
   result to `data/funder-web-snapshot.json`.
3. The workflow commits that updated JSON file back into the repo.
4. `AAWFIP.html`'s Tracker view fetches that JSON file directly from
   GitHub (as a plain static file — no server, no proxy needed) and
   compares it against what you've already reviewed.

Nothing about your notes, scores, or uploaded projects goes anywhere —
only the small check-script runs, and only against funders' own public
pages.

## Running the check manually

On GitHub, go to the "Actions" tab → "Check funder websites for
changes" → "Run workflow". After it finishes (a minute or two),
`data/funder-web-snapshot.json` will have real content.

## Editing what gets checked

Edit `data/funder-sources.json` any time — add, remove, or fix a
funder's monitored URL.

## Changing the check frequency

Edit the `cron` line in `.github/workflows/check-funders.yml`.
