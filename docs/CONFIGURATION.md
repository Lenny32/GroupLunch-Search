# Configuration

Create a JSON file (e.g. `config.json`) with the following fields.

## Required

- `model`: LLM model name (e.g. `ministral-3:3b`).
- `llmUrl`: Full URL to the LLM chat endpoint (for `ollama`/`openai`). For `azure`, this can be the Azure endpoint.
- `llmApiType`: `ollama`, `openai`, or `azure`.
- `targetUrl`: The starting page to open.

## Optional

- `llmApiKey`: API key for OpenAI-compatible or Azure providers.
- `azureEndpoint`: Azure OpenAI resource endpoint (e.g. `https://your-resource.openai.azure.com`).
- `azureDeployment`: Azure OpenAI deployment name.
- `azureApiVersion`: Azure OpenAI API version (e.g. `2024-06-01`).
- `systemPrompt`: High-level instructions for the LLM.
- `structuredOutputs`: Enable provider structured outputs (default `true`).
- `includeSchemaInPrompt`: Append JSON schema to the system prompt (default `true`).
- `headless`: `true` or `false`.
- `sendScreenshot`: Attach a screenshot path to the LLM state.
- `sendHtml`: Attach HTML to the LLM state.
- `sendText`: Attach visible text to the LLM state.
- `sendSnapshots`: Attach element snapshots to the LLM state.
- `removeHtmlStyle`: Remove `<style>` tags from the HTML string before sending to the LLM.
- `maxHtmlChars`: Truncate HTML to this many characters.
- `maxTextChars`: Truncate visible text to this many characters.
- `snapshotsLimit`: Max number of element snapshots to include.
- `maxSteps`: Maximum number of LLM steps.
- `debugLevel`: `error|warn|info|debug|trace`.
- `viewport`: `{ "width": number, "height": number }`.
- `screenshotDir`: Folder for step screenshots.
- `timeoutMs`: Navigation timeout in milliseconds.
- `llmTimeoutMs`: LLM request timeout in milliseconds.
- `llmMaxRetries`: How many times to retry the LLM call after a failure.
- `llmRetryDelayMs`: Delay between LLM retries in milliseconds.

## Example (Azure OpenAI SDK)

```json
{
  "llmApiType": "azure",
  "llmApiKey": "YOUR_AZURE_API_KEY",
  "azureEndpoint": "https://grouplunchoaishared.openai.azure.com",
  "azureDeployment": "YOUR_DEPLOYMENT_NAME",
  "azureApiVersion": "2024-06-01",
  "targetUrl": "https://example.com/lunch",
  "headless": true
}
```