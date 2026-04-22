# Review Dataset: Evaluation Questions and Answers

**Dataset:** analyzed-v4-all-dated.json
**Scrape date:** April 2, 2026
**Answered:** April 22, 2026
**Total reviews:** 848 across 22 locations, 13 brands, 6 markets

---

## Data Accuracy and Integrity

**How accurate are these ratings?**
Star ratings are accurate as scraped from Google Maps on April 2, 2026. They reflect the exact rating each reviewer submitted. They are not calculated or averaged by us. What is not accurate is the date attached to each review: all dates are estimated from relative strings (e.g. "2 months ago") and carry month-level accuracy only. One review (Emma Kondris, inkOUT Draper) has a verified date of January 12, 2026, confirmed by a reviewer screenshot. All others are estimates.

**Are these ratings real and verifiable?**
The star ratings are real Google data. Every review in this dataset was publicly visible on Google Maps at the time of the scrape. The review text, reviewer names, and star ratings can be independently verified by visiting the corresponding Google Maps listing. Dates cannot be independently verified from this dataset alone because Google Maps does not display absolute dates on its public interface. They show relative strings only.

**What time period do these reviews cover?**
Based on estimated dates, the dataset spans approximately April 2018 to April 2026. The oldest reviews are 6-year-old entries (estimated April 2020 based on scrape date). Most reviews are from 2024 to early 2026, reflecting the recency-first scraping order.

**Do we have access to the underlying review data for legal or internal review?**
Yes. The full dataset is stored in analyzed-v4-all-dated.json and includes: reviewer name, star rating, full review text, estimated date (with raw original string), provider name, location, and all analysis flags. A CSV export also exists at reviews-all-export.csv. Both files can be shared with attorneys. Any legal use must disclose that dates are estimated, not verified absolutes. One date (Emma Kondris) is verified.

**Why do competitors show 5.0 stars despite negative themes?**
Four competitors (MEDermis Laser Clinic, Arviv Medical Aesthetics, Enfuse Medical Spa, Clean Slate Ink) show 5.0 average ratings in this dataset because the scraper pulled up to 50 of the most recent reviews and all 50 happened to be 5-star. These businesses likely have more reviews on Google, including negative ones, that were not captured. The 5.0 rating in this dataset reflects the sample, not the complete review history.

**Why do different negative rates still result in identical ratings?**
Because this is a sample of recent reviews, not a full history. Two providers can both show 4.9 stars while one has more critical reviews in its full Google history that were outside the 50-review sample window. The dataset reflects what was most recently posted, which trends positive on most Google listings.

**Does the positive vs. negative breakdown match the ratings?**
Partially. The star distribution is: 1-star (35), 2-star (3), 3-star (5), 4-star (6), 5-star (799). That is 94.2% five-star. This does not reflect the true distribution of any of these businesses on Google. It is an artifact of the recency-first sampling method. The result-rating field (Positive, Negative, Mixed, Neutral) was AI-analyzed from review text and gives a more nuanced picture than star ratings alone.

**Are reviews correctly mapped to the right business?**
Mostly yes, with one known exception. inkOUT locations in Austin, Chicago, Draper, and Houston share Google Maps listings with the former Tatt2Away operation at those addresses. 79 reviews in the inkOUT dataset are flagged as transition-era, meaning the reviewer may have been a Tatt2Away customer rather than an inkOUT customer. These are labeled with a transition_note field and a visible badge in the dashboard.

**Are ratings being combined in a way that distorts results?**
Yes, at the brand level. Removery has 150 reviews across 3 locations. inkOUT has 149 reviews across 5 locations. If totals are compared brand vs. brand without normalizing for location count, Removery appears to have more data even though inkOUT operates in more markets. All dashboards now include a disclosure note on this. Comparisons should be made at the location level.

**Is the data separated by date, ownership, or legacy reviews?**
Partially. The transition_era flag separates legacy Tatt2Away reviews from current inkOUT reviews. Date separation is available via the review_date_estimated field (YYYY-MM format). Ownership separation is not tracked beyond the transition flag. There is no automatic split by ownership period other than those 79 flagged reviews.

**Are we capturing all reviews or only a subset?**
A subset. The scraper collected up to 50 of the most recent reviews per location, sorted newest first. Most competitor locations have far more than 50 reviews on Google. inkOUT locations with fewer than 50 reviews in the dataset (Chicago: 7, Tampa: 20, Austin: 30, Draper: 42) simply had fewer reviews available on Google at the time of scrape, not because the scraper cut them short.

**Is the dashboard balanced or overly positive?**
Currently skewed positive due to the sampling method. 94.2% of reviews are 5-star. The dashboard does surface all 35 negative reviews and allows filtering to show them. The disclosure banner on every page explains the sampling limitation. A fully balanced dataset would require pulling the complete review history, not just the 50 most recent.

