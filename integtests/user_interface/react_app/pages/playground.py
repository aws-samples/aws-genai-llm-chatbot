from pages.dom import DomOperator


class PlaygroundPage(object):
    def __init__(self, driver):
        self.driver = driver
        self.dom_operator = DomOperator(driver)

    def send_prompt(self, prompt, model):
        select = self.dom_operator.getByPath(
            "//div[@data-locator='select-model']", wait=5
        )
        select.click()

        option = self.dom_operator.getByPath(
            f"//span[contains(text(),'{model}')]", wait=15
        )
        option.click()

        textarea = self.dom_operator.getByPath(
            "//textarea[@data-locator='prompt-input']", wait=5
        )
        textarea.send_keys(prompt)

        textarea = self.dom_operator.getByPath(
            "//button[@data-locator='submit-prompt']", wait=5
        )
        textarea.click()

    def wait_for_reply(self, expected_str):
        self.dom_operator.getByPath(
            "//div[@data-locator='chatbot-ai-container']//p[contains(text()"
            + f",'{expected_str}')]",
            wait=25,
        )
