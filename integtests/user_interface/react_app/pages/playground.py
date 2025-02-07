from pages.dom import DomOperator


class PlaygroundPage(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def is_model_select_visible(self):
        select = self.dom_operator.getByPath(
            "//div[@data-locator='select-model']", wait=5
        )
        return select != False

    def select_model(self, model):
        select = self.dom_operator.getByPath(
            "//div[@data-locator='select-model']", wait=5
        )
        select.click()

        option = self.dom_operator.getByPath(
            f"//span[contains(text(),'{model}')]", wait=15
        )
        option.click()

    def send_prompt(self, prompt):
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
            "//div[@data-locator='chatbot-ai-container']//div[@aria-label='ai']//p[contains(text()"  # noqa
            + f",'{expected_str}')]",
            wait=25,
        )
        assert dom != False