**Are negative reviews sufficiently surfaced?**
They exist and are accessible. The competitor dashboards allow filtering by star rating and result type to isolate negative reviews. The 35 one-star reviews are present in full, including 12 for inkOUT. They are not hidden or suppressed. However, at 4.1% of total reviews, they are easy to miss in aggregate views.

**Does the data feel trustworthy or manipulated?**
With the disclosure banner and date labels now present on every dashboard, the data presentation is honest. Without that context it would look suspicious because 799 of 848 reviews being 5-star is not realistic for any real business. The current implementation explains this clearly as a sampling artifact, which makes it defensible.

**Is the rating calculation clearly explained?**
The average star ratings shown in dashboards are simple arithmetic averages of the star ratings in the sample. No weighting, no normalization. This is stated in the data disclosure document. What is not explained in the dashboards is that the sample is recency-biased, which affects what the average represents. That context is in the disclosure banner.

**Is the data source clearly shown?**
Yes, as of the most recent build. Every dashboard page now shows a yellow disclosure banner at the top identifying Google Maps as the source, April 2, 2026 as the scrape date, and the sample size per location. A footer repeats this on every page. A link to data_disclosure.json is included.

**Can users access the full review feed easily?**
Yes. Each competitor dashboard shows all reviews for that location with filters for star rating, result type, use case, transition era, and text vs. rating-only. Every review is visible with full text, estimated date, reviewer name, and analysis tags.

**Is there enough historical depth?**
Barely sufficient. The dataset goes back approximately to 2018 based on estimated dates, but the bulk of reviews are from 2024 to 2026. For inkOUT specifically, reviews go back to when the Tatt2Away-era operation began at those locations. For a legal argument requiring multi-year trend analysis, the current depth is limited by the 50-review cap per location.

**Does the dashboard support legal or business arguments?**
It supports them with the following caveats that must be disclosed in any legal use: dates are estimated not verified (except Emma Kondris), data is a sample not complete history, 79 inkOUT reviews may reflect Tatt2Away-era experiences, and star distribution is skewed by recency sampling. With those disclosures stated, the review texts, star ratings, and reviewer names are real verifiable Google data.

**Does it show the correct comparison set?**
Yes. The comparison set covers all direct competitors in each of the five inkOUT markets: Austin TX, Chicago IL, Draper UT, Houston TX, and Tampa FL. Each city dashboard compares all providers operating in that market. Tatt2Away is included separately as a distinct brand even where its locations overlap with inkOUT.

---

## Data Structure and Organization

**Are business names, locations, and labels correct?**
Yes with one known issue. The Inklifters location is labeled as Pleasant Grove, UT rather than Draper, UT because it physically operates in Pleasant Grove. All other names and locations match the Google Maps listings as scraped. The brand_name field normalizes multi-location providers (Removery, inkOUT, Tatt2Away) to their parent brand.

**Does the data reflect current reality or outdated ratings?**
It reflects Google Maps as of April 2, 2026. Any reviews posted after that date are not in the dataset. Businesses that have changed since that date (new ownership, closures, rebrandings) are not reflected.

**Should reviews be separated more clearly by location or brand?**
The current structure already separates by location. Each provider-location combination has its own dashboard file and its own data slice. The brand_name field allows brand-level grouping when needed. The multi_location_brand flag identifies which brands need location-level analysis to be fair.

**Should inherited or transferred ratings be clarified?**
Yes, and this is partially addressed. The 79 transition-era reviews are flagged and labeled. What is not addressed is that Google Maps star ratings for inkOUT locations include all historical ratings from when the listing was under Tatt2Away. The overall Google star average shown on Google Maps (not in this dataset) is a blend of Tatt2Away and inkOUT era reviews. This is worth disclosing separately from the dataset itself.

**Is the data easy for stakeholders to understand quickly?**
The overview dashboard and city dashboards give a fast summary. The KPI cards, ranking tables, and charts are readable without technical knowledge. The disclosure banner adds necessary context without overwhelming the layout. For non-technical stakeholders, the competitor deep-dive pages may have more detail than needed. A one-page executive summary would improve accessibility for legal or executive review.

---

## SEO and AI Visibility

**Does the dashboard support SEO and AI visibility goals?**
The HTML dashboards are static files. They are not indexed by search engines in their current form because they are local files. To support SEO they would need to be hosted on a public domain with proper meta tags, structured data (Schema.org Review markup), and canonical URLs.

**Is there enough content volume for AI systems?**
738 reviews with full text across 22 locations is a strong content base. The review texts range from short to several paragraphs. For AI systems that scan public web content, the volume is sufficient once hosted. For internal AI analysis (summarization, sentiment, pattern detection), the current volume is already usable.

**Are summaries aligned with how search engines interpret data?**
Not yet. The dashboards do not include Schema.org structured data, meta descriptions, or review aggregate markup. These would need to be added before hosting if SEO is a goal.

