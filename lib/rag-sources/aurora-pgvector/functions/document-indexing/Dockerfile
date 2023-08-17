FROM public.ecr.aws/lambda/python:3.11-arm64

RUN yum update -y 
RUN yum install -y git wget
RUN yum install -y gcc rustc rustup cargo libxml2-devel libxslt-devel \
    libmagic-dev poppler-utils tesseract-ocr libreoffice pandoc

COPY requirements.txt ./
COPY *.py ./

RUN pip install --upgrade pip
RUN pip install -r requirements.txt --upgrade

RUN python -c "import nltk;nltk.download('punkt', download_dir='/home/sbx_user1051/nltk_data')"
RUN python -c "import nltk;nltk.download('averaged_perceptron_tagger', download_dir='/home/sbx_user1051/nltk_data')"

CMD ["index.lambda_handler"]