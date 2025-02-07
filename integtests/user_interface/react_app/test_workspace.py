from pages.login import LoginPage
from pages.layout import Layout
from pages.workspace import WorkspacePage
from pages.workspaces import WorkspacesPage
from pages.workspace_form import WorkspaceFormPage
from pages.dashboard import DashboardPage
from pages.semantic_search import SemanticSearchPage
import pytest


def test_workspace(selenium_driver, cognito_admin_credentials, client):
    rag_engines = client.list_rag_engines()
    engine = next(i for i in rag_engines if i.get("id") == "aurora")
    if engine.get("enabled") == False:
        pytest.skip("Aurora is not enabled.")

    # cleanup
    for workspace in client.list_workspaces():
        if (workspace.get("name") == "TEST_UI_AURORA") and workspace.get(
            "status"
        ) == "ready":
            client.delete_workspace(workspace.get("id"))

    login = LoginPage(selenium_driver)
    layout = Layout(selenium_driver)

    home_page = login.login(cognito_admin_credentials)
    assert home_page.is_visible() == True
    layout.expand_navigation()
    dashboard = DashboardPage(selenium_driver)
    workspaces = WorkspacesPage(selenium_driver)
    create_workspace = WorkspaceFormPage(selenium_driver)
    workspace = WorkspacePage(selenium_driver)
    layout.navigate_to("/rag/workspaces")
    workspaces.create()
    create_workspace.set_name("TEST_UI_AURORA")
    create_workspace.submit()
    assert workspace.is_status_creating() == True
    workspace.text_tab()
    workspace.add_text_content("title", "content")

    search = SemanticSearchPage(selenium_driver)
    layout.navigate_to("/rag/semantic-search")
    search.select_workspace("TEST_UI_AURORA")
    search.search("test")
    # We expect not result because the test did not wait for the document processing
    assert search.is_no_result_visible() == True

    layout.navigate_to("/rag")
    assert dashboard.is_loaded() == True
