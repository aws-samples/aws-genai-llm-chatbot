from pages.dom import DomOperator


class WorkspacesPage(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def create(self):
        button = self.dom_operator.getByPath(
            "//a[@data-testid='header-btn-create']", wait=5
        )
        button.click()
