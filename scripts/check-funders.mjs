#!/usr/bin/env node
// =====================================================================
// check-funders.mjs
// -----------------------------------------------------------------
// Fetches each funder's monitored URL (from data/funder-sources.json),
// hashes a normalised version of the page content, and writes/updates
// data/funder-web-snapshot.json — the file AAWFIP.html's "Live web
// check" section reads over the network (via raw.githubusercontent.com).
//
// Run by .github/workflows/check-funders.yml on a schedule. Requires
// Node 20+ (uses the built-in fetch and crypto modules — no npm
// install needed).
// =====================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = path.join(__dirname, '..', 'data', 'funder-sources.json');
const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'funder-web-snapshot.json');

// Strips tags/scripts/styles/comments and collapses whitespace. This
// cuts down on false "changed" flags from things like rotating ad
// slots or embedded timestamps, while still catching real content
// changes (new deadlines, new amounts, new programme text).
function normalize(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hash(text) {
  return createHash('sha256').update(text).digest('hex');
}

async function checkOne(source, previous) {
  const prevEntry = previous && previous[source.id];
  const now = new Date().toISOString();
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'AAWFIP-funder-watch/1.0 (public grant-funding tracker; contact via GitHub repo)' },
      redirect: 'follow'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    const contentHash = hash(normalize(html));
    const changed = !!(prevEntry && prevEntry.contentHash && prevEntry.contentHash !== contentHash);
    return {
      name: source.name,
      url: source.url,
      contentHash: contentHash,
      lastChecked: now,
      lastChanged: changed ? now : (prevEntry ? prevEntry.lastChanged : now),
      status: 'ok',
      error: null
    };
  } catch (err) {
    // A failed check never overwrites a previously good hash — it's
    // recorded as an error so the funder's last-known real state
    // isn't lost just because their site had a bad moment.
    return {
      name: source.name,
      url: source.url,
      contentHash: prevEntry ? prevEntry.contentHash : null,
      lastChecked: now,
      lastChanged: prevEntry ? prevEntry.lastChanged : null,
      status: 'error',
      error: String((err && err.message) || err)
    };
  }
}

async function main() {
  const sources = JSON.parse(readFileSync(SOURCES_PATH, 'utf8'));
  const previous = existsSync(SNAPSHOT_PATH)
    ? (JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')).funders || {})
    : {};

  const funders = {};
  for (const source of sources) {
    if (!source.url) { console.log('Skipping (no url):', source.id); continue; }
    console.log('Checking', source.id, '->', source.url);
    funders[source.id] = await checkOne(source, previous);
    // Small delay between requests — polite to funders' servers and
    // avoids looking like a scraping burst.
    await new Promise(function (r) { setTimeout(r, 500); });
  }

  const snapshot = { generatedAt: new Date().toISOString(), funders: funders };
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n');
  console.log('Wrote', SNAPSHOT_PATH);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
