from pages.dom import DomOperator
import time


class EmbeddingsPage(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def select_model(self, name):
        select = self.dom_operator.getByPath(
            "//div[@data-locator='select-model']", wait=5
        )
        select.click()

        option = self.dom_operator.getByPath(
            f"//span[contains(text(),'{name}')]", wait=15
        )
        option.click()
        close = self.dom_operator.getByPath(
            "//div[@data-locator='select-model']//button", wait=5
        )
        close.click()

    def set_input(self, key, passage):
        dom = self.dom_operator.getByPath(
            f"//span[@data-locator='input-{key}']//textarea",
            wait=5,
        )
        dom.send_keys(passage)

    def submit(self):
        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)
        button = self.dom_operator.getByPath("//button[@data-locator='submit']", wait=5)
        button.click()

    def add_input(self):
        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)
        button = self.dom_operator.getByPath("//button[@data-locator='add']", wait=5)
        button.click()

    def are_results_visble(self):
        dom = self.dom_operator.getByPath(
            "//span[@data-locator='result-toggle']",
            wait=25,
        )
        return dom != False
