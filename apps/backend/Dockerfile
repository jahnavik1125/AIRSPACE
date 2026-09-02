FROM python:3.10-slim

WORKDIR /workspace

# Install system dependencies needed for compiling psycopg2 and image processing (OpenCV dependencies)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy local packages first to enable monorepo installs
COPY packages/cv /workspace/packages/cv
COPY packages/ai /workspace/packages/ai

# Copy backend requirements and app files
COPY apps/backend/requirements.txt /workspace/apps/backend/requirements.txt
RUN pip install --no-cache-dir -r /workspace/apps/backend/requirements.txt

COPY apps/backend /workspace/apps/backend

WORKDIR /workspace/apps/backend

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
