// ReviewIntel v4 — Dashboard Builder
// Input:  analyzed-v4-all.json
// Output: dashboard-v4-city-*.html, dashboard-v4-competitor-*.html, dashboard-v4-overview.html
// Run: node build-dashboards-v4.mjs
import fs from 'fs';

const all = JSON.parse(fs.readFileSync('analyzed-v4-all.json', 'utf8'));
console.log(`Loaded ${all.length} reviews`);

// ── Helpers ────────────────────────────────────────────────────────────────
const pct  = (n, t) => t === 0 ? 0 : Math.round(n / t * 100);
const avg  = arr => arr.length === 0 ? 0 : Math.round(arr.reduce((a,b) => a+b, 0) / arr.length * 10) / 10;
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
const loc  = r => `${r.location_city}, ${r.location_state}`;

function summarize(reviews) {
  const total = reviews.length;
  if (!total) return null;
  const stars = avg(reviews.map(r => r.star_rating || 0));

  const result = { Positive:0, Neutral:0, Mixed:0, Negative:0, unknown:0 };
  const useCase = {};
  let painMentioned = 0, scarringMentioned = 0, sessionsTotal = 0, sessionsCount = 0;

  for (const r of reviews) {
    result[r.result_rating] = (result[r.result_rating] || 0) + 1;
    if (r.pain_level !== 'unknown') painMentioned++;
    if (r.scarring_mentioned === 'Yes' || r.scarring_mentioned === 'Positive') scarringMentioned++;
    if (r.sessions_completed !== 'unknown' && typeof r.sessions_completed === 'number' && r.sessions_completed > 0) {
      sessionsTotal += r.sessions_completed;
      sessionsCount++;
    }
    const uc = r.use_case || 'unknown';
    useCase[uc] = (useCase[uc] || 0) + 1;
  }

  return {
    total, avg_stars: stars,
    result_pct: {
      positive: pct(result.Positive, total),
      negative: pct(result.Negative, total),
      mixed:    pct(result.Mixed, total),
      neutral:  pct(result.Neutral, total),
      unknown:  pct(result.unknown, total),
    },
    pain_pct:     pct(painMentioned, total),
    scarring_pct: pct(scarringMentioned, total),
    avg_sessions: sessionsCount > 0 ? Math.round(sessionsTotal / sessionsCount * 10) / 10 : null,
    use_case: useCase,
    sample_negatives: reviews.filter(r => r.result_rating === 'Negative' && r.review_text).map(r => r.review_text).slice(0, 5),
    sample_positives: reviews.filter(r => r.result_rating === 'Positive' && r.review_text).map(r => r.review_text).slice(0, 5),
    reviews,
  };
}

