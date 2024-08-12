from pages.dom import DomOperator


class Layout(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def expand_navigation(self):
        self.dom_operator.getByCss(
            "button[class*='awsui_navigation-toggle']", wait=5
        ).click()

    def navigate_to(self, path):
        self.dom_operator.getByPath("//a[@href='" + path + "']", wait=5).click()

    def logout(self):
        self.dom_operator.getByPath(
            "//div[@class='awsui-context-top-navigation']//header//button", wait=5
        ).click()
        self.dom_operator.getByPath(
            "//span[contains(text(),'Sign out')]", wait=5
        ).click()
        # check if back to the login page
        self.dom_operator.getByName("username", wait=5)
