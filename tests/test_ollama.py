from app.llm.ollama import _normalize_base_url


def test_normalize_base_url_docker_localhost():
    base = "http://127.0.0.1:11434"
    assert _normalize_base_url(base, in_docker=True) == "http://host.docker.internal:11434"


def test_normalize_base_url_non_docker_keeps():
    base = "http://127.0.0.1:11434"
    assert _normalize_base_url(base, in_docker=False) == base