// ── Shared CSS ─────────────────────────────────────────────────────────────
const CSS = `
  :root{--bg:#0f1117;--card:#1a1d27;--border:#2a2d3a;--accent:#6c63ff;
    --green:#22c55e;--yellow:#f59e0b;--red:#ef4444;--blue:#3b82f6;--text:#e2e8f0;--muted:#94a3b8;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;}
  header{padding:20px 32px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;}
  header h1{font-size:20px;font-weight:700;color:#fff;}
  header h1 span{color:var(--accent);}
  .meta{color:var(--muted);font-size:12px;}
  .nav{display:flex;gap:8px;flex-wrap:wrap;}
  .nav a{padding:5px 12px;border-radius:6px;border:1px solid var(--border);color:var(--muted);text-decoration:none;font-size:12px;transition:all .15s;}
  .nav a:hover,.nav a.active{background:var(--accent);border-color:var(--accent);color:#fff;}
  .container{max-width:1400px;margin:0 auto;padding:24px 32px;}
  .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px;}
  .kpi{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;}
  .kpi .label{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;}
  .kpi .value{font-size:28px;font-weight:700;color:#fff;}
  .kpi .sub{color:var(--muted);font-size:12px;margin-top:4px;}
  .section{margin-bottom:36px;}
  .section h2{font-size:15px;font-weight:600;color:#fff;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid var(--border);}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
  .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
  .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;}
  .card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;}
  .card h3{font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:14px;}
  .chart-wrap{position:relative;height:200px;}
  .chart-wrap-lg{position:relative;height:300px;}
  table{width:100%;border-collapse:collapse;}
  thead th{text-align:left;padding:9px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--border);white-space:nowrap;}
  tbody tr{border-bottom:1px solid var(--border);}
  tbody tr:hover{background:rgba(108,99,255,.06);}
  tbody td{padding:10px 12px;vertical-align:middle;}
  tbody tr:last-child{border-bottom:none;}
  .stars{color:#f59e0b;font-weight:600;}
  .badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;}
  .badge-green{background:rgba(34,197,94,.15);color:var(--green);}
  .badge-yellow{background:rgba(245,158,11,.15);color:var(--yellow);}
  .badge-red{background:rgba(239,68,68,.15);color:var(--red);}
  .badge-blue{background:rgba(59,130,246,.15);color:var(--blue);}
  .badge-purple{background:rgba(108,99,255,.15);color:#a78bfa;}
  .badge-gray{background:#1e293b;color:#64748b;}
  .bar-bg{background:var(--border);border-radius:4px;height:6px;flex:1;}
  .bar-fill{height:6px;border-radius:4px;}
  .bar-row{display:flex;align-items:center;gap:8px;}
  .bar-label{min-width:28px;text-align:right;color:var(--muted);font-size:12px;}
  /* Review cards */
  .review-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:10px;position:relative;}
  .review-card:hover{border-color:rgba(108,99,255,.4);}
  .review-card .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:12px;}
  .review-card .author{font-weight:600;color:#fff;font-size:13px;}
  .review-card .date{color:var(--muted);font-size:12px;white-space:nowrap;}
  .review-card .text{color:#e2e8f0;line-height:1.7;font-size:14px;margin-bottom:10px;}
  .review-card .copy-btn{position:absolute;top:12px;right:12px;background:rgba(108,99,255,.15);border:1px solid rgba(108,99,255,.3);color:#a78bfa;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;opacity:0;transition:opacity .15s;}
  .review-card:hover .copy-btn{opacity:1;}
  .review-card .copy-btn:hover{background:rgba(108,99,255,.3);}
  .tags{display:flex;gap:6px;flex-wrap:wrap;}
  /* Filter bar */
  .filter-bar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center;}
  .filter-bar select{background:var(--card);border:1px solid var(--border);border-radius:7px;padding:6px 10px;color:var(--text);font-size:12px;outline:none;}
  .filter-bar select:focus{border-color:var(--accent);}
  .filter-bar label{color:var(--muted);font-size:12px;}
  .review-count{color:var(--muted);font-size:12px;margin-left:auto;}
  @media(max-width:900px){.kpi-row,.grid-2,.grid-3,.grid-4{grid-template-columns:1fr 1fr;}}
  @media(max-width:600px){.kpi-row,.grid-2,.grid-3,.grid-4{grid-template-columns:1fr;}}
`;

const CHART_JS = `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>`;

