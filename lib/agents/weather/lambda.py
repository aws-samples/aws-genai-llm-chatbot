from aws_lambda_powertools import Tracer
from aws_lambda_powertools.event_handler import BedrockAgentResolver
from aws_lambda_powertools.event_handler.openapi.params import Query
from pydantic import BaseModel
import boto3
import os
import requests
from typing import Annotated


tracer = Tracer()

class Weather(BaseModel):
    time: str
    temperature: str
    precipitation: str



app = BedrockAgentResolver()

def get_metric_and_unit(w: dict, name: str)->str:
    return f"{w['current'][name]} {w['current_units'][name]}"

@app.get("/current_weather", description="get the current weather for a given place")
def get_current_weather(place: Annotated[str, Query(description="the name of the place")]) -> Weather:
    resp = loc_client.search_place_index_for_text(IndexName=os.environ.get("LOCATION_INDEX", "Test"), Text=place)
    [lon, lat] = resp["Results"][0]["Place"]["Geometry"]["Point"]
    q = "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,precipitation"
    w = requests.get(q.format(lat=lat, lon=lon)).json()

    return Weather(time=w["current"]["time"], 
                   temperature=get_metric_and_unit(w, "temperature_2m"), 
                   precipitation=get_metric_and_unit(w, "precipitation"),
    )


def handler(event, context):
    print(event)
    resp = app.resolve(event, context)
    print(resp)
    return resp


if __name__ == "__main__":
    with open("schema.json", "w") as f:
        f.write(app.get_openapi_json_schema())
else:
    sess = boto3.Session(region_name=os.environ.get("LOCATION_AWS_REGION", os.environ.get("AWS_REGION")))
    loc_client = sess.client("location")
