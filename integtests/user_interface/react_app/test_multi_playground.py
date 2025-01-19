from pages.login import LoginPage
from pages.layout import Layout
from pages.multi_playground import MultiPlaygroundPage


def test_multi_playground(selenium_driver, cognito_admin_credentials, default_model):
    login = LoginPage(selenium_driver)
    layout = Layout(selenium_driver)
    playground = MultiPlaygroundPage(selenium_driver)
    home_page = login.login(cognito_admin_credentials)
    assert home_page.is_visible() == True
    layout.expand_navigation()
    layout.navigate_to("/chatbot/multichat")
    playground.send_prompt('repeat "STRING_DETECT_TEST"', default_model)
    playground.wait_for_reply("STRING_DETECT_TEST")
