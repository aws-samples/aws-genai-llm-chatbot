import boto3
from typing import Optional, List

comprehend = boto3.client("comprehend")

aws_to_pg = {
    # Afrikaans closely related to Dutch. Might not be accurate. Better than nothing.
    "af": "dutch",
    "ar": "arabic",
    "bn": "hindi",
    "cs": "czech",
    "da": "danish",
    "de": "german",
    "el": "greek",
    "en": "english",
    "es": "spanish",
    "fa": "persian",
    "fi": "finnish",
    "fr": "french",
    "he": "hebrew",
    "hi": "hindi",
    "hu": "hungarian",
    "id": "indonesian",
    "it": "italian",
    "nl": "dutch",
    "no": "norwegian",
    "pl": "polish",
    "pt": "portuguese",
    "ro": "romanian",
    "ru": "russian",
    "sv": "swedish",
    "tr": "turkish",
    "vi": "vietnamese",
    "zh": "chinese",
    "zh-TW": "chinese",
}


def comprehend_language_code_to_postgres(language_code: str) -> Optional[str]:
    return aws_to_pg.get(language_code, None)


def get_query_language(query: str, languages: List[str]):
    language_name = "english"
    comprehend_response = comprehend.detect_dominant_language(Text=query)
    comprehend_languages = comprehend_response["Languages"]
    detected_languages = [
        {"code": language["LanguageCode"], "score": language["Score"]}
        for language in comprehend_languages
    ]

    if len(comprehend_languages) > 0:
        postgres_language_name = comprehend_language_code_to_postgres(
            comprehend_languages[0]["LanguageCode"]
        )

        if postgres_language_name is not None and postgres_language_name in languages:
            language_name = postgres_language_name

    return [language_name, detected_languages]
