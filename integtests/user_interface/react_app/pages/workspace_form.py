from pages.dom import DomOperator
import time


class WorkspaceFormPage(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def set_name(self, name):
        input = self.dom_operator.getByPath(
            "//div[@data-locator='name']//input", wait=5
        )
        input.send_keys(name)

    def submit(self):
        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)
        button = self.dom_operator.getByPath("//button[@data-testid='create']", wait=5)
        button.click()
