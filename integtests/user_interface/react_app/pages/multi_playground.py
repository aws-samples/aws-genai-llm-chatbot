from pages.dom import DomOperator


class MultiPlaygroundPage(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def send_prompt(self, prompt, model):
        add_model = self.dom_operator.getByPath(
            "//button[@data-locator='add-model']", wait=5
        )
        add_model.click()

        for x in ["0", "1", "2"]:
            select = self.dom_operator.getByPath(
                f"//div[@data-locator='select-model-{x}']", wait=5
            )
            select.click()

            option = self.dom_operator.getByPath(
                f"//div[@data-locator='model-{x}']//span[contains(text(),'{model}')]",
                wait=15,
            )
            option.click()

        textarea = self.dom_operator.getByPath(
            "//div[@data-locator='prompt-input']//textarea", wait=5
        )
        textarea.send_keys(prompt)

        submit = self.dom_operator.getByPath(
            "//div[@data-locator='prompt-input']//button[@aria-label='Send'][not(@disabled)]",  # noqa
            wait=5,
        )
        submit.click()

    def wait_for_reply(self, expected_str):
        dom = self.dom_operator.getByPath(
            "//div[@aria-label='ai']//p[contains(text()"  # noqa
            + f",'{expected_str}')]",
            wait=25,
        )
        assert dom != False
