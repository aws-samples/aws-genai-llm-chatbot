from pages.dom import DomOperator
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys


class ModelsPage(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def find_model(self, name):
        # Narrow the (paginated) Models table via the PropertyFilter so the
        # target row is on the visible page regardless of how many Bedrock
        # base/CRIS/sagemaker entries the account exposes.
        filter_input = self.dom_operator.getByPath(
            "//input[@placeholder='Filter Models']",
            wait=10,
        )
        if filter_input != False:
            # PropertyFilter commits typed text into a token chip on Enter,
            # and input.clear() does not remove existing chips. Dismiss any
            # tokens left over from previous find_model() calls before
            # applying the new one.
            for token in self.driver.find_elements(
                By.XPATH,
                "//button[starts-with(@aria-label,'Remove token')]",
            ):
                try:
                    token.click()
                except Exception:
                    pass

            filter_input.clear()
            filter_input.send_keys(name)
            filter_input.send_keys(Keys.ENTER)

        dom = self.dom_operator.getByPath(
            f"//th//div[contains(text(),'{name}')]",
            wait=25,
        )
        assert dom != False
