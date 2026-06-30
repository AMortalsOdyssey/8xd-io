export type TrafficIdentityCategory =
  | "ai_training_crawler"
  | "ai_search_crawler"
  | "ai_assistant_fetch"
  | "ai_referral"
  | "search_engine_bot"
  | "search_referral"
  | "social_preview"
  | "seo_tool"
  | "monitoring"
  | "browser"
  | "unknown_bot"
  | "unknown";

export interface TrafficIdentity {
  vendor: string;
  product: string;
  label: string;
  category: TrafficIdentityCategory;
  bucket: "GEO" | "SEO" | "Social" | "Monitoring" | "Human" | "Other";
  isAi: boolean;
  isBot: boolean;
  confidence: "high" | "medium" | "low";
  detail: string;
}

interface IdentityRule {
  pattern: RegExp;
  identity: TrafficIdentity;
}

const USER_AGENT_RULES: IdentityRule[] = [
  rule(/OAI-SearchBot/i, "OpenAI", "OAI-SearchBot", "OpenAI / ChatGPT Search", "ai_search_crawler", "GEO", true, true, "high", "OpenAI search crawler user agent."),
  rule(/ChatGPT-User/i, "OpenAI", "ChatGPT-User", "OpenAI / ChatGPT User", "ai_assistant_fetch", "GEO", true, true, "high", "User-triggered ChatGPT browsing/fetch request."),
  rule(/GPTBot/i, "OpenAI", "GPTBot", "OpenAI / GPTBot", "ai_training_crawler", "GEO", true, true, "high", "OpenAI crawler used for AI indexing/training style access."),
  rule(/Claude-SearchBot/i, "Anthropic", "Claude-SearchBot", "Anthropic / Claude Search", "ai_search_crawler", "GEO", true, true, "high", "Claude search crawler user agent."),
  rule(/Claude-User/i, "Anthropic", "Claude-User", "Anthropic / Claude User", "ai_assistant_fetch", "GEO", true, true, "high", "User-triggered Claude fetch request."),
  rule(/ClaudeBot/i, "Anthropic", "ClaudeBot", "Anthropic / ClaudeBot", "ai_training_crawler", "GEO", true, true, "high", "Anthropic crawler user agent."),
  rule(/PerplexityBot/i, "Perplexity", "PerplexityBot", "Perplexity / PerplexityBot", "ai_search_crawler", "GEO", true, true, "high", "Perplexity crawler user agent."),
  rule(/Perplexity-User/i, "Perplexity", "Perplexity-User", "Perplexity / User", "ai_assistant_fetch", "GEO", true, true, "high", "User-triggered Perplexity fetch request."),
  rule(/Bytespider/i, "ByteDance", "Bytespider", "ByteDance / Bytespider", "ai_training_crawler", "GEO", true, true, "medium", "ByteDance crawler; Dashboard labels this as ByteDance/Doubao ecosystem, not a guaranteed Doubao model inference."),
  rule(/Applebot-Extended|Applebot/i, "Apple", "Applebot", "Apple / Applebot", "ai_training_crawler", "GEO", true, true, "medium", "Apple crawler; may be search or AI data access depending on token."),
  rule(/Googlebot|GoogleOther|AdsBot-Google/i, "Google", "Googlebot", "Google / Search Bot", "search_engine_bot", "SEO", false, true, "high", "Google search crawler."),
  rule(/bingbot|BingPreview/i, "Microsoft", "Bingbot", "Microsoft / Bing Bot", "search_engine_bot", "SEO", false, true, "high", "Bing search crawler."),
  rule(/Baiduspider/i, "Baidu", "Baiduspider", "Baidu / Baiduspider", "search_engine_bot", "SEO", false, true, "high", "Baidu search crawler."),
  rule(/Sogou web spider|SogouSpider/i, "Sogou", "SogouSpider", "Sogou / Search Bot", "search_engine_bot", "SEO", false, true, "high", "Sogou search crawler."),
  rule(/facebookexternalhit|Twitterbot|Slackbot|TelegramBot|WhatsApp/i, "Social Preview", "Social Preview", "Social / Preview Bot", "social_preview", "Social", false, true, "high", "Social card preview crawler."),
  rule(/AhrefsBot|SemrushBot|MJ12bot|DotBot|PetalBot/i, "SEO Tool", "SEO Tool Bot", "SEO Tool / Crawler", "seo_tool", "SEO", false, true, "high", "SEO tool crawler."),
  rule(/Pingdom|UptimeRobot|Better Uptime|StatusCake|Datadog|curl|Wget/i, "Monitoring", "Monitoring Agent", "Monitoring / Script", "monitoring", "Monitoring", false, true, "medium", "Monitoring, uptime, CLI, or scripted request."),
];

const REFERRER_RULES: IdentityRule[] = [
  rule(/chatgpt\.com|chat\.openai\.com/i, "OpenAI", "ChatGPT", "OpenAI / ChatGPT Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by ChatGPT."),
  rule(/claude\.ai/i, "Anthropic", "Claude", "Anthropic / Claude Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Claude."),
  rule(/perplexity\.ai/i, "Perplexity", "Perplexity", "Perplexity / Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Perplexity."),
  rule(/gemini\.google\.com|bard\.google\.com/i, "Google", "Gemini", "Google / Gemini Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Gemini."),
  rule(/doubao\.com|coze\.cn|coze\.com|bytedance/i, "ByteDance", "Doubao/Coze", "ByteDance / Doubao Referral", "ai_referral", "GEO", true, false, "medium", "Referral from ByteDance AI product surface."),
  rule(/kimi\.moonshot\.cn/i, "Moonshot", "Kimi", "Moonshot / Kimi Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Kimi."),
  rule(/yuanbao\.tencent\.com/i, "Tencent", "Yuanbao", "Tencent / Yuanbao Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Tencent Yuanbao."),
  rule(/google\.[^/]+|bing\.com|baidu\.com|sogou\.com|so\.com|duckduckgo\.com/i, "Search", "Search Referral", "Search Engine / Referral", "search_referral", "SEO", false, false, "high", "Human click referred by a search engine."),
];

