from aws_lambda_powertools import Tracer
from aws_lambda_powertools.event_handler import BedrockAgentResolver
from aws_lambda_powertools.event_handler.openapi.params import Query
from pydantic import BaseModel
from typing import List
import boto3
import os
import requests
from typing import Annotated
import pandas as pd
import datetime

tracer = Tracer()


class Weather(BaseModel):
    time: str
    temperature: str
    precipitation: str


class Period(BaseModel):
    start_date: str
    end_date: str


app = BedrockAgentResolver()


def get_metric_and_unit(w: dict, name: str) -> str:
    return f"{w['current'][name]} {w['current_units'][name]}"


@app.get("/current_weather", description="get the current weather for a given place")
def get_current_weather(
    place: Annotated[str, Query(description="the name of the place")]
) -> Weather:
    resp = loc_client.search_place_index_for_text(
        IndexName=os.environ.get(
            "LOCATION_INDEX", os.environ.get("PLACE_INDEX", "Test")
        ),
        Text=place,
    )
    [lon, lat] = resp["Results"][0]["Place"]["Geometry"]["Point"]
    q = (
        "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
        + "&current=temperature_2m,precipitation"
    )
    w = requests.get(q.format(lat=lat, lon=lon)).json()

    return Weather(
        time=w["current"]["time"],
        temperature=get_metric_and_unit(w, "temperature_2m"),
        precipitation=get_metric_and_unit(w, "precipitation"),
    )


@app.get(
    "/absolute_period_dates",
    description="get the absolute start and end date for a period in YYYY-MM-DD"
    + " format given the number of day difference from the today",
)
def get_absolute_period_dates(
    startPeriodDeltaDays: Annotated[
        int,
        Query(
            description="the difference in days from the today"
            + " to the start date of the period"
        ),
    ],
    endPeriodDeltaDays: Annotated[
        int,
        Query(
            description="the difference in days from the today"
            + " to the end date of the period"
        ),
    ],
) -> Period:
    today = datetime.date.today()
    p = Period()
    p.start_date = (today - datetime.timedelta(startPeriodDeltaDays)).isoformat()
    p.end_date = (today - datetime.timedelta(endPeriodDeltaDays)).isoformat()
    return p


@app.get(
    "/historical_weather",
    description="get the historical daily mean temperature and precipitation"
    + " for a given place for a range of dates",
)
def get_historical_weather(
    place: Annotated[str, Query(description="the name of the place")],
    fromDate: Annotated[str, Query(description="starting date in YYYY-MM-DD format")],
    toDate: Annotated[str, Query(description="ending date in YYYY-MM-DD format")],
) -> List[Weather]:
    resp = loc_client.search_place_index_for_text(
        IndexName=os.environ.get(
            "LOCATION_INDEX", os.environ.get("PLACE_INDEX", "Test")
        ),
        Text=place,
    )
    [lon, lat] = resp["Results"][0]["Place"]["Geometry"]["Point"]
    q = (
        "https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}"
        + "&start_date={fromDate}&end_date={toDate}&hourly=temperature_2m,precipitation"
    )
    resp = requests.get(
        q.format(lat=lat, lon=lon, fromDate=fromDate, toDate=toDate)
    ).json()
    hourly_values = pd.DataFrame(resp["hourly"])
    hourly_values["time"] = pd.to_datetime(hourly_values["time"])
    hourly_values = hourly_values.set_index("time")
    hourly_values = hourly_values.resample("D").agg(
        {"temperature_2m": "mean", "precipitation": "sum"}
    )
    return [
        Weather(
            time=str(hourly_values.iloc[i].name).split(" ")[0],
            temperature=hourly_values.iloc[i][0],
            precipitation=hourly_values.iloc[i][1],
        )
        for i in range(hourly_values.shape[0])
    ]


def handler(event, context):
    print(event)
    resp = app.resolve(event, context)
    print(resp)
    return resp


if __name__ == "__main__":
    with open("schema.json", "w") as f:
        f.write(app.get_openapi_json_schema())
else:
    sess = boto3.Session(
        region_name=os.environ.get("LOCATION_AWS_REGION", os.environ.get("AWS_REGION"))
    )
    loc_client = sess.client("location")
