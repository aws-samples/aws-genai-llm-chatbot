from pages.login import LoginPage
from pages.layout import Layout
from clients.cognito_client import Credentials


def test_login(selenium_driver, cognito_credentials):
    page = LoginPage(selenium_driver)
    layout = Layout(selenium_driver)
    home_page = page.login(cognito_credentials)
    assert home_page.is_visible() == True
    layout.logout()


def test_invalid_credentials(selenium_driver):
    page = LoginPage(selenium_driver)
    page.login(
        Credentials(
            **{
                "id_token": "",
                "email": "invalid",
                "password": "invalid",  # NOSONAR
                "aws_access_key": "",
                "aws_secret_key": "",
                "aws_token": "",
            }
        )
    )
    assert page.get_error() != None
