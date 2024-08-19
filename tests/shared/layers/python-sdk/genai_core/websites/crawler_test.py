from genai_core.websites.crawler import parse_url


def test_parse_url(mocker):
    reponse = parse_url(
        "https://github.com/aws-samples/aws-genai-llm-chatbot/releases/tag/v.4.0.7",
        ["text/html"],
    )
    assert "Release v.4.0.7 " in reponse[0]
    assert "https://github.com/" in reponse[1]
    assert "https://docs.github.com/" in reponse[2]
