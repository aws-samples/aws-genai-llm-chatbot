from pages.dom import DomOperator


class HomePage(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def is_visible(self):
        self.dom_operator.getByPath("//*[@data-locator='welcome-header']", wait=5)
        return True