const CHART_HELPERS = `
Chart.defaults.color='#94a3b8';Chart.defaults.borderColor='#2a2d3a';
function barChart(id,labels,datasets,opts={}){
  new Chart(document.getElementById(id),{type:'bar',data:{labels,datasets},options:{
    indexAxis:opts.horizontal?'y':'x',responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:opts.legend||false},tooltip:{callbacks:{label:ctx=>' '+ctx.parsed[opts.horizontal?'x':'y']+(opts.suffix||'')}}},
    scales:{x:{grid:{color:'#2a2d3a'},ticks:{color:'#94a3b8'},stacked:opts.stacked||false,max:opts.xmax},
            y:{grid:{display:opts.horizontal?false:true,color:'#2a2d3a'},ticks:{color:'#e2e8f0',font:{size:11}},stacked:opts.stacked||false}}}});
}
function donut(id,labels,data,colors){
  new Chart(document.getElementById(id),{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:'#94a3b8',boxWidth:12,padding:12}}}}});
}
function starStr(n){return '★'.repeat(Math.round(n))+'☆'.repeat(5-Math.round(n))+' '+n.toFixed(1);}
function sentBadge(p){return p>=85?'<span class="badge badge-green">'+p+'%</span>':p>=65?'<span class="badge badge-yellow">'+p+'%</span>':'<span class="badge badge-red">'+p+'%</span>';}
function negBadge(p){return p===0?'<span class="badge badge-green">'+p+'%</span>':p<=10?'<span class="badge badge-yellow">'+p+'%</span>':'<span class="badge badge-red">'+p+'%</span>';}
function pctBar(p,color){return '<div class="bar-row"><div class="bar-bg"><div class="bar-fill" style="width:'+p+'%;background:'+color+'"></div></div><span class="bar-label">'+p+'%</span></div>';}
function shortName(b){return b.replace('Tattoo Removal & Fading','').replace('Tattoo Removal','').replace('Laser Clinic','').replace('Medical Aesthetics','Med Aesthetics').replace('Med Spa & Hair Restoration','Med Spa').replace('Cosmetic Center','Cosmetics').replace('(Aesthetica)','').trim();}
const starColor=s=>s>=4.8?'#22c55e':s>=4.5?'#3b82f6':s>=4?'#f59e0b':'#ef4444';
`;

// ── City list and nav links ────────────────────────────────────────────────
const cityKeys = [...new Set(all.map(r => `${r.location_city}, ${r.location_state}`))].sort();
const cityNavLinks = cityKeys.map(c => `<a href="dashboard-v4-city-${slug(c)}.html">${c}</a>`).join('');

