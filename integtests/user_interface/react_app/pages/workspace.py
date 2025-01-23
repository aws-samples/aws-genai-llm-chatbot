from pages.dom import DomOperator
import time


class WorkspacePage(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def is_status_creating(self):
        dom = self.dom_operator.getByPath(
            "//span[@data-locator='workspace-status']//span[contains(text(),'Creating')]",  # noqa
            wait=5,
        )
        return dom != False

    def text_tab(self):
        dom = self.dom_operator.getByPath(
            "//button[@data-testid='text']",
            wait=5,
        )
        dom.click()

    def add_text_content(self, title, content):
        dom = self.dom_operator.getByPath(
            "//a[@data-locator='add-link']",
            wait=5,
        )
        dom.click()

        dom = self.dom_operator.getByPath(
            "//div[@data-locator='document-title']//input",
            wait=5,
        )
        dom.send_keys(title)
        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)
        dom = self.dom_operator.getByPath(
            "//span[@data-locator='document-content']//textarea",
            wait=5,
        )
        dom.send_keys(content)
        button = self.dom_operator.getByPath("//button[@data-testid='create']", wait=5)
        button.click()
