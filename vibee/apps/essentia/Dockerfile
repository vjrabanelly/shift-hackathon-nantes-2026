FROM mcr.microsoft.com/playwright/python:v1.44.0-jammy

WORKDIR /app

COPY apps/essentia/requirements.txt ./requirements.txt

RUN pip install --no-cache-dir -r requirements.txt

COPY apps/essentia/main.py apps/essentia/analyzer.py ./

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
