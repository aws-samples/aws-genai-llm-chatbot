from pages.dom import DomOperator


class EnginesPage(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def at_least_one_engine_enabled(self):
        dom = self.dom_operator.getByPath(
            "//span[contains(text(),'Enabled')]",
            wait=25,
        )
        return dom != False
