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
            wait=60,
        )
        assert dom != False

        # Wait for the confirm modal's closing overlay to fully detach so
        # that subsequent clicks on the page chrome are not intercepted.
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.common.by import By
        from selenium.common.exceptions import TimeoutException

        try:
            WebDriverWait(self.driver, 10).until(
                lambda d: not d.find_elements(
                    By.XPATH, "//*[@data-locator='confirm-delete-all']"
                )
            )
        except TimeoutException:
            pass

    def open_session(self, name):
        dom = self.dom_operator.getByPath(
            f"//a[contains(text(),'{name}')]",
            wait=25,
        )
        dom.click()
