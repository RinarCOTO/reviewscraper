// Combines all individual reviews-v4-*.json files into reviews-v4-all.json
// Use this when the scraper was interrupted before writing the combined file.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REVIEWS_DIR = path.join(__dirname, '../data/reviews');

const files = fs.readdirSync(REVIEWS_DIR)
  .filter(f => f.startsWith('reviews-v4-') && f !== 'reviews-v4-all.json' && f !== 'reviews-v4-batch2.json')
  .map(f => path.join(REVIEWS_DIR, f));

const all = [];
for (const file of files) {
  const reviews = JSON.parse(fs.readFileSync(file, 'utf8'));
  all.push(...reviews);
  console.log(`  ${path.basename(file)}: ${reviews.length}`);
}

const outPath = path.join(REVIEWS_DIR, 'reviews-v4-all.json');
fs.writeFileSync(outPath, JSON.stringify(all, null, 2));
console.log(`\nCombined ${all.length} reviews from ${files.length} files → reviews-v4-all.json`);
