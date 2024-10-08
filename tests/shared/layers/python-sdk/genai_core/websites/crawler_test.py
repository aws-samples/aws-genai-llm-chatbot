from genai_core.websites.crawler import parse_url


def test_parse_url(mocker):
    reponse = parse_url(
        "https://github.com/aws-samples/aws-genai-llm-chatbot/releases/tag/v.4.0.7",
        ["text/html"],
    )
    assert "Release v.4.0.7 " in reponse[0]
    assert len(reponse[1]) > 0  # Found urls from the same domain
    assert len(reponse[2]) > 0  # Found urls from a differnt domain
