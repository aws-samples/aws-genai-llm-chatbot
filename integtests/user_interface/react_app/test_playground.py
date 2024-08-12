from pages.login import LoginPage
from pages.layout import Layout
from pages.playground import PlaygroundPage


def test_message(selenium_driver, cognito_credentials, default_model):
    login = LoginPage(selenium_driver)
    layout = Layout(selenium_driver)
    playground = PlaygroundPage(selenium_driver)
    home_page = login.login(cognito_credentials)
    assert home_page.is_visible() == True
    layout.expand_navigation()
    layout.navigate_to("/chatbot/playground")
    playground.send_prompt('repeat "STRING_DETECT_TEST"', default_model)
    playground.wait_for_reply("STRING_DETECT_TEST")
