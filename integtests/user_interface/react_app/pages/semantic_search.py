from pages.dom import DomOperator


class SemanticSearchPage(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def select_workspace(self, name):
        select = self.dom_operator.getByPath(
            "//div[@data-locator='select-workspace']", wait=5
        )
        select.click()

        option = self.dom_operator.getByPath(
            f"//span[contains(text(),'{name}')]", wait=15
        )
        option.click()

    def search(self, query):
        dom = self.dom_operator.getByPath(
            "//span[@data-locator='query']//textarea",
            wait=5,
        )
        dom.send_keys(query)
        button = self.dom_operator.getByPath("//button[@data-locator='submit']", wait=5)
        button.click()

    def is_no_result_visible(self):
        dom = self.dom_operator.getByPath(
            "//div[@data-locator='no-result']",
            wait=5,
        )
        return dom != False
