import pytest
from gql.transport.exceptions import TransportQueryError


def test_unauthenticated(unauthenticated_client):
    match = "UnauthorizedException"
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.send_query("")
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.get_session("id")
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.list_sessions()
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.delete_session("id")
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.delete_user_sessions()
