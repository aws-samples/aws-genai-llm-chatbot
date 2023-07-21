FROM public.ecr.aws/lambda/python:3.10

COPY requirements.txt ./
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

COPY . ./

CMD ["index.lambda_handler"]