FROM quay.io/unstructured-io/unstructured:0.10.15

COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt 

ADD main.py /app/main.py
WORKDIR /app

CMD ["python3", "main.py"]