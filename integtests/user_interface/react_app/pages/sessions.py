from pages.dom import DomOperator


class SessionsPage(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def delete_all(self):
        button = self.dom_operator.getByPath(
            "//button[@data-locator='delete-all']", wait=5
        )
        button.click()

        button = self.dom_operator.getByPath(
            "//button[@data-locator='confirm-delete-all']", wait=5
        )
        button.click()

        dom = self.dom_operator.getByPath(
            "//b[contains(text(),'No sessions')]",
            wait=25,
        )
        assert dom != False

    def open_session(self, name):
        dom = self.dom_operator.getByPath(
            f"//a[contains(text(),'{name}')]",
            wait=25,
        )
        dom.click()
