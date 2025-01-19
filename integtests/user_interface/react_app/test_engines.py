from pages.login import LoginPage
from pages.layout import Layout
from pages.engines import EnginesPage
import pytest


def test_engines(selenium_driver, cognito_admin_credentials, default_model, client):
    rag_engines = client.list_rag_engines()
    engine = next(i for i in rag_engines if i.get("id") == "aurora")
    if engine.get("enabled") == False:
        pytest.skip("Aurora is not enabled.")
    login = LoginPage(selenium_driver)
    layout = Layout(selenium_driver)

    home_page = login.login(cognito_admin_credentials)
    assert home_page.is_visible() == True
    layout.expand_navigation()
    engines = EnginesPage(selenium_driver)
    layout.navigate_to("/rag/engines")
    assert engines.at_least_one_engine_enabled() == True
