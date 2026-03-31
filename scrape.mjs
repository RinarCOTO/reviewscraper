// ReviewIntel — SerpApi Scraper
// Run: node scrape.mjs
// Output: reviews.json
import fs from 'fs';

const API_KEY = process.env.SERPAPI_KEY;
if (!API_KEY) { console.error('Missing SERPAPI_KEY env var'); process.exit(1); }

const MAX = 40;
const SORT_BY = 'newestFirst';

const COMPETITORS = [
  { name: 'Removery',              location: 'Los Angeles CA' },
  { name: 'Removery',              location: 'Woodland Hills CA' },
  { name: 'Removery',              location: 'Pasadena CA' },
  { name: 'Removery',              location: 'San Diego CA' },
  { name: 'Removery',              location: 'Chula Vista CA' },
  { name: 'Inklifters Aesthetica', location: 'Draper UT' },
];

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function scrape() {
  const allReviews = [];

  for (const comp of COMPETITORS) {
    const label = `${comp.name} ${comp.location}`;
    const q = encodeURIComponent(label);
    console.log('Searching:', label);

    const searchUrl = `https://serpapi.com/search.json?engine=google_maps&q=${q}&api_key=${API_KEY}`;
    let searchData;
    try { searchData = await get(searchUrl); }
    catch (e) { console.error('Search failed:', e.message); continue; }
    if (searchData.error) { console.error('API error:', searchData.error); continue; }

    const place = searchData.place_results || searchData.local_results?.[0];
    if (!place) { console.warn('No results for', label); continue; }

    console.log('Found:', place.title, '| ID:', place.place_id || place.data_id);

    const idParam = place.place_id ? `place_id=${place.place_id}` : `data_id=${place.data_id}`;
    const baseReviewUrl = `https://serpapi.com/search.json?engine=google_maps_reviews&${idParam}&sort_by=${SORT_BY}&api_key=${API_KEY}`;

    const reviews = [];
    let nextToken = null;
    while (reviews.length < MAX) {
      const pageUrl = nextToken
        ? `${baseReviewUrl}&next_page_token=${nextToken}`
        : baseReviewUrl;
      let reviewData;
      try { reviewData = await get(pageUrl); }
      catch (e) { console.error('Reviews failed:', e.message); break; }
      if (reviewData.error) { console.error('Reviews API error:', reviewData.error); break; }
      const batch = reviewData.reviews || [];
      reviews.push(...batch);
      nextToken = reviewData.serpapi_pagination?.next_page_token;
      if (!nextToken || batch.length === 0) break;
      await new Promise(r => setTimeout(r, 500));
    }
    console.log('Fetched', reviews.length, 'reviews');

    const compReviews = reviews.slice(0, MAX).map(r => ({
      business: place.title,
      location: comp.location,
      stars: r.rating ?? null,
      text: r.snippet || r.text || '',
      date: r.date || '',
      author: r.user?.name || 'Anonymous',
    }));

    allReviews.push(...compReviews);

    const slug = comp.location.toLowerCase().replace(/\s+/g, '-');
    const filename = `reviews-${slug}.json`;
    fs.writeFileSync(filename, JSON.stringify(compReviews, null, 2));
    console.log(`Saved ${compReviews.length} reviews → ${filename}`);

    await new Promise(r => setTimeout(r, 800));
  }

  fs.writeFileSync('reviews.json', JSON.stringify(allReviews, null, 2));
  console.log('Done!', allReviews.length, 'total reviews saved to reviews.json');
}

scrape().catch(console.error);
