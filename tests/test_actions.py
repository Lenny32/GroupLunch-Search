from app.actions import parse_actions


def test_parse_actions_normalizes_value_selector():
    raw = '{"actions":[{"type":"click","selector":"css","value":"a[href=\\"/page3.html\\"]"}]}'
    parsed = parse_actions(raw)
    assert not parsed.error
    assert parsed.actions[0]["selector"] == 'a[href="/page3.html"]'


def test_parse_actions_strips_css_prefix_with_space():
    raw = '{"actions":[{"type":"click","selector":"css nav a[href=\\"/page3.html\\"]"}]}'
    parsed = parse_actions(raw)
    assert not parsed.error
    assert parsed.actions[0]["selector"] == 'nav a[href="/page3.html"]'


def test_parse_actions_strips_css_prefix_with_equals():
    raw = '{"actions":[{"type":"click","selector":"css=nav a[href=\\"/page3.html\\"]"}]}'
    parsed = parse_actions(raw)
    assert not parsed.error
    assert parsed.actions[0]["selector"] == 'nav a[href="/page3.html"]'
