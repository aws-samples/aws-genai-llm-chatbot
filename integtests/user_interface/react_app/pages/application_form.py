from pages.dom import DomOperator
import time


class ApplicationForm(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def set_name(self, name):
        input = self.dom_operator.getByPath(
            "//div[@data-locator='name']//input", wait=15
        )
        input.send_keys(name)

    def select_model(self, name):
        select = self.dom_operator.getByPath(
            "//div[@data-locator='select-model']", wait=5
        )
        select.click()

        option = self.dom_operator.getByPath(
            f"//span[contains(text(),'{name}')]", wait=15
        )
        option.click()

    def select_role(self, name):
        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)
        select = self.dom_operator.getByPath(
            "//div[@data-locator='select-role']", wait=5
        )
        select.click()

        option = self.dom_operator.getByPath(
            f"//div[@data-locator='select-role']//span[contains(text(),'{name}')]",
            wait=15,
        )
        option.click()
        close = self.dom_operator.getByPath(
            "//div[@data-locator='select-role']//button", wait=5
        )
        close.click()

    def submit(self):
        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)
        button = self.dom_operator.getByPath("//button[@data-testid='create']", wait=5)
        button.click()
