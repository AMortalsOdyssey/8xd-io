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
  | "automation"
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

/**
 * User-Agent 规则。顺序敏感：更具体的签名必须排在通配签名之前
 * （如 Applebot-Extended 在 Applebot 之前、GoogleOther 在 Googlebot 之前）。
 * 置信度标准：
 * - high：厂商公开文档记录的专用 UA，基本不会误判
 * - medium：能确认归属生态，但用途（训练/搜索/推理）无法从 UA 区分
 * - low：仅凭形态特征（含 bot/spider 字样）推断
 */
const USER_AGENT_RULES: IdentityRule[] = [
  // --- OpenAI ---
  rule(/OAI-SearchBot/i, "OpenAI", "OAI-SearchBot", "OpenAI / ChatGPT Search", "ai_search_crawler", "GEO", true, true, "high", "OpenAI search crawler user agent."),
  rule(/ChatGPT-User/i, "OpenAI", "ChatGPT-User", "OpenAI / ChatGPT User", "ai_assistant_fetch", "GEO", true, true, "high", "User-triggered ChatGPT browsing/fetch request."),
  rule(/GPTBot/i, "OpenAI", "GPTBot", "OpenAI / GPTBot", "ai_training_crawler", "GEO", true, true, "high", "OpenAI crawler used for AI indexing/training style access."),
  // --- Anthropic ---
  rule(/Claude-SearchBot/i, "Anthropic", "Claude-SearchBot", "Anthropic / Claude Search", "ai_search_crawler", "GEO", true, true, "high", "Claude search crawler user agent."),
  rule(/Claude-User/i, "Anthropic", "Claude-User", "Anthropic / Claude User", "ai_assistant_fetch", "GEO", true, true, "high", "User-triggered Claude fetch request."),
  rule(/ClaudeBot|anthropic-ai/i, "Anthropic", "ClaudeBot", "Anthropic / ClaudeBot", "ai_training_crawler", "GEO", true, true, "high", "Anthropic crawler user agent."),
  // --- Perplexity ---
  rule(/PerplexityBot/i, "Perplexity", "PerplexityBot", "Perplexity / PerplexityBot", "ai_search_crawler", "GEO", true, true, "high", "Perplexity crawler user agent."),
  rule(/Perplexity-User/i, "Perplexity", "Perplexity-User", "Perplexity / User", "ai_assistant_fetch", "GEO", true, true, "high", "User-triggered Perplexity fetch request."),
  // --- Google（AI 用途优先于搜索通配）---
  rule(/Google-CloudVertexBot/i, "Google", "Vertex AI", "Google / Vertex AI", "ai_assistant_fetch", "GEO", true, true, "high", "Vertex AI site grounding fetcher."),
  rule(/Google-Extended/i, "Google", "Google-Extended", "Google / Google-Extended", "ai_training_crawler", "GEO", true, true, "high", "Google AI (Gemini) training-related crawl token."),
  rule(/GoogleOther/i, "Google", "GoogleOther", "Google / GoogleOther", "ai_training_crawler", "GEO", true, true, "medium", "Google non-search crawler, includes AI R&D data access; exact use is not disclosed per request."),
  rule(/Googlebot|AdsBot-Google|APIs-Google|Storebot-Google/i, "Google", "Googlebot", "Google / Search Bot", "search_engine_bot", "SEO", false, true, "high", "Google search crawler."),
  // --- Meta ---
  rule(/meta-externalagent/i, "Meta", "Meta-ExternalAgent", "Meta / ExternalAgent", "ai_training_crawler", "GEO", true, true, "high", "Meta AI training crawler."),
  rule(/meta-externalfetcher/i, "Meta", "Meta-ExternalFetcher", "Meta / ExternalFetcher", "ai_assistant_fetch", "GEO", true, true, "high", "Meta AI user-triggered link fetch."),
  rule(/FacebookBot/i, "Meta", "FacebookBot", "Meta / FacebookBot", "ai_training_crawler", "GEO", true, true, "medium", "Meta crawler historically used for speech/AI model improvement."),
  // --- ByteDance / 豆包生态 ---
  rule(/Bytespider/i, "ByteDance", "Bytespider", "ByteDance / Bytespider", "ai_training_crawler", "GEO", true, true, "medium", "ByteDance crawler; Dashboard labels this as ByteDance/Doubao ecosystem, not a guaranteed Doubao model inference."),
  // --- Apple（Extended 才是 AI 训练；普通 Applebot 是 Siri/Spotlight 搜索）---
  rule(/Applebot-Extended/i, "Apple", "Applebot-Extended", "Apple / Applebot-Extended", "ai_training_crawler", "GEO", true, true, "high", "Apple Intelligence training crawl token."),
  rule(/Applebot/i, "Apple", "Applebot", "Apple / Applebot", "search_engine_bot", "SEO", false, true, "high", "Apple Siri/Spotlight search crawler."),
  // --- 其它 AI 厂商 ---
  rule(/Amazonbot/i, "Amazon", "Amazonbot", "Amazon / Amazonbot", "ai_training_crawler", "GEO", true, true, "medium", "Amazon crawler feeding Alexa and related AI answers."),
  rule(/CCBot/i, "Common Crawl", "CCBot", "Common Crawl / CCBot", "ai_training_crawler", "GEO", true, true, "high", "Common Crawl corpus crawler, widely used as AI training data."),
  rule(/cohere-ai|cohere-training-data-crawler/i, "Cohere", "Cohere Crawler", "Cohere / Crawler", "ai_training_crawler", "GEO", true, true, "high", "Cohere training data crawler."),
  rule(/MistralAI-User/i, "Mistral", "MistralAI-User", "Mistral / Le Chat User", "ai_assistant_fetch", "GEO", true, true, "high", "User-triggered Mistral Le Chat fetch."),
  rule(/DuckAssistBot/i, "DuckDuckGo", "DuckAssistBot", "DuckDuckGo / DuckAssist", "ai_search_crawler", "GEO", true, true, "high", "DuckDuckGo AI answers crawler."),
  rule(/YouBot/i, "You.com", "YouBot", "You.com / YouBot", "ai_search_crawler", "GEO", true, true, "medium", "You.com AI search crawler."),
  rule(/Diffbot/i, "Diffbot", "Diffbot", "Diffbot / Extractor", "ai_training_crawler", "GEO", true, true, "medium", "Structured extraction service used in AI data pipelines."),
  // --- 传统搜索引擎 ---
  rule(/bingbot|BingPreview/i, "Microsoft", "Bingbot", "Microsoft / Bing Bot", "search_engine_bot", "SEO", false, true, "high", "Bing search crawler."),
  rule(/Baiduspider/i, "Baidu", "Baiduspider", "Baidu / Baiduspider", "search_engine_bot", "SEO", false, true, "high", "Baidu search crawler."),
  rule(/Sogou web spider|SogouSpider/i, "Sogou", "SogouSpider", "Sogou / Search Bot", "search_engine_bot", "SEO", false, true, "high", "Sogou search crawler."),
  rule(/360Spider|HaoSouSpider/i, "Qihoo 360", "360Spider", "360 / Search Bot", "search_engine_bot", "SEO", false, true, "high", "Qihoo 360 search crawler."),
  rule(/YisouSpider/i, "Shenma", "YisouSpider", "神马(夸克) / Search Bot", "search_engine_bot", "SEO", false, true, "high", "Alibaba Shenma/Quark search crawler."),
  rule(/PetalBot/i, "Huawei", "PetalBot", "Huawei / Petal Bot", "search_engine_bot", "SEO", false, true, "high", "Huawei Petal search crawler."),
  rule(/YandexBot/i, "Yandex", "YandexBot", "Yandex / Search Bot", "search_engine_bot", "SEO", false, true, "high", "Yandex search crawler."),
  // --- 社交预览 ---
  rule(/facebookexternalhit|Twitterbot|Slackbot|TelegramBot|WhatsApp|LinkedInBot|Discordbot/i, "Social Preview", "Social Preview", "Social / Preview Bot", "social_preview", "Social", false, true, "high", "Social card preview crawler."),
  // --- SEO 工具 ---
  rule(/AhrefsBot|SemrushBot|MJ12bot|DotBot|Screaming Frog/i, "SEO Tool", "SEO Tool Bot", "SEO Tool / Crawler", "seo_tool", "SEO", false, true, "high", "SEO tool crawler."),
  // --- 监控服务 ---
  rule(/Pingdom|UptimeRobot|Better Uptime|StatusCake|Datadog|Site24x7|Checkly/i, "Monitoring", "Monitoring Agent", "Monitoring / Uptime", "monitoring", "Monitoring", false, true, "high", "Uptime or observability vendor probe."),
  // --- 脚本 / HTTP 客户端 ---
  rule(/curl\/|Wget\/|python-requests|python-httpx|aiohttp|Scrapy|Go-http-client|okhttp|node-fetch|axios\/|libwww|Java\/\d/i, "Script", "HTTP Client", "Script / HTTP Client", "automation", "Monitoring", false, true, "high", "CLI or programmatic HTTP client signature."),
  // --- 无头浏览器 / 自动化 ---
  rule(/HeadlessChrome|PhantomJS|Playwright|Puppeteer|Selenium/i, "Automation", "Headless Browser", "Automation / Headless Browser", "automation", "Monitoring", false, true, "medium", "Headless or automated browser signature; may be testing, scraping, or an agent runtime."),
];

