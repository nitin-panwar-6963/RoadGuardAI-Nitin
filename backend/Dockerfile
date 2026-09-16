FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y git && \
    rm -rf /var/lib/apt/lists/*

#copy all code from local
COPY requirements.txt .

#some 
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0

#update package manager
RUN pip install --no-cache-dir --upgrade pip

#download all depency
RUN pip install --no-cache-dir -r requirements.txt

#copy all code form loacl
COPY . .

# exopse port of backend
EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--timeout", "600", "--access-logfile", "-", "--error-logfile", "-", "main:app"]
