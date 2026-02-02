import os
import time
from dataclasses import dataclass
from typing import Dict, List, Optional
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, Page, Browser

from .agent import LLMActionAgent


@dataclass
class RunResult:
    history: List[Dict]
    extractions: List[Dict]
    screenshots: List[str]


def _build_user_agent(browser: Browser) -> str:
    version = str(browser.version).replace("Chromium ", "")
    return (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        f"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36"
    )


def _is_allowed(url: str, allowed_hosts: Optional[List[str]]) -> bool:
    if not allowed_hosts:
        return True
    host = urlparse(url).hostname or ""
    return host in allowed_hosts


def _safe_filename(name: str) -> str:
    keep = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"
    return "".join(ch for ch in name if ch in keep) or "file"


class ActionRunner:
    def __init__(
        self,
        agent: LLMActionAgent,
        headless: bool = True,
        screenshot_each_step: bool = True,
        step_delay_s: float = 0.5,
        text_limit: int = 4000,
    ):
        self.agent = agent
        self.headless = headless
        self.screenshot_each_step = screenshot_each_step
        self.step_delay_s = step_delay_s
        self.text_limit = text_limit

    def run_loop(
        self,
        task: str,
        output_dir: str,
        max_steps: int = 12,
        allowed_hosts: Optional[List[str]] = None,
    ) -> RunResult:
        os.makedirs(output_dir, exist_ok=True)
        history: List[Dict] = []
        extractions: List[Dict] = []
        screenshots: List[str] = []

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless)
            ua = _build_user_agent(browser)
            context = browser.new_context(
                user_agent=ua,
                viewport={"width": 1280, "height": 800},
            )
            page = context.new_page()
            page.set_default_timeout(15000)

            for step in range(max_steps):
                state = self._capture_state(page)
                actions = self.agent.next_actions(task, state, history)
                for action in actions:
                    result = self._execute_action(
                        page, action, output_dir, step, screenshots, allowed_hosts
                    )
                    if result:
                        extractions.append(result)
                    history.append(action)

                if self.screenshot_each_step:
                    shot = self._save_screenshot(page, output_dir, f"step_{step+1}")
                    screenshots.append(shot)

                time.sleep(self.step_delay_s)

            context.close()
            browser.close()

        return RunResult(history=history, extractions=extractions, screenshots=screenshots)

    def _capture_state(self, page: Page) -> Dict:
        try:
            title = page.title()
        except Exception:
            title = ""
        try:
            text = page.inner_text("body")
        except Exception:
            text = ""
        text = (text or "")[: self.text_limit]
        links = []
        try:
            links = page.eval_on_selector_all(
                "a",
                "els => els.slice(0, 20).map(e => ({text: e.innerText.trim(), href: e.href}))",
            )
        except Exception:
            links = []
        return {
            "url": page.url,
            "title": title,
            "text": text,
            "links": links,
        }

    def _execute_action(
        self,
        page: Page,
        action: Dict,
        output_dir: str,
        step: int,
        screenshots: List[str],
        allowed_hosts: Optional[List[str]],
    ) -> Optional[Dict]:
        action_type = action.get("type")
        if action_type == "goto":
            url = action.get("url")
            if url and _is_allowed(url, allowed_hosts):
                page.goto(url, wait_until="domcontentloaded")
        elif action_type == "click":
            page.click(action.get("selector"))
        elif action_type == "fill":
            page.fill(action.get("selector"), action.get("text"))
        elif action_type == "press":
            page.press(action.get("selector"), action.get("key"))
        elif action_type == "wait":
            page.wait_for_timeout(int(action.get("ms")))
        elif action_type == "scroll":
            pixels = int(action.get("pixels", 800))
            if action.get("direction") == "up":
                pixels = -abs(pixels)
            page.evaluate("window.scrollBy(0, arguments[0])", pixels)
        elif action_type == "extract":
            selector = action.get("selector") or "body"
            name = action.get("name", f"extract_{step+1}")
            try:
                text = page.inner_text(selector)
            except Exception:
                text = ""
            return {"name": name, "selector": selector, "text": text}
        elif action_type == "screenshot":
            name = action.get("name", f"shot_{step+1}")
            shot = self._save_screenshot(page, output_dir, name)
            screenshots.append(shot)
        return None

    def _save_screenshot(self, page: Page, output_dir: str, name: str) -> str:
        safe = _safe_filename(name)
        path = os.path.join(output_dir, f"{safe}.png")
        page.screenshot(path=path, full_page=True)
        return path
