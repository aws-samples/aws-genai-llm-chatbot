from pydantic import Field


MAX_STR_INPUT_LENGTH = 1000000
SAFE_STR_REGEX = r"^[A-Za-z0-9-_. ]*$"
SAFE_HTTP_STR_REGEX = r"^[A-Za-z0-9-_.:/]*$"
ID_FIELD_VALIDATION = Field(min_length=1, max_length=100, pattern=SAFE_STR_REGEX)
SAFE_SHORT_STR_VALIDATION = Field(min_length=1, max_length=100, pattern=SAFE_STR_REGEX)
