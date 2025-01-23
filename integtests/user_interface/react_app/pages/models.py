from pages.dom import DomOperator


class ModelsPage(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def find_model(self, name):
        dom = self.dom_operator.getByPath(
            f"//th//div[contains(text(),'{name}')]",
            wait=25,
        )
        assert dom != False
