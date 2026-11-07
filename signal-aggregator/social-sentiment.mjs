/**
 * Social Sentiment Analyzer
 * Tracks Twitter/X, Reddit, and Bluesky for prediction market sentiment
 */

import { generateSignalId } from './index.mjs';

/**
 * Fetch social sentiment signals
 */
export async function fetchSocialSentiment(env) {
  const signals = [];
  
  try {
    // Parallel sentiment fetching from multiple platforms
    const [twitterSignals, redditSignals, blueskySignals] = await Promise.allSettled([
      fetchTwitterSentiment(env),
      fetchRedditSentiment(env),
      fetchBlueskySigntiment(env)
    ]);

    if (twitterSignals.status === 'fulfilled') {
      signals.push(...twitterSignals.value);
    }
    if (redditSignals.status === 'fulfilled') {
      signals.push(...redditSignals.value);
    }
    if (blueskySignals.status === 'fulfilled') {
      signals.push(...blueskySignals.value);
    }

    console.log(`[Social Sentiment] Generated ${signals.length} signals`);
    return signals;

  } catch (error) {
    console.error('[Social Sentiment] Error:', error);
    return signals;
  }
}

/**
 * Fetch Twitter/X sentiment
 */
async function fetchTwitterSentiment(env) {
  const signals = [];
  const now = new Date().toISOString();

  try {
    const bearerToken = env.TWITTER_BEARER_TOKEN;
    if (!bearerToken) {
      console.warn('[Social] No Twitter bearer token');
      return signals;
    }

    // Search for prediction market related tweets
    const keywords = ['polymarket', 'kalshi', 'prediction market', 'betting odds'];
    
    for (const keyword of keywords) {
      const response = await fetch(
        `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(keyword)}&max_results=20&tweet.fields=public_metrics,created_at`,
        {
          headers: { 'Authorization': `Bearer ${bearerToken}` },
          cf: { cacheTtl: 300 }
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const tweets = data.data || [];

      // Analyze tweet engagement
      for (const tweet of tweets) {
        const metrics = tweet.public_metrics || {};
        const engagement = metrics.like_count + metrics.retweet_count + metrics.reply_count;
        
        if (engagement > 100) { // Viral threshold
          const sentiment = analyzeSentiment(tweet.text);
          
          signals.push({
            id: generateSignalId('twitter', 'viral_post', tweet.id),
            source: 'twitter',
            signal_type: 'viral_post',
            market_slug: extractMarketSlug(tweet.text),
            market_title: null,
            signal_strength: Math.min(engagement / 1000, 1.0),
            metadata: {
              platform: 'twitter',
              engagement,
              sentiment_score: sentiment,
              tweet_id: tweet.id,
              text: tweet.text.substring(0, 200)
            },
            price_data: null,
            detected_at: now
          });
        }
      }
    }

  } catch (error) {
    console.error('[Social] Twitter error:', error);
  }

  return signals;
}

/**
 * Fetch Reddit sentiment
 */
async function fetchRedditSentiment(env) {
  const signals = [];
  // Implementation similar to Twitter
  // Would use Reddit API to track r/polymarket, r/crypto, etc.
  return signals;
}

/**
 * Fetch Bluesky sentiment
 */
async function fetchBlueskySentiment(env) {
  const signals = [];
  // Implementation for Bluesky API
  return signals;
}

/**
 * Simple sentiment analysis (-1 to 1)
 */
function analyzeSentiment(text) {
  const positive = ['bullish', 'confident', 'winning', 'likely', 'certain'];
  const negative = ['bearish', 'uncertain', 'losing', 'unlikely', 'doubtful'];
  
  const lowerText = text.toLowerCase();
  let score = 0;
  
  positive.forEach(word => {
    if (lowerText.includes(word)) score += 0.2;
  });
  
  negative.forEach(word => {
    if (lowerText.includes(word)) score -= 0.2;
  });
  
  return Math.max(Math.min(score, 1.0), -1.0);
}

/**
 * Extract market slug from text
 */
function extractMarketSlug(text) {
  // Simple extraction - would be more sophisticated in production
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  return words.slice(0, 3).join('-');
}
