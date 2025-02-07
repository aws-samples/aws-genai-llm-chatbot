from pages.login import LoginPage
from pages.layout import Layout
from pages.cross_encoder import CrossEncoderPage
import pytest


def test_encoder(selenium_driver, cognito_admin_credentials, config):
    enabled = config.get("cross_encoders_enabled")
    if enabled == False:
        pytest.skip("Cross encoders are not enabled")

    login = LoginPage(selenium_driver)
    layout = Layout(selenium_driver)

    home_page = login.login(cognito_admin_credentials)
    assert home_page.is_visible() == True
    layout.expand_navigation()
    page = CrossEncoderPage(selenium_driver)
    layout.navigate_to("/rag/cross-encoders")
    # only supported model at this time
    page.select_model("cross-encoder/ms-marco-MiniLM-L-12-v2")
    page.set_query("Paris")
    page.add_passage()
    page.set_passage(1, "France")
    page.set_passage(0, "Italy")
    page.submit()
    assert page.get_passage(0) == "France"
