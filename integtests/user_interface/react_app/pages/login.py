from clients.cognito_client import Credentials
from pages.home import HomePage
from pages.dom import DomOperator


class LoginPage(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def login(self, credentials: Credentials):
        email = self.dom_operator.getByName("username", wait=5)
        password = self.dom_operator.getByName("password", wait=5)
        button = self.dom_operator.getByPath("//button[@type='submit']", wait=5)

        email.send_keys(credentials.email)
        password.send_keys(credentials.password)
        button.click()
        return HomePage(self.driver)

    def get_error(self):
        return self.dom_operator.getByPath("//div[@role='alert']", wait=5)