/**
 * Referrer 规则：识别"从 AI 产品/搜索结果点过来的真人流量"。
 * 顺序敏感：AI 产品域名在通用搜索域名之前（如 copilot.microsoft.com 先于 bing.com）。
 */
const REFERRER_RULES: IdentityRule[] = [
  rule(/chatgpt\.com|chat\.openai\.com/i, "OpenAI", "ChatGPT", "OpenAI / ChatGPT Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by ChatGPT."),
  rule(/claude\.ai/i, "Anthropic", "Claude", "Anthropic / Claude Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Claude."),
  rule(/perplexity\.ai/i, "Perplexity", "Perplexity", "Perplexity / Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Perplexity."),
  rule(/gemini\.google\.com|bard\.google\.com/i, "Google", "Gemini", "Google / Gemini Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Gemini."),
  rule(/copilot\.microsoft\.com|bing\.com\/chat/i, "Microsoft", "Copilot", "Microsoft / Copilot Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Microsoft Copilot."),
  rule(/doubao\.com|coze\.cn|coze\.com|bytedance/i, "ByteDance", "Doubao/Coze", "ByteDance / Doubao Referral", "ai_referral", "GEO", true, false, "high", "Referral from ByteDance Doubao/Coze product surface."),
  rule(/kimi\.moonshot\.cn|kimi\.com/i, "Moonshot", "Kimi", "Moonshot / Kimi Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Kimi."),
  rule(/yuanbao\.tencent\.com/i, "Tencent", "Yuanbao", "Tencent / Yuanbao Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Tencent Yuanbao."),
  rule(/deepseek\.com/i, "DeepSeek", "DeepSeek", "DeepSeek / Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by DeepSeek."),
  rule(/tongyi\.aliyun\.com|qianwen\.aliyun\.com|tongyi\.com/i, "Alibaba", "Tongyi", "Alibaba / 通义 Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Tongyi Qianwen."),
  rule(/yiyan\.baidu\.com|ernie\.baidu\.com/i, "Baidu", "ERNIE", "Baidu / 文心 Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by ERNIE Bot."),
  rule(/chatglm\.cn|zhipuai\.cn|bigmodel\.cn/i, "Zhipu", "ChatGLM", "Zhipu / 智谱 Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Zhipu ChatGLM."),
  rule(/xinghuo\.xfyun\.cn/i, "iFlytek", "Spark", "iFlytek / 星火 Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by iFlytek Spark."),
  rule(/metaso\.cn/i, "Metaso", "Metaso", "Metaso / 秘塔 Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Metaso AI search."),
  rule(/felo\.ai/i, "Felo", "Felo", "Felo / Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Felo AI search."),
  rule(/you\.com/i, "You.com", "You.com", "You.com / Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by You.com."),
  rule(/poe\.com/i, "Poe", "Poe", "Poe / Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Poe."),
  rule(/chat\.mistral\.ai|mistral\.ai/i, "Mistral", "Le Chat", "Mistral / Le Chat Referral", "ai_referral", "GEO", true, false, "high", "Human click or browser session referred by Mistral Le Chat."),
  rule(
    /google\.[^/]+|bing\.com|baidu\.com|sogou\.com|so\.com|duckduckgo\.com|yandex\.|naver\.com|ecosia\.org|search\.brave\.com|sm\.cn/i,
    "Search",
    "Search Referral",
    "Search Engine / Referral",
    "search_referral",
    "SEO",
    false,
    false,
    "high",
    "Human click referred by a search engine.",
  ),
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
  if (identity.category === "monitoring") return "Monitoring / Uptime";
  if (identity.category === "automation") return "Monitoring / Script";
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
