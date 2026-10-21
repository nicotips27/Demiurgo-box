/**
 * Probe itch.io pack pages for their direct download URLs.
 *   node scripts/probe-itch.mjs <url> [...]
 */
const urls = process.argv.slice(2);

for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const t = await r.text();
    console.log('==', u, r.status, t.length, 'bytes');
    const ids = [...new Set([...t.matchAll(/"(?:id|upload_id)":\s*"?(\d{4,})/g)].map((m) => m[1]))];
    console.log('   upload ids:', ids.slice(0, 12).join(', '));
    const slugs = [...new Set([...t.matchAll(/itch\.io\/([a-z0-9\-]+)"/g)].map((m) => m[1]))];
    console.log('   slugs:', slugs.slice(0, 12).join(', '));
    const files = [...new Set([...t.matchAll(/data-upload_id="(\d+)"/g)].map((m) => m[1]))];
    if (files.length) console.log('   data-upload_id:', files.join(', '));
    const cdn = [...new Set([...t.matchAll(/https:\/\/img\.itch\.zone\/[^"'\s]+/g)].map((m) => m[0]))];
    console.log('   cdn urls:', cdn.slice(0, 5).join('\n              '));
  } catch (e) {
    console.log('ERR', u, e.message);
  }
}