export function classifyTrafficIdentity(input: {
  userAgent?: string | null;
  referrer?: string | null;
  cloudflareCategory?: string | null;
}): TrafficIdentity {
  const userAgent = String(input.userAgent || "");
  const referrer = String(input.referrer || "");
  const cloudflareCategory = String(input.cloudflareCategory || "");

  const cloudflareIdentity = classifyCloudflareCategory(cloudflareCategory);
  if (cloudflareIdentity) return cloudflareIdentity;

  for (const item of USER_AGENT_RULES) {
    if (item.pattern.test(userAgent)) return item.identity;
  }

  for (const item of REFERRER_RULES) {
    if (item.pattern.test(referrer)) return item.identity;
  }

  if (/bot|crawler|spider|preview|fetch|agent/i.test(userAgent)) {
    return {
      vendor: "Unknown",
      product: "Unknown Bot",
      label: "Unknown / Bot or Agent",
      category: "unknown_bot",
      bucket: "Other",
      isAi: false,
      isBot: true,
      confidence: "low",
      detail: "Bot-like user agent without a known AI/search/social signature.",
    };
  }

  if (userAgent) {
    return {
      vendor: "Browser",
      product: "Browser",
      label: "Browser / Human-like",
      category: "browser",
      bucket: "Human",
      isAi: false,
      isBot: false,
      confidence: "medium",
      detail: "Browser-like request; may still include automation if User-Agent is spoofed.",
    };
  }

  return {
    vendor: "Unknown",
    product: "Unknown",
    label: "Unknown / No User-Agent",
    category: "unknown",
    bucket: "Other",
    isAi: false,
    isBot: false,
    confidence: "low",
    detail: "Missing User-Agent and no known referral signal.",
  };
}

export function trafficBucketLabel(identity: TrafficIdentity): string {
  if (identity.category === "ai_training_crawler") return "GEO / AI Crawler";
  if (identity.category === "ai_search_crawler") return "GEO / AI Search";
  if (identity.category === "ai_assistant_fetch") return "GEO / AI Assistant";
  if (identity.category === "ai_referral") return "GEO / AI Referral";
  if (identity.category === "search_engine_bot") return "SEO / Search Bot";
  if (identity.category === "search_referral") return "SEO / Search Referral";
  if (identity.category === "social_preview") return "Social / Preview";
  if (identity.category === "seo_tool") return "SEO / Tool";
  if (identity.category === "monitoring") return "Monitoring / Script";
  if (identity.category === "browser") return "Human / Browser";
  return "Other / Unknown";
}

export function confidenceLabel(identity: TrafficIdentity): string {
  if (identity.confidence === "high") return "高置信";
  if (identity.confidence === "medium") return "中置信";
  return "低置信";
}

function classifyCloudflareCategory(value: string): TrafficIdentity | undefined {
  if (/AI Assistant/i.test(value)) {
    return {
      vendor: "Cloudflare",
      product: "AI Assistant",
      label: "Cloudflare / AI Assistant",
      category: "ai_assistant_fetch",
      bucket: "GEO",
      isAi: true,
      isBot: true,
      confidence: "high",
      detail: "Classified by Cloudflare AI Crawl Control category.",
    };
  }
  if (/AI Search/i.test(value)) {
    return {
      vendor: "Cloudflare",
      product: "AI Search",
      label: "Cloudflare / AI Search",
      category: "ai_search_crawler",
      bucket: "GEO",
      isAi: true,
      isBot: true,
      confidence: "high",
      detail: "Classified by Cloudflare AI Crawl Control category.",
    };
  }
  if (/AI Crawler/i.test(value)) {
    return {
      vendor: "Cloudflare",
      product: "AI Crawler",
      label: "Cloudflare / AI Crawler",
      category: "ai_training_crawler",
      bucket: "GEO",
      isAi: true,
      isBot: true,
      confidence: "high",
      detail: "Classified by Cloudflare AI Crawl Control category.",
    };
  }
  if (/Search Engine/i.test(value)) {
    return {
      vendor: "Cloudflare",
      product: "Search Engine",
      label: "Cloudflare / Search Engine",
      category: "search_engine_bot",
      bucket: "SEO",
      isAi: false,
      isBot: true,
      confidence: "high",
      detail: "Classified by Cloudflare AI Crawl Control category.",
    };
  }
  return undefined;
}

function rule(
  pattern: RegExp,
  vendor: string,
  product: string,
  label: string,
  category: TrafficIdentityCategory,
  bucket: TrafficIdentity["bucket"],
  isAi: boolean,
  isBot: boolean,
  confidence: TrafficIdentity["confidence"],
  detail: string,
): IdentityRule {
  return {
    pattern,
    identity: { vendor, product, label, category, bucket, isAi, isBot, confidence, detail },
  };
}
