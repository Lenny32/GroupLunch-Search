import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { callLLM, loadOptionalFile } from "./llm.js";
import {
  launchBrowser,
  ensureDir,
  grabHtml,
  grabVisibleText,
  grabElementSnapshots,
  detectAndClosePopup,
  stripStyleTagsFromHtml,
  takeScreenshot,
  performAction
} from "./browser.js";

const TOOL_SCHEMA = `You can control a Chromium browser with JSON actions.
Return ONLY a single JSON object with this schema:
{
  "type": "click|type|scroll|wait|navigate|screenshot|extract|done",
  "reason": "short explanation",
  "selector": "css selector (for click/type)",
  "x": number,
  "y": number,
  "text": "text to type",
  "submit": boolean,
  "direction": "up|down",
  "amount": number,
  "ms": number,
  "url": "url for navigate",
  "name": "screenshot filename",
  "fullPage": boolean,
  "content": [{ "dish": "string", "price": "string" }],
  "format": "json",
  "popupHandled": boolean,
  "popupNotes": "string"
}
Use one action at a time. If a modal or fullscreen popup blocks the page, close it first (look for close buttons, X icons, or accept/decline actions). If a popup was detected and not closed by the app, make your next action close it and set popupHandled=true.`;

const SCHEMA_PATH = "./schemas/action.schema.json";
const HTML_TOKEN_THRESHOLD = 200000;
const HTML_CHUNK_TOKENS = 50000;

function parseArgs() {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--config");
  if (idx === -1 || !args[idx + 1]) {
    throw new Error("Usage: node src/index.js --config path/to/config.json");
  }
  return { configPath: args[idx + 1] };
}

function buildStateMessage({
  step,
  url,
  html,
  text,
  snapshots,
  screenshotPath,
  lastAction,
  lastResult,
  lastError,
  popupResult
}) {
  const parts = [
    `Step: ${step}`,
    `URL: ${url}`
  ];
  if (popupResult) {
    parts.push(`PopupDetected: ${popupResult.found}`);
    parts.push(`PopupClosed: ${popupResult.closed}`);
    if (popupResult.selector) {
      parts.push(`PopupSelector: ${popupResult.selector}`);
    }
  }
  if (lastAction) parts.push(`LastAction: ${JSON.stringify(lastAction)}`);
  if (lastResult) parts.push(`LastResult: ${lastResult}`);
  if (lastError) parts.push(`LastError: ${lastError}`);
  if (snapshots && snapshots.length) {
    parts.push(`ElementSnapshots:\n${JSON.stringify(snapshots)}`);
  }
  if (text) parts.push(`VisibleText:\n${text}`);
  if (html) parts.push(`HTML:\n${html}`);
  if (screenshotPath) parts.push(`Screenshot: ${screenshotPath}`);
  return parts.join("\n\n");
}

function buildValidator(schemaPath) {
  const schemaText = loadOptionalFile(schemaPath);
  if (!schemaText) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  const schema = JSON.parse(schemaText);
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  return { validate, schemaText };
}

function formatAjvErrors(errors) {
  if (!errors || !errors.length) return "unknown schema error";
  return errors
    .map((err) => `${err.instancePath || "action"} ${err.message}`)
    .join("; ");
}

