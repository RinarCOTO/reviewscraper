// ReviewIntel — Reddit Scraper (inkOUT only)
// Searches Reddit's public JSON API — no API key required.
// Collects posts + top-level comments mentioning inkOUT from relevant subreddits.
// Output: reviews-reddit-inkout.json (same schema as Google reviews)
// Run: node scrape-reddit.mjs

import fs from 'fs';

// ── Config ──────────────────────────────────────────────────────────────────

const PROVIDER_NAME = 'inkout';
const METHOD        = 'TEPR';

// inkOUT cities for city inference
const CITY_PATTERNS = [
  { pattern: /austin/i,         city: 'Austin',  state: 'TX' },
  { pattern: /draper/i,         city: 'Draper',  state: 'UT' },
  { pattern: /salt lake|slc/i,  city: 'Draper',  state: 'UT' },
  { pattern: /tampa/i,          city: 'Tampa',   state: 'FL' },
  { pattern: /chicago/i,        city: 'Chicago', state: 'IL' },
  { pattern: /houston/i,        city: 'Houston', state: 'TX' },
];

// Subreddits to search within
const SUBREDDITS = [
  'TattooRemoval',
  'tattoo',
  'tattoos',
  'AskDermatology',
  'LaserTattooRemoval',
];

// Search queries to run globally across Reddit
// Kept tight to the brand name — avoid generic "ink out" phrases
const GLOBAL_QUERIES = [
  '"inkout" tattoo removal',
  '"inkOUT" tattoo',
  'tatt2away inkout',
  'inkout TEPR',
];

const DELAY_MS    = 1200; // be polite to Reddit
const MAX_POSTS   = 100;  // per query/subreddit
const MAX_COMMENTS = 50;  // top-level comments per post

// ── Helpers ─────────────────────────────────────────────────────────────────

const UA = 'ReviewIntel/1.0 (research scraper; contact: reviewintel@example.com)';

async function redditGet(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  });
  if (res.status === 429) throw new Error('Rate limited by Reddit');
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Best-effort city inference from freetext */
function inferCity(text = '') {
  for (const { pattern, city, state } of CITY_PATTERNS) {
    if (pattern.test(text)) return { city, state };
  }
  return { city: 'Unknown', state: 'Unknown' };
}

/** Convert a Reddit epoch timestamp to a readable date string */
function epochToDate(epoch) {
  return new Date(epoch * 1000).toISOString().split('T')[0];
}

/** Check if text is substantive enough to be useful */
function isSubstantive(text = '') {
  return text && text.trim().length > 30;
}

// Matches the brand "inkOUT" / "inkout" as a whole word.
// Rejects generic phrases like "sento_ink out of...", "get ink out of clothes",
// "pull the ink out", etc. — those never have "inkout" as one token.
const INKOUT_BRAND = /\binkout\b/i;

// inkOUT only operates in the US. Exclude posts clearly about other countries.
const NON_US_PATTERNS = /\bsingapore\b|\buk\b|\bcanada\b|\baustralia\b|\bindia\b|\bunited kingdom\b/i;

/** Check if text is about the inkOUT brand */
function mentionsInkout(text = '') {
  if (NON_US_PATTERNS.test(text)) return false;
  return INKOUT_BRAND.test(text);
}

// ── Core fetch functions ─────────────────────────────────────────────────────

/**
 * Search Reddit (global or within a subreddit) and return post listings.
 */
async function searchPosts(query, subreddit = null) {
  const base = subreddit
    ? `https://www.reddit.com/r/${subreddit}/search.json`
    : 'https://www.reddit.com/search.json';

  const params = new URLSearchParams({
    q:      query,
    sort:   'relevance',
    limit:  String(MAX_POSTS),
    type:   'link',
    ...(subreddit ? { restrict_sr: 'on' } : {}),
  });

  const url = `${base}?${params}`;
  console.log(`  GET ${url}`);

  try {
    const data = await redditGet(url);
    return data?.data?.children?.map(c => c.data) ?? [];
  } catch (e) {
    console.warn(`  Warning: ${e.message}`);
    return [];
  }
}

/**
 * Fetch top-level comments for a post by its ID.
 */
async function fetchComments(postId) {
  const url = `https://www.reddit.com/comments/${postId}.json?limit=${MAX_COMMENTS}&depth=1`;
  try {
    const data = await redditGet(url);
    // data[0] = post, data[1] = comments listing
    const commentChildren = data?.[1]?.data?.children ?? [];
    return commentChildren
      .map(c => c.data)
      .filter(c => c.body && c.body !== '[deleted]' && c.body !== '[removed]');
  } catch (e) {
    console.warn(`  Warning fetching comments for ${postId}: ${e.message}`);
    return [];
  }
}

// ── Review builder ───────────────────────────────────────────────────────────

