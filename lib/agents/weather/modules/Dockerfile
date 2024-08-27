FROM python:3.12-slim

RUN apt update -y && apt install zip -y

ADD requirements.txt .

RUN mkdir -p /asset/python && pip install -r requirements.txt -t /asset/python
