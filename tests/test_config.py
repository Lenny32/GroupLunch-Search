from app.config import _strip_json_comments, load_config


def test_strip_json_comments():
    raw = '{\n  // line\n  "a": 1, /* block */\n  "b": "http://x//y"\n}\n'
    cleaned = _strip_json_comments(raw)
    assert "// line" not in cleaned
    assert "/* block */" not in cleaned
    assert '"http://x//y"' in cleaned


def test_load_config(tmp_path):
    path = tmp_path / "config.jsonc"
    path.write_text(
        '{\n'
        '  // comment\n'
        '  "llm": {"provider": "ollama", "model": "llama3.1", "base_url": "http://localhost:11434"},\n'
        '  "goal": "Do the thing",\n'
        '  "instructions": "Stay focused",\n'
        '  "max_depth": 3\n'
        '}\n',
        encoding="utf-8",
    )
    cfg = load_config(str(path))
    assert cfg.provider == "ollama"
    assert cfg.model == "llama3.1"
    assert cfg.base_url == "http://localhost:11434"
    assert cfg.goal == "Do the thing"
    assert cfg.instructions == "Stay focused"
    assert cfg.max_depth == 3
