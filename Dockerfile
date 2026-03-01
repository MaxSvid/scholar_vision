# Stage 1: Building React frontend 
FROM node:20-alpine AS frontend-build

WORKDIR /frontend

COPY front-end/package.json front-end/package-lock.json ./
RUN npm ci

COPY front-end/ .
RUN npm run build


#  Stage 2: FastAPI — serves API + built frontend 
FROM python:3.13-slim

WORKDIR /app

RUN pip install uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

COPY . .

# Pull the built React files from stage 1
COPY --from=frontend-build /frontend/dist ./front-end/dist

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
