from pages.dom import DomOperator
import time


class CrossEncoderPage(object):
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

    def set_query(self, query):
        dom = self.dom_operator.getByPath(
            "//span[@data-locator='query']//textarea",
            wait=5,
        )
        dom.send_keys(query)

    def set_passage(self, key, passage):
        dom = self.dom_operator.getByPath(
            f"//span[@data-locator='passage-{key}']//textarea",
            wait=5,
        )
        dom.send_keys(passage)

    def get_passage(self, key):
        dom = self.dom_operator.getByPath(
            f"//span[@data-locator='passage-result-{key}']//textarea",
            wait=5,
        )
        return dom.text

    def submit(self):
        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)
        button = self.dom_operator.getByPath("//button[@data-locator='submit']", wait=5)
        button.click()

    def add_passage(self):
        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)
        button = self.dom_operator.getByPath(
            "//button[@data-locator='add-passage']", wait=5
        )
        button.click()
