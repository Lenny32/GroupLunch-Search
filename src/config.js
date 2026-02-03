import fs from "node:fs";
import path from "node:path";

const requiredKeys = ["model", "llmUrl", "llmApiType", "targetUrl"];

export function loadConfig(configPath) {
  const fullPath = path.resolve(configPath);
  const raw = fs.readFileSync(fullPath, "utf-8");
  const data = JSON.parse(raw);

  for (const key of requiredKeys) {
    if (!data[key]) {
      throw new Error(`Missing required config key: ${key}`);
    }
  }

  return {
    model: data.model,
    llmUrl: data.llmUrl,
    llmApiType: data.llmApiType,
    llmApiKey: data.llmApiKey || "",
    azureEndpoint: data.azureEndpoint || "",
    azureDeployment: data.azureDeployment || "",
    azureApiVersion: data.azureApiVersion || "",
    systemPrompt: data.systemPrompt || "",
    structuredOutputs: data.structuredOutputs ?? true,
    includeSchemaInPrompt: data.includeSchemaInPrompt ?? true,
    targetUrl: data.targetUrl,
    headless: data.headless ?? true,
    sendScreenshot: data.sendScreenshot ?? true,
    sendHtml: data.sendHtml ?? true,
    sendText: data.sendText ?? true,
    sendSnapshots: data.sendSnapshots ?? true,
    removeHtmlStyle: data.removeHtmlStyle ?? false,
    maxHtmlChars: data.maxHtmlChars ?? 20000,
    maxTextChars: data.maxTextChars ?? 12000,
    snapshotsLimit: data.snapshotsLimit ?? 40,
    maxSteps: data.maxSteps ?? 15,
    debugLevel: data.debugLevel || "info",
    viewport: data.viewport || { width: 1280, height: 800 },
    screenshotDir: data.screenshotDir || "./artifacts",
    timeoutMs: data.timeoutMs ?? 20000,
    llmTimeoutMs: data.llmTimeoutMs ?? 180000,
    llmMaxRetries: data.llmMaxRetries ?? 1,
    llmRetryDelayMs: data.llmRetryDelayMs ?? 2000
  };
}