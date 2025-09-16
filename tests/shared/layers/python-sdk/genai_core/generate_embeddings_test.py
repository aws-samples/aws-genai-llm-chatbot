import unittest
from unittest.mock import patch, MagicMock
from genai_core.model_providers.direct.embeddings import (
    generate_embeddings,
    get_model_token_limit,
)
from genai_core.types import Provider, Task


class TestEmbeddings(unittest.TestCase):
    @patch("genai_core.model_providers.direct.embeddings._generate_embeddings_bedrock")
    def test_short_text_no_chunking(self, mock_bedrock):
        # Setup
        model = MagicMock()
        model.provider = Provider.BEDROCK.value
        model.name = "cohere.embed-english-v3"  # Use a string, not a MagicMock
        mock_bedrock.return_value = [[0.1, 0.2, 0.3]]

        # Test with text shorter than limit
        short_text = ["This is a short text"]
        result = generate_embeddings(model, short_text)

        # Verify no chunking occurred
        mock_bedrock.assert_called_once()
        self.assertEqual(len(mock_bedrock.call_args[0][1]), 1)
        self.assertEqual(result, [[0.1, 0.2, 0.3]])

    @patch("genai_core.model_providers.direct.embeddings._generate_embeddings_bedrock")
    def test_long_text_with_chunking(self, mock_bedrock):
        # Setup - Use a proper string for model.name instead of a MagicMock
        model = MagicMock()
        model.provider = Provider.BEDROCK.value
        model.name = "cohere.embed-english-v3"  # Use a string, not a MagicMock
        # Return different embeddings for different chunks
        mock_bedrock.return_value = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]

        # Create text longer than the limit
        token_limit = get_model_token_limit("cohere.embed-english-v3")
        char_limit = token_limit * 4
        long_text = ["A" * (char_limit + 1000)]

        result = generate_embeddings(model, long_text)

        # Verify chunking occurred
        self.assertEqual(len(mock_bedrock.call_args[0][1]), 2)
        # Verify embeddings were averaged
        expected = [0.25, 0.35, 0.45]  # Average of the two embeddings
        for i in range(len(expected)):
            self.assertAlmostEqual(result[0][i], expected[i])

    def test_get_model_token_limit(self):
        # Test known models
        self.assertEqual(get_model_token_limit("cohere.embed-english-v3"), 512)
        self.assertEqual(get_model_token_limit("amazon.titan-embed-text-v1"), 8000)

        # Test unknown model falls back to default
        self.assertEqual(get_model_token_limit("unknown-model"), 2500)

    @patch("genai_core.model_providers.direct.embeddings._generate_embeddings_bedrock")
    def test_error_handling(self, mock_bedrock):
        # Setup
        model = MagicMock()
        model.provider = Provider.BEDROCK.value
        model.name = "cohere.embed-english-v3"  # Use a string, not a MagicMock
        mock_bedrock.side_effect = Exception("API Error")

        # Test error handling
        with self.assertRaises(Exception):
            generate_embeddings(model, ["Test text"], Task.RETRIEVE)
