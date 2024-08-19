from routes.health import health


def test_health():
    assert health() == True
