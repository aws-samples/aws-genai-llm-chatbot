FROM public.ecr.aws/lambda/python:3.10

RUN yum update -y && yum install -y wget tar gzip \
    cairo cups-libs libSM libGLU dbus-glib \
    libXinerama.x86_64 java-1.8.0-openjdk-devel && \
    yum clean all

RUN wget -O - "http://download.documentfoundation.org/libreoffice/stable/7.5.3/rpm/x86_64/LibreOffice_7.5.3_Linux_x86-64_rpm.tar.gz" | tar -xvzf -

RUN yum localinstall -y LibreOffice_*/RPMS/*.rpm && \
    rm -rf LibreOffice_* 

ENV PATH="$PATH:/opt/libreoffice7.5/program"
ENV HOME=/tmp
ENV NLTK_DATA=/home/sbx_user1051/nltk_data

COPY requirements.txt ./
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Download required NLTK data for langchain text processing
RUN python -c "import nltk;nltk.download('punkt', download_dir='/home/sbx_user1051/nltk_data')"
RUN python -c "import nltk;nltk.download('averaged_perceptron_tagger', download_dir='/home/sbx_user1051/nltk_data')"

COPY . ./

RUN touch /tmp/test.txt \
    && cd /tmp \
    && soffice --headless --invisible --nodefault --view \
        --nolockcheck --nologo --norestore --convert-to pdf \
        --outdir /tmp /tmp/test.txt \
    && rm /tmp/test.*

CMD ["index.lambda_handler"]