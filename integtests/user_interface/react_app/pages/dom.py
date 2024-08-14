from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import TimeoutException


class DomOperator:
    def __init__(self, driver):
        self.driver = driver

    def getBy(self, type, locator, wait):
        try:
            driver = self.driver
            WebDriverWait(driver, wait).until(
                lambda driver: driver.find_element(type, locator)
            )
            element = driver.find_element(type, locator)
            return element
        except TimeoutException:
            print(f"Timeout exeception waiting for element {locator}")
            return False

    def getByCss(self, css, wait):
        return self.getBy(By.CSS_SELECTOR, css, wait)

    def getByPath(self, path, wait):
        return self.getBy(By.XPATH, path, wait)

    def getByName(self, name, wait):
        return self.getBy(By.NAME, name, wait)
