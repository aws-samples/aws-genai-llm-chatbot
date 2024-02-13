FROM python:3.9-alpine

RUN apk add zip

ADD requirements.txt .

RUN pip install -r requirements.txt -t /asset
ADD lambda.py /asset/lambda.py

#RUN mkdir -p /asset && cd src && zip -r /asset/lambda.zip .