// ══════════════════════════════════════════════════════════════════════════
// 1. PER-CITY DASHBOARDS
// ══════════════════════════════════════════════════════════════════════════
for (const cityKey of cityKeys) {
  const [city, state] = cityKey.split(', ');
  const cityReviews = all.filter(r => r.location_city === city && r.location_state === state);
  const providers = [...new Set(cityReviews.map(r => r.provider_name))];

  const bizData = providers.map(p => {
    const s = summarize(cityReviews.filter(r => r.provider_name === p));
    const method = cityReviews.find(r => r.provider_name === p)?.method_used;
    return { provider: p, method, ...s };
  }).sort((a,b) => b.avg_stars - a.avg_stars);

  const filename = `dashboard-v4-city-${slug(cityKey)}.html`;
  const scriptData = JSON.stringify({ cityKey, businesses: bizData.map(b => ({ ...b, reviews: undefined, sample_negatives: undefined, sample_positives: undefined })) });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>ReviewIntel — ${cityKey}</title>
${CHART_JS}
<style>${CSS}</style>
</head>
<body>
<header>
  <div>
    <div class="meta" style="margin-bottom:4px">ReviewIntel · City Report</div>
    <h1><span>${cityKey}</span> — Competitor Analysis</h1>
  </div>
  <div class="nav">
    ${cityNavLinks}
    <a href="dashboard-v4-overview.html">← Overview</a>
  </div>
</header>
<div class="container">

  <div class="kpi-row" id="kpis"></div>

  <div class="section">
    <h2>Competitor Rankings — ${cityKey}</h2>
    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead><tr>
          <th>Provider</th><th>Reviews</th><th>Avg Stars</th>
          <th>Positive Results</th><th>Negative Results</th><th>Pain Mentions</th><th>Scarring</th><th>Method</th>
        </tr></thead>
        <tbody id="biz-table"></tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <h2>Ratings Comparison</h2>
    <div class="grid-2">
      <div class="card"><h3>Avg Star Rating</h3><div class="chart-wrap"><canvas id="starsChart"></canvas></div></div>
      <div class="card"><h3>Positive vs Negative Results</h3><div class="chart-wrap"><canvas id="resultChart"></canvas></div></div>
    </div>
  </div>

  <div class="section">
    <h2>Business Cards</h2>
    <div class="grid-3" id="biz-cards"></div>
  </div>

</div>
<script>
const DATA = ${scriptData};
const biz = DATA.businesses;
${CHART_HELPERS}

const best  = biz.reduce((a,b) => a.avg_stars > b.avg_stars ? a : b);
const worst = biz.reduce((a,b) => a.result_pct.negative > b.result_pct.negative ? a : b);
const marketAvg = (biz.reduce((a,b) => a+b.avg_stars, 0) / biz.length).toFixed(1);
document.getElementById('kpis').innerHTML = [
  { label:'Competitors Analyzed', value: biz.length, sub: DATA.cityKey },
  { label:'Market Avg Rating',    value: marketAvg+'★', sub: 'across all providers' },
  { label:'Top Rated',            value: shortName(best.provider), sub: best.avg_stars+'★' },
  { label:'Most Negative',        value: shortName(worst.provider), sub: worst.result_pct.negative+'% negative results' },
].map(k=>\`<div class="kpi"><div class="label">\${k.label}</div><div class="value" style="font-size:20px">\${k.value}</div><div class="sub">\${k.sub}</div></div>\`).join('');

document.getElementById('biz-table').innerHTML = biz.map(b=>\`
  <tr>
    <td style="font-weight:600;color:#fff">\${b.provider}</td>
    <td>\${b.total}</td>
    <td class="stars">\${starStr(b.avg_stars)}</td>
    <td>\${sentBadge(b.result_pct.positive)}</td>
    <td>\${negBadge(b.result_pct.negative)}</td>
    <td>\${pctBar(b.pain_pct,'#f59e0b')}</td>
    <td>\${pctBar(b.scarring_pct,'#ef4444')}</td>
    <td><span class="badge badge-purple">\${b.method||'—'}</span></td>
  </tr>
\`).join('');

document.getElementById('biz-cards').innerHTML = biz.map(b=>\`
  <div class="card">
    <div style="font-weight:700;color:#fff;font-size:15px;margin-bottom:4px">\${shortName(b.provider)}</div>
    <div class="stars" style="margin-bottom:10px">\${starStr(b.avg_stars)} <span style="color:var(--muted);font-size:12px">(\${b.total} reviews)</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div><div style="color:var(--muted);font-size:11px;margin-bottom:2px">Positive Results</div>\${sentBadge(b.result_pct.positive)}</div>
      <div><div style="color:var(--muted);font-size:11px;margin-bottom:2px">Negative Results</div>\${negBadge(b.result_pct.negative)}</div>
      <div><div style="color:var(--muted);font-size:11px;margin-bottom:2px">Pain Mentions</div><strong>\${b.pain_pct}%</strong></div>
      <div><div style="color:var(--muted);font-size:11px;margin-bottom:2px">Scarring</div><strong>\${b.scarring_pct}%</strong></div>
    </div>
    <div style="color:var(--muted);font-size:11px">Method: <span class="badge badge-gray">\${b.method||'—'}</span></div>
  </div>
\`).join('');

const labels = biz.map(b=>shortName(b.provider));
barChart('starsChart', labels, [{ data:biz.map(b=>b.avg_stars), backgroundColor:biz.map(b=>starColor(b.avg_stars)), borderRadius:4, borderSkipped:false }], { horizontal:true, xmax:5, suffix:' ★' });
barChart('resultChart', labels, [
  { label:'Positive', data:biz.map(b=>b.result_pct.positive), backgroundColor:'#22c55e', borderRadius:4, borderSkipped:false },
  { label:'Negative', data:biz.map(b=>b.result_pct.negative), backgroundColor:'#ef4444', borderRadius:4, borderSkipped:false },
], { horizontal:true, legend:true, xmax:100, suffix:'%' });
</script>
</body></html>`;

  fs.writeFileSync(filename, html);
  console.log(`✓ ${filename}`);
}

// ══════════════════════════════════════════════════════════════════════════
// 2. PER-COMPETITOR DASHBOARDS
// ══════════════════════════════════════════════════════════════════════════
const providerKeys = [...new Set(all.map(r => `${r.provider_name}|||${r.location_city}|||${r.location_state}`))];

for (const key of providerKeys) {
  const [provider, city, state] = key.split('|||');
  const cityKey = `${city}, ${state}`;
  const reviews = all.filter(r => r.provider_name === provider && r.location_city === city && r.location_state === state);
  const s = summarize(reviews);
  if (!s) continue;

  const ratingDist = [1,2,3,4,5].map(n => reviews.filter(r => Math.round(r.star_rating) === n).length);
  const compSlug = slug(`${provider}-${cityKey}`);
  const filename = `dashboard-v4-competitor-${compSlug}.html`;
  const method = reviews[0]?.method_used || '—';

  // Use case distribution (excluding unknown)
  const useCaseKnown = Object.entries(s.use_case).filter(([k]) => k !== 'unknown').sort((a,b) => b[1]-a[1]);

  // Pain level distribution
  const painLevels = [1,2,3,4,5].map(n => reviews.filter(r => r.pain_level === n).length);

  const reviewsJson = JSON.stringify(reviews.map(r => ({
    author: r.reviewer_name,
    stars: r.star_rating,
    date: r.review_date,
    text: r.review_text,
    result: r.result_rating,
    pain: r.pain_level,
    sessions: r.sessions_completed,
    use_case: r.use_case,
    scarring: r.scarring_mentioned,
  })));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>ReviewIntel — ${provider}</title>
${CHART_JS}
<style>${CSS}</style>
</head>
<body>
<header>
  <div>
    <div class="meta" style="margin-bottom:4px">ReviewIntel · Competitor Deep-Dive</div>
    <h1><span>${provider}</span> — ${cityKey}</h1>
  </div>
  <div class="nav">
    <a href="dashboard-v4-city-${slug(cityKey)}.html">← ${cityKey}</a>
    <a href="dashboard-v4-overview.html">← Overview</a>
  </div>
</header>
<div class="container">

  <div class="kpi-row">
    <div class="kpi"><div class="label">Total Reviews</div><div class="value">${s.total}</div><div class="sub">Google · ${cityKey}</div></div>
    <div class="kpi"><div class="label">Avg Rating</div><div class="value">${s.avg_stars}★</div><div class="sub">out of 5</div></div>
    <div class="kpi"><div class="label">Positive Results</div><div class="value" style="color:var(--green)">${s.result_pct.positive}%</div><div class="sub">${s.result_pct.negative}% negative</div></div>
    <div class="kpi"><div class="label">Method</div><div class="value" style="font-size:18px">${method}</div><div class="sub">${s.avg_sessions ? s.avg_sessions+' avg sessions' : 'sessions not enough data'}</div></div>
  </div>

  <div class="section">
    <h2>Performance Overview</h2>
    <div class="grid-2">
      <div class="card"><h3>Rating Distribution</h3><div class="chart-wrap"><canvas id="ratingDist"></canvas></div></div>
      <div class="card"><h3>Result Rating Breakdown</h3><div class="chart-wrap"><canvas id="resultDonut"></canvas></div></div>
    </div>
  </div>

  <div class="section">
    <h2>Pain &amp; Use Case</h2>
    <div class="grid-2">
      <div class="card"><h3>Pain Level Distribution (when mentioned)</h3><div class="chart-wrap"><canvas id="painChart"></canvas></div></div>
      <div class="card"><h3>Use Case Breakdown</h3>
        <div style="margin-top:8px">${useCaseKnown.map(([k,v]) => `<div class="bar-row" style="margin-bottom:10px"><div style="min-width:130px;color:var(--text);font-size:12px">${k}</div><div class="bar-bg"><div class="bar-fill" style="width:${pct(v, reviews.length)}%;background:var(--accent)"></div></div><span class="bar-label">${v}</span></div>`).join('') || '<div style="color:var(--muted);font-size:12px">No use case data</div>'}
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>All Reviews <span style="color:var(--muted);font-size:13px;font-weight:400">(${s.total})</span></h2>
    <div class="filter-bar">
      <label>Filter:</label>
      <select id="filter-result" onchange="renderReviews()">
        <option value="">All Results</option>
        <option value="Positive">Positive</option>
        <option value="Neutral">Neutral</option>
        <option value="Mixed">Mixed</option>
        <option value="Negative">Negative</option>
      </select>
      <select id="filter-stars" onchange="renderReviews()">
        <option value="">All Stars</option>
        <option value="5">5★</option>
        <option value="4">4★</option>
        <option value="3">3★</option>
        <option value="2">2★</option>
        <option value="1">1★</option>
      </select>
      <select id="filter-usecase" onchange="renderReviews()">
        <option value="">All Use Cases</option>
        <option value="Complete">Complete Removal</option>
        <option value="Cover-up">Cover-up</option>
        <option value="Microblading">Microblading</option>
        <option value="Color">Color Ink</option>
      </select>
      <span class="review-count" id="review-count"></span>
    </div>
    <div id="reviews-list"></div>
  </div>

</div>
<script>
${CHART_HELPERS}
const REVIEWS = ${reviewsJson};
const ratingDist = ${JSON.stringify(ratingDist)};
const painLevels = ${JSON.stringify(painLevels)};

barChart('ratingDist',['1★','2★','3★','4★','5★'],[{data:ratingDist,backgroundColor:['#ef4444','#f97316','#f59e0b','#3b82f6','#22c55e'],borderRadius:4,borderSkipped:false}],{suffix:' reviews'});
donut('resultDonut',['Positive','Neutral','Mixed','Negative','Unknown'],
  [${s.result_pct.positive},${s.result_pct.neutral},${s.result_pct.mixed},${s.result_pct.negative},${s.result_pct.unknown}],
  ['#22c55e','#3b82f6','#f59e0b','#ef4444','#374151']);
barChart('painChart',['1-Painless','2-Minimal','3-Moderate','4-Intense','5-Severe'],[{data:painLevels,backgroundColor:['#22c55e','#86efac','#f59e0b','#f97316','#ef4444'],borderRadius:4,borderSkipped:false}],{suffix:' reviews'});

const resultColor = r => r==='Positive'?'var(--green)':r==='Negative'?'var(--red)':r==='Mixed'?'var(--yellow)':r==='Neutral'?'var(--blue)':'#374151';

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    event.target.textContent = 'Copied!';
    setTimeout(() => event.target.textContent = 'Copy', 1500);
  });
}

