from pages.login import LoginPage
from pages.layout import Layout
from pages.sessions import SessionsPage
from pages.playground import PlaygroundPage
import time


def test_playground(selenium_driver, cognito_admin_credentials, default_model):
    login = LoginPage(selenium_driver)
    layout = Layout(selenium_driver)

    home_page = login.login(cognito_admin_credentials)
    assert home_page.is_visible() == True
    layout.expand_navigation()
    sessions = SessionsPage(selenium_driver)
    layout.navigate_to("/chatbot/sessions")
    sessions.delete_all()
    playground = PlaygroundPage(selenium_driver)
    layout.navigate_to("/chatbot/playground")
    playground.select_model(default_model)
    playground.send_prompt('repeat "STRING_DETECT_TEST"')
    playground.wait_for_reply("STRING_DETECT_TEST")
    time.sleep(5)
    layout.navigate_to("/chatbot/sessions")
    sessions.open_session("STRING_DETECT_TEST")
    playground.wait_for_reply("STRING_DETECT_TEST")
