import fs from "node:fs";
import path from "node:path";
import { AzureOpenAI } from "openai";

function buildOllamaPayload(model, messages, format) {
  const payload = {
    model,
    stream: false,
    messages
  };

  if (format) {
    payload.format = format;
  }

  return payload;
}

function buildOpenAICompatPayload(model, messages) {
  return {
    model,
    messages,
    temperature: 0.2
  };
}

function buildAzurePayload(messages, deployment) {
  return {
    model: deployment,
    messages,
    temperature: 0.2
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let cachedAzureClient = null;
let cachedAzureKey = "";

function getAzureClient({ endpoint, apiKey, deployment, apiVersion }) {
  const key = `${endpoint}|${deployment}|${apiVersion}|${apiKey}`;
  if (cachedAzureClient && cachedAzureKey === key) {
    return cachedAzureClient;
  }

  cachedAzureClient = new AzureOpenAI({
    endpoint,
    apiKey,
    deployment,
    apiVersion
  });
  cachedAzureKey = key;
  return cachedAzureClient;
}

export async function callLLM({
  apiType,
  url,
  apiKey,
  model,
  messages,
  format,
  logger,
  timeoutMs,
  maxRetries,
  retryDelayMs,
  azureEndpoint,
  azureDeployment,
  azureApiVersion
}) {
  let headers = {
    "Content-Type": "application/json"
  };

  let payload;
  let finalUrl = url;
  let useSdk = false;

  if (apiType === "ollama") {
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    payload = buildOllamaPayload(model, messages, format);
  } else if (apiType === "openai") {
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    payload = buildOpenAICompatPayload(model, messages);
  } else if (apiType === "azure") {
    if (!azureEndpoint || !azureDeployment || !azureApiVersion) {
      throw new Error("Azure config missing: azureEndpoint, azureDeployment, azureApiVersion are required");
    }
    if (!apiKey) {
      throw new Error("Azure config missing: llmApiKey is required");
    }
    useSdk = true;
    payload = buildAzurePayload(messages, azureDeployment);
  } else {
    throw new Error(`Unsupported llmApiType: ${apiType}`);
  }

  const payloadText = JSON.stringify(payload);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      logger.debug("Calling LLM", {
        apiType,
        url: finalUrl,
        model,
        formatEnabled: Boolean(format),
        payloadChars: payloadText.length,
        attempt: attempt + 1,
        useSdk
      });

      if (useSdk) {
        const client = getAzureClient({
          endpoint: azureEndpoint,
          apiKey,
          deployment: azureDeployment,
          apiVersion: azureApiVersion
        });

        const response = await client.chat.completions.create(payload, { signal: controller.signal });
        return response?.choices?.[0]?.message?.content ?? "";
      }

      const res = await fetch(finalUrl, {
        method: "POST",
        headers,
        body: payloadText,
        signal: controller.signal
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`LLM error ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (apiType === "ollama") {
        return data?.message?.content ?? "";
      }

      return data?.choices?.[0]?.message?.content ?? "";
    } catch (err) {
      const isLastAttempt = attempt >= maxRetries;
      const reason = err.name === "AbortError" ? "timeout" : "error";
      logger.warn("LLM request failed", {
        reason,
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        message: err.message
      });

      if (isLastAttempt) {
        throw err;
      }

      await sleep(retryDelayMs);
    } finally {
      clearTimeout(timeout);
    }
  }

  return "";
}

export function loadOptionalFile(filePath) {
  if (!filePath) return null;
  const full = path.resolve(filePath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf-8");
}