from pages.login import LoginPage
from pages.layout import Layout
from pages.models import ModelsPage


def test_models(selenium_driver, cognito_admin_credentials, default_model, client):
    login = LoginPage(selenium_driver)
    layout = Layout(selenium_driver)

    home_page = login.login(cognito_admin_credentials)
    assert home_page.is_visible() == True
    layout.expand_navigation()
    modelsPage = ModelsPage(selenium_driver)
    layout.navigate_to("/chatbot/models")
    modelsPage.find_model(default_model)

    # Check if sagemaker is enabled
    model_name = "mistralai/Mistral-7B-Instruct-v0.3"
    models = client.list_models()
    model = next((i for i in models if i.get("name") == model_name), None)
    if model is not None:
        modelsPage.find_model(model_name)
