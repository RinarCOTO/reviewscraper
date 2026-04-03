// Generates reviews.html — a central review browser for all 848 reviews
// Run: node build-reviews.mjs
import fs from 'fs';

const all = JSON.parse(fs.readFileSync('analyzed-v4-all.json', 'utf8'));

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');

const reviews = all.map(r => ({
  provider: r.provider_name,
  city: `${r.location_city}, ${r.location_state}`,
  method: r.method_used || '',
  stars: r.star_rating,
  date: r.review_date || '',
  author: r.reviewer_name || 'Anonymous',
  text: r.review_text || '',
  result: r.result_rating,
  pain: r.pain_level,
  sessions: r.sessions_completed,
  use_case: r.use_case,
  scarring: r.scarring_mentioned,
  isInkout: r.provider_name === 'inkOUT',
  file: `dashboard-v4-competitor-${slug(`${r.provider_name}-${r.location_city}, ${r.location_state}`)}.html`,
}));

const providers = [...new Set(reviews.map(r => r.provider))].sort();
const cities    = [...new Set(reviews.map(r => r.city))].sort();

const providerOpts = providers.map(p => `<option value="${p}">${p}</option>`).join('');
const cityOpts     = cities.map(c => `<option value="${c}">${c}</option>`).join('');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>ReviewIntel — Review Browser</title>
<style>
  :root{--bg:#0f1117;--card:#1a1d27;--border:#2a2d3a;--accent:#6c63ff;
    --green:#22c55e;--yellow:#f59e0b;--red:#ef4444;--blue:#3b82f6;--text:#e2e8f0;--muted:#94a3b8;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;}
  header{padding:18px 28px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;}
  header h1{font-size:18px;font-weight:700;color:#fff;}
  header h1 span{color:var(--accent);}
  .nav{display:flex;gap:8px;}
  .nav a{padding:5px 12px;border-radius:6px;border:1px solid var(--border);color:var(--muted);text-decoration:none;font-size:12px;transition:all .15s;}
  .nav a:hover{background:var(--accent);border-color:var(--accent);color:#fff;}
  .filters{background:var(--card);border-bottom:1px solid var(--border);padding:14px 28px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;position:sticky;top:0;z-index:50;}
  .filters select,.filters input[type=text]{background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:7px 10px;color:var(--text);font-size:12px;outline:none;}
  .filters select:focus,.filters input:focus{border-color:var(--accent);}
  .filters input[type=text]{width:200px;}
  .count{color:var(--muted);font-size:12px;margin-left:auto;white-space:nowrap;}
  .clear-btn{padding:6px 12px;border-radius:7px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:12px;cursor:pointer;}
  .clear-btn:hover{border-color:var(--accent);color:var(--accent);}
  .main{max-width:1100px;margin:0 auto;padding:24px 28px;}
  .review-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:12px;position:relative;transition:border-color .15s;}
  .review-card:hover{border-color:rgba(108,99,255,.5);}
  .review-card.inkout{border-left:3px solid #a78bfa;}
  .review-meta{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;}
  .author{font-weight:700;color:#fff;font-size:13px;}
  .stars{color:var(--yellow);font-size:13px;font-weight:700;}
  .provider-link{font-size:12px;color:var(--accent);text-decoration:none;font-weight:600;}
  .provider-link:hover{text-decoration:underline;}
  .review-city{font-size:12px;color:var(--muted);}
  .review-date{font-size:12px;color:var(--muted);margin-left:auto;}
  .review-text{color:#e2e8f0;line-height:1.75;font-size:14px;margin:10px 0 12px;}
  .review-text.empty{color:var(--muted);font-style:italic;}
  .tags{display:flex;gap:6px;flex-wrap:wrap;}
  .badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;}
  .badge-green{background:rgba(34,197,94,.15);color:var(--green);}
  .badge-yellow{background:rgba(245,158,11,.15);color:var(--yellow);}
  .badge-red{background:rgba(239,68,68,.15);color:var(--red);}
  .badge-blue{background:rgba(59,130,246,.15);color:var(--blue);}
  .badge-purple{background:rgba(108,99,255,.15);color:#a78bfa;}
  .badge-gray{background:#1e293b;color:#64748b;}
  .copy-btn{position:absolute;top:14px;right:14px;background:rgba(108,99,255,.15);border:1px solid rgba(108,99,255,.3);color:#a78bfa;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;opacity:0;transition:opacity .15s;}
  .review-card:hover .copy-btn{opacity:1;}
  .copy-btn:hover{background:rgba(108,99,255,.3);}
  .empty-state{text-align:center;padding:80px 20px;color:var(--muted);}
  .empty-state .big{font-size:48px;margin-bottom:12px;}
  @media(max-width:700px){.filters input[type=text]{width:100%;} .review-date{margin-left:0;}}
</style>
</head>
<body>

<header>
  <div>
    <div style="color:var(--muted);font-size:11px;margin-bottom:3px">ReviewIntel · Review Browser</div>
    <h1><span>All Reviews</span> — Browse &amp; Copy</h1>
  </div>
  <div class="nav">
    <a href="index.html">← Hub</a>
    <a href="dashboard-v4-overview.html">Overview</a>
  </div>
</header>

<div class="filters">
  <select id="f-city" onchange="render()">
    <option value="">All Cities</option>
    ${cityOpts}
  </select>
  <select id="f-provider" onchange="render()">
    <option value="">All Providers</option>
    ${providerOpts}
  </select>
  <select id="f-result" onchange="render()">
    <option value="">All Results</option>
    <option value="Positive">Positive</option>
    <option value="Neutral">Neutral</option>
    <option value="Mixed">Mixed</option>
    <option value="Negative">Negative</option>
  </select>
  <select id="f-stars" onchange="render()">
    <option value="">All Stars</option>
    <option value="5">5★</option>
    <option value="4">4★</option>
    <option value="3">3★</option>
    <option value="2">2★</option>
    <option value="1">1★</option>
  </select>
  <select id="f-usecase" onchange="render()">
    <option value="">All Use Cases</option>
    <option value="Complete">Complete Removal</option>
    <option value="Cover-up">Cover-up</option>
    <option value="Microblading">Microblading</option>
    <option value="Color">Color Ink</option>
    <option value="Other">Other</option>
  </select>
  <select id="f-sort" onchange="render()">
    <option value="default">Default order</option>
    <option value="stars-desc">Stars ↓</option>
    <option value="stars-asc">Stars ↑</option>
    <option value="provider">Provider A–Z</option>
  </select>
  <input type="text" id="f-search" placeholder="Search text or author…" oninput="render()">
  <button class="clear-btn" onclick="clearFilters()">Clear</button>
  <span class="count" id="count"></span>
</div>

<div class="main">
  <div id="list"></div>
</div>

<script>
const REVIEWS = ${JSON.stringify(reviews)};

function resultColor(r) {
  return r==='Positive'?'var(--green)':r==='Negative'?'var(--red)':r==='Mixed'?'var(--yellow)':r==='Neutral'?'var(--blue)':'#374151';
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  });
}

function clearFilters() {
  ['f-city','f-provider','f-result','f-stars','f-usecase'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-sort').value = 'default';
  document.getElementById('f-search').value = '';
  render();
}

function render() {
  const city     = document.getElementById('f-city').value;
  const provider = document.getElementById('f-provider').value;
  const result   = document.getElementById('f-result').value;
  const stars    = document.getElementById('f-stars').value;
  const usecase  = document.getElementById('f-usecase').value;
  const sort     = document.getElementById('f-sort').value;
  const search   = document.getElementById('f-search').value.trim().toLowerCase();

  let data = REVIEWS.filter(r =>
    (!city     || r.city === city) &&
    (!provider || r.provider === provider) &&
    (!result   || r.result === result) &&
    (!stars    || Math.round(r.stars) === parseInt(stars)) &&
    (!usecase  || r.use_case === usecase) &&
    (!search   || r.text.toLowerCase().includes(search) || r.author.toLowerCase().includes(search) || r.provider.toLowerCase().includes(search))
  );

  if (sort === 'stars-desc') data.sort((a,b) => b.stars - a.stars);
  else if (sort === 'stars-asc') data.sort((a,b) => a.stars - b.stars);
  else if (sort === 'provider') data.sort((a,b) => a.provider.localeCompare(b.provider));

  document.getElementById('count').textContent = data.length.toLocaleString() + ' reviews';

  if (!data.length) {
    document.getElementById('list').innerHTML = '<div class="empty-state"><div class="big">🔍</div><div>No reviews match your filters</div></div>';
    return;
  }

  const rc = resultColor;
  document.getElementById('list').innerHTML = data.map(r => {
    const starsHtml = '★'.repeat(r.stars||0) + '☆'.repeat(5-(r.stars||0)) + ' ' + (r.stars||'?') + '★';
    const col = rc(r.result);
    return \`<div class="review-card\${r.isInkout?' inkout':''}">
      <button class="copy-btn" onclick="copyText(\${JSON.stringify(r.text)}, this)">Copy</button>
      <div class="review-meta">
        <span class="author">\${r.author}</span>
        <span class="stars">\${starsHtml}</span>
        <a href="\${r.file}" class="provider-link">\${r.provider}</a>
        <span class="review-city">\${r.city}</span>
        \${r.date ? '<span class="review-date">'+r.date+'</span>' : ''}
      </div>
      <div class="review-text\${!r.text?' empty':''}">\${r.text || 'No review text'}</div>
      <div class="tags">
        <span class="badge" style="background:rgba(0,0,0,.3);border:1px solid \${col};color:\${col}">\${r.result}</span>
        \${r.method ? '<span class="badge badge-gray">'+r.method+'</span>' : ''}
        \${r.pain !== 'unknown' ? '<span class="badge badge-yellow">Pain '+r.pain+'/5</span>' : ''}
        \${r.sessions !== 'unknown' && r.sessions ? '<span class="badge badge-blue">'+r.sessions+' sessions</span>' : ''}
        \${r.use_case && r.use_case !== 'unknown' ? '<span class="badge badge-purple">'+r.use_case+'</span>' : ''}
        \${r.scarring === 'Yes' ? '<span class="badge badge-red">Scarring</span>' : r.scarring === 'Positive' ? '<span class="badge badge-green">Healed well</span>' : ''}
      </div>
    </div>\`;
  }).join('');
}

render();
</script>
</body>
</html>`;

fs.writeFileSync('reviews.html', html);
console.log(`reviews.html written — ${reviews.length} reviews`);
