import { describe, expect, it } from "vitest";
import {
  classifyTrafficIdentity,
  confidenceLabel,
  trafficBucketLabel,
} from "../src/shared/ai-attribution";

describe("AI and agent traffic attribution", () => {
  it("classifies known AI crawler and assistant user agents", () => {
    const cases = [
      {
        ua: "Mozilla/5.0 AppleWebKit/537.36; compatible; GPTBot/1.2; +https://openai.com/gptbot",
        label: "OpenAI / GPTBot",
        bucket: "GEO / AI Crawler",
      },
      {
        ua: "ChatGPT-User/1.0; +https://openai.com/bot",
        label: "OpenAI / ChatGPT User",
        bucket: "GEO / AI Assistant",
      },
      {
        ua: "OAI-SearchBot/1.0; +https://openai.com/searchbot",
        label: "OpenAI / ChatGPT Search",
        bucket: "GEO / AI Search",
      },
      {
        ua: "ClaudeBot/1.0; +claudebot@anthropic.com",
        label: "Anthropic / ClaudeBot",
        bucket: "GEO / AI Crawler",
      },
      {
        ua: "PerplexityBot/1.0; +https://perplexity.ai/perplexitybot",
        label: "Perplexity / PerplexityBot",
        bucket: "GEO / AI Search",
      },
    ];

    for (const item of cases) {
      const identity = classifyTrafficIdentity({ userAgent: item.ua });
      expect(identity.label).toBe(item.label);
      expect(identity.isAi).toBe(true);
      expect(identity.confidence).toBe("high");
      expect(trafficBucketLabel(identity)).toBe(item.bucket);
      expect(confidenceLabel(identity)).toBe("高置信");
    }
  });

  it("labels Bytespider as ByteDance ecosystem without overclaiming Doubao inference", () => {
    const identity = classifyTrafficIdentity({
      userAgent: "Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)",
    });

    expect(identity.label).toBe("ByteDance / Bytespider");
    expect(identity.isAi).toBe(true);
    expect(identity.confidence).toBe("medium");
    expect(identity.detail).toContain("not a guaranteed Doubao model inference");
  });

  it("keeps classic SEO crawlers separate from GEO traffic", () => {
    const identity = classifyTrafficIdentity({
      userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    });

    expect(identity.label).toBe("Google / Search Bot");
    expect(identity.isAi).toBe(false);
    expect(identity.isBot).toBe(true);
    expect(trafficBucketLabel(identity)).toBe("SEO / Search Bot");
  });

  it("classifies AI and search referrals from browser pageview data", () => {
    const chatgpt = classifyTrafficIdentity({ referrer: "https://chatgpt.com/c/123" });
    const google = classifyTrafficIdentity({ referrer: "https://www.google.com/search?q=fangliying" });

    expect(chatgpt.label).toBe("OpenAI / ChatGPT Referral");
    expect(chatgpt.isAi).toBe(true);
    expect(trafficBucketLabel(chatgpt)).toBe("GEO / AI Referral");
    expect(google.label).toBe("Search Engine / Referral");
    expect(trafficBucketLabel(google)).toBe("SEO / Search Referral");
  });

  it("marks unknown bot-like agents as low confidence instead of treating them as human", () => {
    const identity = classifyTrafficIdentity({ userAgent: "MysteryAgentBot/0.1" });

    expect(identity.label).toBe("Unknown / Bot or Agent");
    expect(identity.isBot).toBe(true);
    expect(identity.confidence).toBe("low");
    expect(trafficBucketLabel(identity)).toBe("Other / Unknown");
  });

  it("classifies newer AI vendor crawlers and fetchers", () => {
    const cases = [
      { ua: "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)", label: "Meta / ExternalAgent", bucket: "GEO / AI Crawler" },
      { ua: "meta-externalfetcher/1.1", label: "Meta / ExternalFetcher", bucket: "GEO / AI Assistant" },
      { ua: "Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)", label: "Amazon / Amazonbot", bucket: "GEO / AI Crawler" },
      { ua: "CCBot/2.0 (https://commoncrawl.org/faq/)", label: "Common Crawl / CCBot", bucket: "GEO / AI Crawler" },
      { ua: "Mozilla/5.0 (compatible; DuckAssistBot/1.0; +http://duckduckgo.com/duckassistbot.html)", label: "DuckDuckGo / DuckAssist", bucket: "GEO / AI Search" },
      { ua: "MistralAI-User/1.0", label: "Mistral / Le Chat User", bucket: "GEO / AI Assistant" },
      { ua: "Mozilla/5.0 (compatible; GoogleOther)", label: "Google / GoogleOther", bucket: "GEO / AI Crawler" },
    ];
    for (const item of cases) {
      const identity = classifyTrafficIdentity({ userAgent: item.ua });
      expect(identity.label).toBe(item.label);
      expect(identity.isAi).toBe(true);
      expect(trafficBucketLabel(identity)).toBe(item.bucket);
    }
  });

  it("splits Applebot search traffic from Applebot-Extended AI training", () => {
    const search = classifyTrafficIdentity({
      userAgent: "Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)",
    });
    const training = classifyTrafficIdentity({ userAgent: "Applebot-Extended/1.0" });

    expect(search.isAi).toBe(false);
    expect(trafficBucketLabel(search)).toBe("SEO / Search Bot");
    expect(training.isAi).toBe(true);
    expect(trafficBucketLabel(training)).toBe("GEO / AI Crawler");
  });

  it("separates scripts and headless browsers from human traffic", () => {
    const script = classifyTrafficIdentity({ userAgent: "python-requests/2.32.0" });
    const headless = classifyTrafficIdentity({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/126.0 Safari/537.36",
    });

    expect(script.label).toBe("Script / HTTP Client");
    expect(script.isBot).toBe(true);
    expect(trafficBucketLabel(script)).toBe("Monitoring / Script");
    expect(headless.label).toBe("Automation / Headless Browser");
    expect(headless.isBot).toBe(true);
  });

  it("classifies domestic AI product referrals", () => {
    const cases = [
      { referrer: "https://chat.deepseek.com/", label: "DeepSeek / Referral" },
      { referrer: "https://tongyi.aliyun.com/qianwen", label: "Alibaba / 通义 Referral" },
      { referrer: "https://yiyan.baidu.com/", label: "Baidu / 文心 Referral" },
      { referrer: "https://www.doubao.com/chat/", label: "ByteDance / Doubao Referral" },
      { referrer: "https://metaso.cn/search/xxx", label: "Metaso / 秘塔 Referral" },
      { referrer: "https://copilot.microsoft.com/", label: "Microsoft / Copilot Referral" },
    ];
    for (const item of cases) {
      const identity = classifyTrafficIdentity({ referrer: item.referrer });
      expect(identity.label).toBe(item.label);
      expect(identity.isAi).toBe(true);
      expect(trafficBucketLabel(identity)).toBe("GEO / AI Referral");
    }
  });
});