function buildConfigSummary(config) {
  return {
    model: config.model,
    llmUrl: config.llmUrl,
    llmApiType: config.llmApiType,
    azureEndpoint: config.azureEndpoint ? "[set]" : "",
    azureDeployment: config.azureDeployment ? "[set]" : "",
    azureApiVersion: config.azureApiVersion ? "[set]" : "",
    targetUrl: config.targetUrl,
    headless: config.headless,
    structuredOutputs: config.structuredOutputs,
    includeSchemaInPrompt: config.includeSchemaInPrompt,
    sendHtml: config.sendHtml,
    sendText: config.sendText,
    sendSnapshots: config.sendSnapshots,
    sendScreenshot: config.sendScreenshot,
    removeHtmlStyle: config.removeHtmlStyle,
    maxHtmlChars: config.maxHtmlChars,
    maxTextChars: config.maxTextChars,
    snapshotsLimit: config.snapshotsLimit,
    maxSteps: config.maxSteps,
    debugLevel: config.debugLevel,
    viewport: config.viewport,
    screenshotDir: config.screenshotDir,
    timeoutMs: config.timeoutMs,
    llmTimeoutMs: config.llmTimeoutMs,
    llmMaxRetries: config.llmMaxRetries,
    llmRetryDelayMs: config.llmRetryDelayMs
  };
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function estimateTokens(text) {
  return Math.ceil((text?.length ?? 0) / 4);
}

function splitIntoChunks(text, tokensPerChunk) {
  const charsPerChunk = tokensPerChunk * 4;
  const chunks = [];
  for (let i = 0; i < text.length; i += charsPerChunk) {
    chunks.push(text.slice(i, i + charsPerChunk));
  }
  return chunks;
}

async function main() {
  const { configPath } = parseArgs();
  const config = loadConfig(configPath);
  const logger = createLogger(config.debugLevel);
  const { validate: validateAction, schemaText } = buildValidator(SCHEMA_PATH);
  const schema = JSON.parse(schemaText);

  logger.debug("Config loaded", buildConfigSummary(config));

  const { browser, page } = await launchBrowser({
    headless: config.headless,
    viewport: config.viewport,
    logger
  });

  const artifactsRoot = await ensureDir(config.screenshotDir);
  const sessionStamp = nowStamp();
  const sessionDir = await ensureDir(path.join(artifactsRoot, `session-${sessionStamp}`));
  logger.info("Artifacts session created", { sessionDir });

  const messages = [];

  let systemPrompt = `${config.systemPrompt}\n\nIMPORTANT: If a modal or fullscreen popup blocks the page, close it first (look for close buttons, X icons, or accept/decline actions).\n\n${TOOL_SCHEMA}`.trim();
  if (config.includeSchemaInPrompt) {
    systemPrompt = `${systemPrompt}\n\nJSON_SCHEMA:\n${JSON.stringify(schema)}`.trim();
  }

  messages.push({ role: "system", content: systemPrompt });
  logger.debug("System prompt prepared", { includeSchemaInPrompt: config.includeSchemaInPrompt });

  let lastAction = null;
  let lastResult = null;
  let lastError = null;
  let step = 0;

  try {
    logger.info("Navigating to target", { url: config.targetUrl });
    await page.goto(config.targetUrl, { waitUntil: "domcontentloaded", timeout: config.timeoutMs });

    while (step < config.maxSteps) {
      step += 1;
      logger.debug("Starting step", { step, url: page.url() });

      const popupResult = await detectAndClosePopup(page, logger);
      logger.debug("Popup check result", popupResult);
      if (popupResult.found && !popupResult.closed) {
        logger.info("Popup still visible; LLM should attempt to close", popupResult);
      }

      let html = config.sendHtml ? await grabHtml(page, config.maxHtmlChars) : "";
      if (config.removeHtmlStyle && html) {
        html = stripStyleTagsFromHtml(html);
        logger.debug("Stripped style tags from HTML string");
      }

      const text = config.sendText ? await grabVisibleText(page, config.maxTextChars) : "";
      const snapshots = config.sendSnapshots
        ? await grabElementSnapshots(page, config.snapshotsLimit)
        : [];

      let screenshotPath = "";
      if (config.sendScreenshot) {
        const shotName = `${step}_screenshot_${nowStamp()}.jpg`;
        screenshotPath = await takeScreenshot(page, sessionDir, shotName, true);
      }

      if (html) {
        const htmlPath = path.join(sessionDir, `${step}_sent_${nowStamp()}.html`);
        fs.writeFileSync(htmlPath, html, "utf-8");
      }

      const htmlTokenEstimate = estimateTokens(html);
      let htmlChunks = [];
      let htmlForState = html;

      if (html && htmlTokenEstimate > HTML_TOKEN_THRESHOLD) {
        htmlChunks = splitIntoChunks(html, HTML_CHUNK_TOKENS);
        htmlForState = "";
        logger.debug("HTML split into chunks", {
          tokenEstimate: htmlTokenEstimate,
          chunks: htmlChunks.length,
          tokensPerChunk: HTML_CHUNK_TOKENS
        });
      }

      logger.debug("State captured", {
        htmlChars: html.length,
        htmlTokensEstimated: htmlTokenEstimate,
        textChars: text.length,
        snapshotsCount: snapshots.length,
        screenshotPath: screenshotPath || null
      });

      const stateMessage = buildStateMessage({
        step,
        url: page.url(),
        html: htmlForState,
        text,
        snapshots,
        screenshotPath,
        lastAction,
        lastResult,
        lastError,
        popupResult
      });

      messages.push({ role: "user", content: stateMessage });
      logger.debug("State message prepared", { chars: stateMessage.length });

      const statePath = path.join(sessionDir, `${step}_state_${nowStamp()}.txt`);
      fs.writeFileSync(statePath, stateMessage, "utf-8");

      if (htmlChunks.length > 0) {
        htmlChunks.forEach((chunk, index) => {
          const chunkMsg = `HTML_CHUNK ${index + 1}/${htmlChunks.length}:\n${chunk}`;
          messages.push({ role: "user", content: chunkMsg });
        });
        logger.debug("HTML chunks appended to messages", { chunks: htmlChunks.length });
      }

      logger.debug("Sending state to LLM", { step, url: page.url(), messages: messages.length });
      const raw = await callLLM({
        apiType: config.llmApiType,
        url: config.llmUrl,
        apiKey: config.llmApiKey,
        model: config.model,
        messages,
        format: config.structuredOutputs ? schema : null,
        logger,
        timeoutMs: config.llmTimeoutMs,
        maxRetries: config.llmMaxRetries,
        retryDelayMs: config.llmRetryDelayMs,
        azureEndpoint: config.azureEndpoint || config.llmUrl,
        azureDeployment: config.azureDeployment,
        azureApiVersion: config.azureApiVersion
      });

      const responsePath = path.join(sessionDir, `${step}_response_${nowStamp()}.json`);
      fs.writeFileSync(responsePath, raw, "utf-8");

      logger.debug("LLM raw response", {
        rawLength: raw.length,
        rawPreview: raw.slice(0, 200)
      });
      messages.push({ role: "assistant", content: raw });

      let action;
      try {
        action = JSON.parse(raw);
      } catch (err) {
        lastError = `Invalid JSON response: ${err.message}`;
        logger.warn(lastError);
        continue;
      }

      const actionPath = path.join(sessionDir, `${step}_action_${nowStamp()}.json`);
      fs.writeFileSync(actionPath, JSON.stringify(action, null, 2), "utf-8");

      const valid = validateAction(action);
      if (!valid) {
        lastError = `Invalid action: ${formatAjvErrors(validateAction.errors)}`;
        logger.warn(lastError, { action });
        continue;
      }

      lastAction = action;
      lastError = null;
      logger.debug("Validated action", { type: action.type, selector: action.selector, url: action.url });

      if (action.type === "extract" || action.type === "done") {
        const outPath = path.resolve("extracted-menu.json");
        fs.writeFileSync(outPath, JSON.stringify(action.content, null, 2), "utf-8");
        logger.info("Extraction completed", { outPath, items: action.content?.length ?? 0 });
        break;
      }

      try {
        if (action.type === "screenshot") {
          action.dirPath = sessionDir;
        }
        lastResult = await performAction(page, action, logger);
        logger.info("Action performed", { lastResult });
      } catch (err) {
        lastError = err.message;
        logger.warn("Action failed", { error: lastError });
      }
    }

    if (step >= config.maxSteps) {
      logger.warn("Reached max steps without extraction", { maxSteps: config.maxSteps });
    }
  } finally {
    await browser.close();
    logger.info("Browser closed");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});