function renderReviews() {
  const rf = document.getElementById('filter-result').value;
  const sf = document.getElementById('filter-stars').value;
  const uf = document.getElementById('filter-usecase').value;
  const filtered = REVIEWS.filter(r =>
    (!rf || r.result === rf) &&
    (!sf || Math.round(r.stars) === parseInt(sf)) &&
    (!uf || r.use_case === uf)
  );
  document.getElementById('review-count').textContent = filtered.length + ' reviews';
  document.getElementById('reviews-list').innerHTML = filtered.map(r => \`
    <div class="review-card">
      <button class="copy-btn" onclick="copyText(\${JSON.stringify(r.text||'')})">Copy</button>
      <div class="top">
        <span class="author">\${r.author || 'Anonymous'}</span>
        <span class="date">\${r.date || ''}</span>
      </div>
      <div class="stars" style="margin-bottom:8px">\${'★'.repeat(r.stars||0)}\${'☆'.repeat(5-(r.stars||0))} \${r.stars||'?'}★</div>
      <div class="text">\${r.text || '<em style="color:var(--muted)">No review text</em>'}</div>
      <div class="tags">
        <span class="badge" style="background:rgba(0,0,0,.3);border:1px solid \${resultColor(r.result)};color:\${resultColor(r.result)}">\${r.result||'unknown'}</span>
        \${r.pain!=='unknown'?'<span class="badge badge-yellow">Pain: '+r.pain+'/5</span>':''}
        \${r.sessions!=='unknown'&&r.sessions?'<span class="badge badge-blue">'+r.sessions+' sessions</span>':''}
        \${r.use_case&&r.use_case!=='unknown'?'<span class="badge badge-purple">'+r.use_case+'</span>':''}
        \${r.scarring==='Yes'?'<span class="badge badge-red">Scarring</span>':r.scarring==='Positive'?'<span class="badge badge-green">Healed well</span>':''}
      </div>
    </div>
  \`).join('');
}
renderReviews();
</script>
</body></html>`;

  fs.writeFileSync(filename, html);
  console.log(`✓ ${filename}`);
}

// ══════════════════════════════════════════════════════════════════════════
// 3. OVERVIEW DASHBOARD
// ══════════════════════════════════════════════════════════════════════════
const overallSummary = summarize(all);
const inkoutAll = all.filter(r => r.provider_name === 'inkOUT');
const inkoutSummary = summarize(inkoutAll);
const competitorAll = all.filter(r => r.provider_name !== 'inkOUT');
const competitorSummary = summarize(competitorAll);

// Per-city summary
const citySummaries = cityKeys.map(ck => {
  const [city, state] = ck.split(', ');
  const cityRevs = all.filter(r => r.location_city === city && r.location_state === state);
  const s = summarize(cityRevs);
  return { cityKey: ck, ...s };
}).sort((a,b) => b.avg_stars - a.avg_stars);

// All providers ranked
const allProviders = [...new Set(all.map(r => `${r.provider_name}|||${r.location_city}|||${r.location_state}`))];
const providerRankings = allProviders.map(key => {
  const [provider, city, state] = key.split('|||');
  const revs = all.filter(r => r.provider_name === provider && r.location_city === city && r.location_state === state);
  const s = summarize(revs);
  return { provider, city, state, method: revs[0]?.method_used, ...s };
}).sort((a,b) => b.avg_stars - a.avg_stars);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>ReviewIntel — Overview</title>
${CHART_JS}
<style>${CSS}</style>
</head>
<body>
<header>
  <div>
    <div class="meta" style="margin-bottom:4px">ReviewIntel · Overview</div>
    <h1><span>ReviewIntel</span> — All Markets</h1>
  </div>
  <div class="nav">
    ${cityNavLinks}
  </div>
</header>
<div class="container">

  <div class="kpi-row">
    <div class="kpi"><div class="label">Total Reviews</div><div class="value">${overallSummary.total}</div><div class="sub">across all providers</div></div>
    <div class="kpi"><div class="label">Providers</div><div class="value">${allProviders.length}</div><div class="sub">across ${cityKeys.length} markets</div></div>
    <div class="kpi"><div class="label">inkout Positive</div><div class="value" style="color:var(--green)">${inkoutSummary.result_pct.positive}%</div><div class="sub">vs competitor ${competitorSummary.result_pct.positive}%</div></div>
    <div class="kpi"><div class="label">inkout Avg Stars</div><div class="value">${inkoutSummary.avg_stars}★</div><div class="sub">vs competitor ${competitorSummary.avg_stars}★</div></div>
  </div>

  <div class="section">
    <h2>All Providers Ranked</h2>
    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead><tr>
          <th>#</th><th>Provider</th><th>City</th><th>Method</th><th>Reviews</th><th>Avg Stars</th><th>Positive</th><th>Negative</th><th>Pain %</th>
        </tr></thead>
        <tbody>
          ${providerRankings.map((p,i) => `
          <tr>
            <td style="color:var(--muted)">${i+1}</td>
            <td style="font-weight:600;color:${p.provider==='inkOUT'?'#a78bfa':'#fff'}">${p.provider}${p.provider==='inkOUT'?'<span class="badge badge-purple" style="margin-left:6px">inkOUT</span>':''}</td>
            <td style="color:var(--muted)">${p.city}, ${p.state}</td>
            <td><span class="badge badge-gray">${p.method||'—'}</span></td>
            <td><a href="dashboard-v4-competitor-${slug(p.provider+'-'+p.city+', '+p.state)}.html" style="color:var(--blue)">${p.total}</a></td>
            <td class="stars">${'★'.repeat(Math.round(p.avg_stars))}${'☆'.repeat(5-Math.round(p.avg_stars))} ${p.avg_stars}</td>
            <td>${p.result_pct.positive >= 85 ? `<span class="badge badge-green">${p.result_pct.positive}%</span>` : p.result_pct.positive >= 65 ? `<span class="badge badge-yellow">${p.result_pct.positive}%</span>` : `<span class="badge badge-red">${p.result_pct.positive}%</span>`}</td>
            <td>${p.result_pct.negative === 0 ? `<span class="badge badge-green">${p.result_pct.negative}%</span>` : p.result_pct.negative <= 10 ? `<span class="badge badge-yellow">${p.result_pct.negative}%</span>` : `<span class="badge badge-red">${p.result_pct.negative}%</span>`}</td>
            <td>${p.pain_pct}%</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <h2>inkout vs Competitors</h2>
    <div class="grid-4">
      <div class="card">
        <h3>inkout Avg Stars</h3>
        <div class="value" style="font-size:32px;font-weight:700;color:#a78bfa">${inkoutSummary.avg_stars}★</div>
        <div style="color:var(--muted);font-size:12px;margin-top:6px">${inkoutSummary.total} reviews · 5 locations</div>
      </div>
      <div class="card">
        <h3>Competitor Avg Stars</h3>
        <div class="value" style="font-size:32px;font-weight:700;color:#fff">${competitorSummary.avg_stars}★</div>
        <div style="color:var(--muted);font-size:12px;margin-top:6px">${competitorSummary.total} reviews · ${allProviders.length - 5} providers</div>
      </div>
      <div class="card">
        <h3>inkout Positive Results</h3>
        <div class="value" style="font-size:32px;font-weight:700;color:var(--green)">${inkoutSummary.result_pct.positive}%</div>
        <div style="color:var(--muted);font-size:12px;margin-top:6px">vs competitor ${competitorSummary.result_pct.positive}%</div>
      </div>
      <div class="card">
        <h3>inkout Negative Results</h3>
        <div class="value" style="font-size:32px;font-weight:700;color:var(--red)">${inkoutSummary.result_pct.negative}%</div>
        <div style="color:var(--muted);font-size:12px;margin-top:6px">vs competitor ${competitorSummary.result_pct.negative}%</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Market Comparison</h2>
    <div class="grid-2">
      <div class="card"><h3>Avg Stars by Market</h3><div class="chart-wrap"><canvas id="cityStars"></canvas></div></div>
      <div class="card"><h3>Positive Results % by Market</h3><div class="chart-wrap"><canvas id="cityPositive"></canvas></div></div>
    </div>
  </div>

</div>
<script>
${CHART_HELPERS}
const citySummaries = ${JSON.stringify(citySummaries.map(c => ({ cityKey: c.cityKey, avg_stars: c.avg_stars, result_pct: c.result_pct, total: c.total })))};
const cityLabels = citySummaries.map(c => c.cityKey);
barChart('cityStars', cityLabels, [{ data: citySummaries.map(c=>c.avg_stars), backgroundColor: citySummaries.map(c=>starColor(c.avg_stars)), borderRadius:4, borderSkipped:false }], { horizontal:true, xmax:5, suffix:' ★' });
barChart('cityPositive', cityLabels, [{ data: citySummaries.map(c=>c.result_pct.positive), backgroundColor: citySummaries.map(c=>c.result_pct.positive>=70?'#22c55e':c.result_pct.positive>=50?'#f59e0b':'#ef4444'), borderRadius:4, borderSkipped:false }], { horizontal:true, xmax:100, suffix:'%' });
</script>
</body></html>`;

fs.writeFileSync('dashboard-v4-overview.html', html);
console.log(`✓ dashboard-v4-overview.html`);
console.log(`\nDone! Generated ${cityKeys.length} city + ${providerKeys.length} competitor + 1 overview dashboards.`);
