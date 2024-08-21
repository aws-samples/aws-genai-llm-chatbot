from genai_core.documents import batch_crawl_websites


def test_batch_crawl_websites(mocker):
    mocker.patch(
        "genai_core.documents._get_batch_pending_posts",
        return_value={
            "Count": 1,
            "Items": [
                {
                    "workspace_id": {"S": "123"},
                    "document_id": {"S": "123"},
                    "crawler_properties": {
                        "M": {
                            "content_types": {"L": [{"S": "text/html"}, {"S": "pdf"}]},
                            "follow_links": {"BOOL": False},
                            "limit": {"N": "1"},
                        }
                    },
                    "path": {"S": "https://example"},
                    "rss_feed_id": {"S": "123"},
                }
            ],
        },
    )
    mock = mocker.patch("genai_core.documents.create_document")
    mocker.patch("genai_core.documents.set_status")
    mocker.patch("genai_core.documents.update_subscription_timestamp")
    batch_crawl_websites()

    mock.assert_called_once_with(
        "123",
        "website",
        path="https://example",
        crawler_properties={
            "follow_links": False,
            "limit": 1,
            "content_types": ["text/html", "pdf"],
        },
    )


def test_batch_crawl_websites_not_set(mocker):
    mocker.patch(
        "genai_core.documents._get_batch_pending_posts",
        return_value={
            "Count": 1,
            "Items": [
                {
                    "workspace_id": {"S": "123"},
                    "document_id": {"S": "123"},
                    "crawler_properties": {"M": {}},
                    "path": {"S": "https://example"},
                    "rss_feed_id": {"S": "123"},
                }
            ],
        },
    )
    mock = mocker.patch("genai_core.documents.create_document")
    mocker.patch("genai_core.documents.set_status")
    mocker.patch("genai_core.documents.update_subscription_timestamp")
    batch_crawl_websites()

    mock.assert_called_once_with(
        "123",
        "website",
        path="https://example",
        crawler_properties={
            "follow_links": True,
            "limit": 250,
            "content_types": ["text/html"],
        },
    )
