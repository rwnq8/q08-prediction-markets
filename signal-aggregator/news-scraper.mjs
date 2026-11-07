/**
 * News Event Scraper
 * Tracks breaking news that could impact prediction markets
 * Sources: GDELT, NewsAPI, RSS feeds
 */

import { generateSignalId } from './index.mjs';

/**
 * Fetch news event signals
 */
export async function fetchNewsSignals(env) {
  const signals = [];
  
  try {
    // Parallel news fetching from multiple sources
    const [gdeltSignals, newsApiSignals] = await Promise.allSettled([
      fetchGDELTEvents(env),
      fetchNewsAPIEvents(env)
    ]);

    if (gdeltSignals.status === 'fulfilled') {
      signals.push(...gdeltSignals.value);
    }
    if (newsApiSignals.status === 'fulfilled') {
      signals.push(...newsApiSignals.value);
    }

    console.log(`[News Scraper] Generated ${signals.length} signals`);
    return signals;

  } catch (error) {
    console.error('[News Scraper] Error:', error);
    return signals;
  }
}

/**
 * Fetch GDELT real-time events
 * GDELT monitors news worldwide in 100+ languages
 */
async function fetchGDELTEvents(env) {
  const signals = [];
  const now = new Date().toISOString();

  try {
    // GDELT 2.0 Doc API - last 15 minutes of news
    const themes = [
      'ECON_INFLATION',
      'POLITICS_ELECTION',
      'TAX_FNCACT',
      'SPORTS',
      'WEATHER_DISASTER',
      'HEALTH_PANDEMIC'
    ];

    for (const theme of themes) {
      const response = await fetch(
        `https://api.gdeltproject.org/api/v2/doc/doc?query=theme:${theme}&mode=artlist&maxrecords=10&format=json&timespan=15m`,
        { cf: { cacheTtl: 300 } }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const articles = data.articles || [];

      for (const article of articles) {
        // High-tone (positive) or low-tone (negative) news creates mispricing
        const tone = parseFloat(article.tone) || 0;
        const strength = Math.abs(tone) / 10; // Normalize -10 to +10 scale

        if (strength > 0.5) { // Significant tone
          signals.push({
            id: generateSignalId('gdelt', 'breaking_news', article.url),
            source: 'gdelt',
            signal_type: 'breaking_news',
            market_slug: extractMarketFromTitle(article.title),
            market_title: article.title.substring(0, 200),
            signal_strength: Math.min(strength, 1.0),
            metadata: {
              platform: 'gdelt',
              theme,
              tone,
              url: article.url,
              domain: article.domain,
              language: article.language,
              seendate: article.seendate
            },
            price_data: null,
            detected_at: now
          });
        }
      }
    }

  } catch (error) {
    console.error('[News] GDELT error:', error);
  }

  return signals;
}

/**
 * Fetch NewsAPI events
 */
async function fetchNewsAPIEvents(env) {
  const signals = [];
  const now = new Date().toISOString();

  try {
    const apiKey = env.NEWS_API_KEY;
    if (!apiKey) {
      console.warn('[News] No NewsAPI key');
      return signals;
    }

    // Keywords that often appear in prediction markets
    const queries = [
      'election polls',
      'inflation rate',
      'federal reserve',
      'unemployment',
      'bitcoin price',
      'supreme court',
      'climate change',
      'sports championship'
    ];

    for (const query of queries) {
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`,
        { cf: { cacheTtl: 300 } }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const articles = data.articles || [];

      for (const article of articles) {
        // Check if article is fresh (< 1 hour old)
        const publishedAt = new Date(article.publishedAt);
        const ageMinutes = (Date.now() - publishedAt.getTime()) / 1000 / 60;

        if (ageMinutes < 60) {
          const sentiment = analyzeSentiment(article.title + ' ' + article.description);
          
          signals.push({
            id: generateSignalId('newsapi', 'breaking_news', article.url),
            source: 'newsapi',
            signal_type: 'breaking_news',
            market_slug: extractMarketFromTitle(article.title),
            market_title: article.title,
            signal_strength: Math.max(0.3, 1.0 - (ageMinutes / 60)), // Fresher = stronger
            metadata: {
              platform: 'newsapi',
              query,
              sentiment,
              url: article.url,
              source: article.source?.name,
              author: article.author,
              publishedAt: article.publishedAt,
              description: article.description?.substring(0, 200)
            },
            price_data: null,
            detected_at: now
          });
        }
      }
    }

  } catch (error) {
    console.error('[News] NewsAPI error:', error);
  }

  return signals;
}

/**
 * Extract potential market slug from news title
 */
function extractMarketFromTitle(title) {
  const lowerTitle = title.toLowerCase();
  
  // Common prediction market topics
  const patterns = [
    /election|poll|vote|candidate/,
    /inflation|cpi|interest rate|fed|federal reserve/,
    /bitcoin|crypto|ethereum/,
    /unemployment|jobs report/,
    /supreme court/,
    /climate|temperature|emissions/,
    /championship|playoff|super bowl|world series/
  ];

  for (const pattern of patterns) {
    if (pattern.test(lowerTitle)) {
      return lowerTitle.match(/\b\w+\b/g)?.slice(0, 4).join('-') || 'unknown';
    }
  }

  return lowerTitle.match(/\b\w+\b/g)?.slice(0, 3).join('-') || 'unknown';
}

/**
 * Simple sentiment analysis
 */
function analyzeSentiment(text) {
  const positive = ['surge', 'boom', 'record', 'win', 'success', 'growth', 'rise', 'gain'];
  const negative = ['crash', 'fall', 'decline', 'loss', 'fail', 'drop', 'plunge', 'crisis'];
  
  const lowerText = text.toLowerCase();
  let score = 0;
  
  positive.forEach(word => {
    const count = (lowerText.match(new RegExp(word, 'g')) || []).length;
    score += count * 0.2;
  });
  
  negative.forEach(word => {
    const count = (lowerText.match(new RegExp(word, 'g')) || []).length;
    score -= count * 0.2;
  });
  
  return Math.max(Math.min(score, 1.0), -1.0);
}
