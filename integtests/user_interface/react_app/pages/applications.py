from pages.dom import DomOperator


class ApplicationsPage(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def create(self):
        button = self.dom_operator.getByPath(
            "//a[@data-testid='header-btn-manage']", wait=5
        )
        button.click()

    def open(self, name):
        option = self.dom_operator.getByPath(f"//a[contains(text(),'{name}')]", wait=15)
        option.click()