function buildPostReview(post) {
  const fullText = `${post.title || ''} ${post.selftext || ''}`;
  if (!mentionsInkout(fullText)) return null;
  if (!isSubstantive(fullText))  return null;

  const { city, state } = inferCity(fullText);

  return {
    provider_name:  PROVIDER_NAME,
    location_city:  city,
    location_state: state,
    method_used:    METHOD,
    review_text:    post.selftext ? `${post.title}\n\n${post.selftext}`.trim() : post.title,
    star_rating:    null,
    review_date:    epochToDate(post.created_utc),
    reviewer_name:  post.author || 'Anonymous',
    verified_source: 'Reddit',
    _reddit_url:    `https://www.reddit.com${post.permalink}`,
    _subreddit:     post.subreddit,
    _score:         post.score,
    _type:          'post',
  };
}

function buildCommentReview(comment, post) {
  const combined = `${post.title} ${comment.body}`;
  if (!mentionsInkout(combined)) return null;
  if (!isSubstantive(comment.body)) return null;

  const { city, state } = inferCity(combined);

  return {
    provider_name:  PROVIDER_NAME,
    location_city:  city,
    location_state: state,
    method_used:    METHOD,
    review_text:    comment.body.trim(),
    star_rating:    null,
    review_date:    epochToDate(comment.created_utc),
    reviewer_name:  comment.author || 'Anonymous',
    verified_source: 'Reddit',
    _reddit_url:    `https://www.reddit.com${post.permalink}`,
    _subreddit:     comment.subreddit || post.subreddit,
    _score:         comment.score,
    _type:          'comment',
    _post_title:    post.title,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function scrape() {
  console.log('ReviewIntel — Reddit scraper (inkOUT only)\n');

  const seenPostIds = new Set();
  const allPosts    = [];  // raw post objects (de-duped)

  // 1. Global searches
  console.log('── Global Reddit searches ──');
  for (const query of GLOBAL_QUERIES) {
    console.log(`\nQuery: "${query}"`);
    const posts = await searchPosts(query);
    for (const post of posts) {
      if (!seenPostIds.has(post.id)) {
        seenPostIds.add(post.id);
        allPosts.push(post);
      }
    }
    console.log(`  ${posts.length} posts found (${seenPostIds.size} unique so far)`);
    await sleep(DELAY_MS);
  }

  // 2. Subreddit-scoped searches
  console.log('\n── Subreddit searches (query: "inkout") ──');
  for (const sub of SUBREDDITS) {
    console.log(`\nr/${sub}`);
    const posts = await searchPosts('inkout', sub);
    for (const post of posts) {
      if (!seenPostIds.has(post.id)) {
        seenPostIds.add(post.id);
        allPosts.push(post);
      }
    }
    console.log(`  ${posts.length} posts found (${seenPostIds.size} unique so far)`);
    await sleep(DELAY_MS);
  }

  console.log(`\n── Processing ${allPosts.length} unique posts ──\n`);

  const reviews = [];
  let postsWithMention = 0;

  for (const post of allPosts) {
    const postReview = buildPostReview(post);

    if (postReview) {
      reviews.push(postReview);
      postsWithMention++;
      process.stdout.write(`[post]    r/${post.subreddit} — "${post.title.slice(0, 60)}"\n`);

      // Fetch comments for posts that mention inkOUT
      await sleep(DELAY_MS);
      const comments = await fetchComments(post.id);
      let commentCount = 0;
      for (const comment of comments) {
        const cr = buildCommentReview(comment, post);
        if (cr) { reviews.push(cr); commentCount++; }
      }
      if (commentCount > 0) {
        process.stdout.write(`           └─ ${commentCount} matching comment(s)\n`);
      }
    } else {
      // Post title mentions inkout but body doesn't have enough — still check comments
      const titleMentions = mentionsInkout(post.title);
      if (titleMentions) {
        await sleep(DELAY_MS);
        const comments = await fetchComments(post.id);
        let commentCount = 0;
        for (const comment of comments) {
          const cr = buildCommentReview(comment, post);
          if (cr) { reviews.push(cr); commentCount++; }
        }
        if (commentCount > 0) {
          postsWithMention++;
          process.stdout.write(`[title]   r/${post.subreddit} — "${post.title.slice(0, 60)}"\n`);
          process.stdout.write(`           └─ ${commentCount} matching comment(s)\n`);
        }
      }
    }
  }

  // City breakdown
  const cities = {};
  for (const r of reviews) {
    const key = `${r.location_city}, ${r.location_state}`;
    cities[key] = (cities[key] || 0) + 1;
  }

  const outFile = 'reviews-reddit-inkout.json';
  fs.writeFileSync(outFile, JSON.stringify(reviews, null, 2));

  console.log('\n══════════════════════════════════════════');
  console.log('REDDIT SCRAPE SUMMARY — inkOUT');
  console.log('══════════════════════════════════════════');
  console.log(`  Posts scanned:        ${allPosts.length}`);
  console.log(`  Posts with mention:   ${postsWithMention}`);
  console.log(`  Total entries saved:  ${reviews.length}`);
  console.log(`    Posts:    ${reviews.filter(r => r._type === 'post').length}`);
  console.log(`    Comments: ${reviews.filter(r => r._type === 'comment').length}`);
  console.log('\n  City breakdown:');
  for (const [city, count] of Object.entries(cities)) {
    console.log(`    ${city}: ${count}`);
  }
  console.log('══════════════════════════════════════════');
  console.log(`\nDone → ${outFile}`);
}

scrape().catch(console.error);
