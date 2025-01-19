from pages.dom import DomOperator


class DashboardPage(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def is_loaded(self):
        # At least 1 item in the table
        dom = self.dom_operator.getByPath(
            "//tr//td",
            wait=25,
        )
        return dom != False
