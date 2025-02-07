from pages.login import LoginPage
from pages.layout import Layout
from pages.embeddings import EmbeddingsPage


def test_embedding(selenium_driver, cognito_admin_credentials, default_embed_model):

    login = LoginPage(selenium_driver)
    layout = Layout(selenium_driver)

    home_page = login.login(cognito_admin_credentials)
    assert home_page.is_visible() == True
    layout.expand_navigation()
    page = EmbeddingsPage(selenium_driver)
    layout.navigate_to("/rag/embeddings")
    page.select_model(default_embed_model)
    page.add_input()
    page.add_input()
    page.set_input(0, "France")
    page.set_input(1, "Paris")
    page.set_input(2, "Italy")
    page.submit()
    assert page.are_results_visble() == True