**Are review themes categorized consistently?**
The AI analysis fields (result_rating, use_case, pain_level, scarring_mentioned) were applied consistently across all 848 reviews using the same analysis pipeline. The categories are: result_rating (Positive, Negative, Mixed, Neutral), use_case (Complete, Cover-up, Microblading, Color, unknown), pain_level (1-5 or unknown), scarring_mentioned (Yes, No, Positive). Consistency depends on the AI model used during analysis. The categories are defined but not validated by human review.

---

## Usability and UX

**Does the dashboard need better filtering or segmentation?**
The competitor dashboards now have five filters: result type, star rating, use case, transition era, and text vs. rating-only. This covers the main use cases. What is still missing is a date range filter. Once SerpAPI verified dates are in place, filtering by year would be a valuable addition for showing recent-only vs. historical data.

**Are there inconsistencies that reduce trust?**
Two remain. First, the star counts are uneven: competitors are capped at 50 while some inkOUT locations have fewer. A reader who notices that inkOUT Chicago has 7 reviews vs. 50 for every competitor in Chicago may question whether the comparison is fair. Second, the date estimates display as month-year only, which is less precise than what users might expect from a professional dataset.

**Does the visual presentation look credible and polished?**
The dark-theme dashboards with Chart.js charts, badge labels, and consistent typography look professional. The new amber disclosure banner is visible and honest without dominating the layout. The review cards with transition and rating-only badges add credibility through transparency.

**Does it highlight key insights without overwhelming users?**
The KPI row at the top of each page surfaces the four most important numbers immediately. The ranking table provides detail on demand. Review cards require scrolling to read. For executive or legal audiences, the volume of individual review cards may be more than needed. A summary section with key quotes would improve the experience for those audiences.

**Is positive vs. negative data easy to understand at a glance?**
Yes. The ranking tables show positive and negative percentages as color-coded badges (green, yellow, red). The Positive vs. Negative Results chart on city pages gives an immediate visual comparison. Negative reviews are filterable and readable at the individual review level.

---

## Positioning and Competitive Insight

**Does the dashboard show what makes inkOUT stronger than competitors?**
inkOUT's overall average across all locations is 4.71 stars. In Houston, inkOUT matches the market average. In Draper, inkOUT scores lower than Clarity Skin and Inklifters in this sample. The dashboard shows where inkOUT leads and where it does not. It does not editorialize. The data is presented neutrally and the user draws their own conclusions from the numbers.

**Does it highlight high-value, trustworthy evidence persuasively?**
The strongest evidence in the dataset is the negative reviews of competitors and the specific scarring complaints against other TEPR providers (Tatt2Away Draper in particular). These are surfaced in the competitor deep-dive pages for those locations. For persuasive use, someone would need to manually curate the most impactful reviews and present them separately rather than relying on the dashboard alone.

**Should the dashboard be adjusted to be more balanced and defensible?**
The sampling limitation is the main defensibility risk. The fix is to use SerpAPI verified dates and ideally pull the full review history rather than 50 per location. Until then, the disclosure banner and data_disclosure.json make the current dataset defensible by being transparent about its limitations rather than hiding them.

---

## Data Attribution and Trust

**Are reviews correctly attributed to brands and locations?**
Yes. Each review carries provider_name, location_city, location_state, and brand_name. The 79 transition-era reviews are attributed to inkOUT (the current operator of those listings) with a flag noting the Tatt2Away history. No reviews are misattributed to the wrong city or brand.

**Are reviews verified as authentic, and is that visible?**
All reviews carry verified_source: "Google" indicating they were pulled from public Google Maps listings. Google performs its own spam filtering but we have no independent verification of reviewer identity. The dataset does not claim individual reviews are authenticated beyond their public presence on Google. This is stated in data_disclosure.json.

**Does the dashboard provide enough context to interpret ratings correctly?**
Yes, as of the current build. The disclosure banner on every page explains: scrape date, sampling method, date estimation, transition-era reviews, and rating-only reviews. A reader who reads the banner before interpreting the data has all the context they need. A reader who skips it may misread the 4.9 average as a complete historical record rather than a 50-review recent sample.

---

## Summary of Critical Disclosures for Legal or Audit Use

1. Dates are estimated from relative timestamps anchored to April 2, 2026. Only one date (Emma Kondris, inkOUT Draper, January 12, 2026) is verified by screenshot.
2. The dataset is a sample of up to 50 recent reviews per location, not the complete review history.
3. The star distribution (94.2% five-star) is a result of recency-biased sampling, not a reflection of the full rating history.
4. 79 inkOUT reviews were left on Google listings that previously operated as Tatt2Away. These reviewers may have been Tatt2Away customers.
5. 110 reviews contain no written text, only a star rating.
6. Removery has 150 reviews across 3 locations. inkOUT has 149 reviews across 5 locations. Brand-level totals should not be compared directly.
