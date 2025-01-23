from pages.login import LoginPage
from pages.layout import Layout
from pages.applications import ApplicationsPage
from pages.playground import PlaygroundPage
from pages.application_form import ApplicationForm
import time


def test_application(
    selenium_driver,
    cognito_admin_credentials,
    cognito_user_credentials,
    default_model,
    client,
):
    # cleanup
    for application in client.list_applications():
        if application.get("name") == "TEST_UI_APP":
            client.delete_application(application.get("id"))

    login = LoginPage(selenium_driver)
    layout = Layout(selenium_driver)

    home_page = login.login(cognito_admin_credentials)
    assert home_page.is_visible() == True
    layout.expand_navigation()
    applications = ApplicationsPage(selenium_driver)
    form = ApplicationForm(selenium_driver)
    application = PlaygroundPage(selenium_driver)
    home_url = selenium_driver.current_url
    layout.navigate_to("/admin/applications")
    applications.create()
    form.set_name("TEST_UI_APP")
    form.select_model(default_model)
    form.select_role("user")
    form.submit()

    # Now open the application
    applications.open("TEST_UI_APP")
    assert application.is_model_select_visible() == False
    application.send_prompt('repeat "STRING_DETECT_TEST"')
    application.wait_for_reply("STRING_DETECT_TEST")

    # do the same but as a user
    application_url = selenium_driver.current_url
    selenium_driver.get(home_url)
    time.sleep(5)
    layout.logout()
    time.sleep(5)
    login.login(cognito_user_credentials)
    time.sleep(5)
    selenium_driver.get(application_url)
    time.sleep(5)
    application.send_prompt('repeat "STRING_DETECT_TEST"')
    application.wait_for_reply("STRING_DETECT_TEST")
