FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Google Cloud Run sets PORT env var (default 8080)
ENV PORT=8080

# gunicorn binds to $PORT — NOT the if __name__ == '__main__': block
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app
