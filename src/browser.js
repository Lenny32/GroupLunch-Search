import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

export async function launchBrowser({ headless, viewport, logger }) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  logger.info("Browser launched", { headless, viewport });
  return { browser, context, page };
}

export async function ensureDir(dirPath) {
  const full = path.resolve(dirPath);
  if (!fs.existsSync(full)) {
    fs.mkdirSync(full, { recursive: true });
  }
  return full;
}

export function stripStyleTagsFromHtml(html) {
  if (!html) return html;
  return html
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/\sstyle\s*=\s*"[^"]*"/gi, "")
    .replace(/\sstyle\s*=\s*'[^']*'/gi, "")
    .replace(/\sstyle\s*=\s*[^\s>]+/gi, "")
    .replace(/\t+/g, "")
    .replace(/>\s+</g, "><")
    .trim();
}

export async function grabHtml(page, maxChars) {
  const html = await page.content();
  if (!maxChars || html.length <= maxChars) return html;
  return html.slice(0, maxChars);
}

export async function grabVisibleText(page, maxChars) {
  const text = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const chunks = [];
    let node = walker.nextNode();
    while (node) {
      const value = node.nodeValue?.replace(/\s+/g, " ").trim();
      if (value) chunks.push(value);
      node = walker.nextNode();
    }
    return chunks.join("\n");
  });

  if (!maxChars || text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

export async function grabElementSnapshots(page, limit = 40) {
  const candidates = await page.evaluate((maxItems) => {
    const elements = Array.from(
      document.querySelectorAll("a, button, [role='button'], input, select, textarea, [onclick]")
    );

    const scored = elements
      .map((el) => {
        const text = (el.innerText || el.getAttribute("aria-label") || el.value || "")
          .replace(/\s+/g, " ")
          .trim();
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0;
        const href = el.getAttribute("href") || "";
        return {
          tag: el.tagName.toLowerCase(),
          text,
          href,
          id: el.id || "",
          className: el.className || "",
          role: el.getAttribute("role") || "",
          placeholder: el.getAttribute("placeholder") || "",
          ariaLabel: el.getAttribute("aria-label") || "",
          value: el.value || "",
          visible,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      })
      .filter((item) => item.visible)
      .sort((a, b) => b.text.length - a.text.length);

    return scored.slice(0, maxItems);
  }, limit);

  return candidates;
}

export async function detectAndClosePopup(page, logger) {
  const modalSelector = "[role='dialog'], [aria-modal='true'], .modal, .popup, .overlay, .lightbox";
  const modal = page.locator(modalSelector).first();
  const modalVisible = await modal.isVisible().catch(() => false);
  if (!modalVisible) {
    logger.debug("No popup detected", { selector: modalSelector });
    return { found: false, closed: false };
  }

  logger.info("Popup detected; attempting to close", { selector: modalSelector });

  const closeSelectors = [
    "button[aria-label*='close' i]",
    "button[title*='close' i]",
    "button:has-text('Close')",
    "button:has-text('close')",
    "button:has-text('Dismiss')",
    "button:has-text('dismiss')",
    "button:has-text('No thanks')",
    "button:has-text('No Thanks')",
    "button:has-text('Accept')",
    "button:has-text('Agree')",
    "button:has-text('OK')",
    "button:has-text('Okay')",
    "button:has-text('Got it')",
    "button:has-text('×')",
    "button:has-text('x')",
    "[aria-label*='close' i]",
    "[data-testid*='close' i]",
    "[class*='close' i]",
    "aria-label=\"Close\""
  ];

  for (const selector of closeSelectors) {
    const button = modal.locator(selector).first();
    const isVisible = await button.isVisible().catch(() => false);
    if (!isVisible) continue;
    try {
      await button.click({ timeout: 2000 });
      logger.info("Popup closed", { selector });
      return { found: true, closed: true, selector };
    } catch (err) {
      logger.warn("Popup close attempt failed", { selector, error: err.message });
    }
  }

  logger.warn("Popup detected but no close action succeeded");
  return { found: true, closed: false };
}

export async function takeScreenshot(page, dirPath, name, fullPage = true) {
  const fileName = name || `shot-${Date.now()}.png`;
  const filePath = path.join(dirPath, fileName);
  await page.screenshot({ path: filePath, fullPage });
  return filePath;
}

export async function performAction(page, action, logger) {
  const { type } = action;

  switch (type) {
    case "click":
      if (action.selector) {
        await page.click(action.selector);
        return `Clicked ${action.selector}`;
      }
      if (typeof action.x === "number" && typeof action.y === "number") {
        await page.mouse.click(action.x, action.y);
        return `Clicked at ${action.x},${action.y}`;
      }
      throw new Error("click requires selector or x/y");

    case "type":
      if (!action.selector) throw new Error("type requires selector");
      await page.fill(action.selector, action.text ?? "");
      if (action.submit) {
        await page.press(action.selector, "Enter");
      }
      return `Typed into ${action.selector}`;

    case "scroll": {
      const amount = action.amount ?? 600;
      const direction = action.direction ?? "down";
      const delta = direction === "up" ? -amount : amount;
      await page.mouse.wheel(0, delta);
      return `Scrolled ${direction} ${amount}`;
    }

    case "wait":
      await page.waitForTimeout(action.ms ?? 1000);
      return `Waited ${action.ms ?? 1000}ms`;

    case "navigate":
      if (!action.url) throw new Error("navigate requires url");
      await page.goto(action.url, { waitUntil: "domcontentloaded" });
      return `Navigated to ${action.url}`;

    case "screenshot": {
      if (!action.dirPath) throw new Error("screenshot requires dirPath");
      const filePath = await takeScreenshot(
        page,
        action.dirPath,
        action.name,
        action.fullPage ?? true
      );
      return `Screenshot saved ${filePath}`;
    }

    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}