# ETAPA 1: Construcción del Frontend
# CAMBIO: Usamos Node 20 (Alpine) que es lo que exige Vite ahora
FROM node:20-alpine AS build-frontend

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# ETAPA 2: Construcción del Backend y Unificación
FROM python:3.9-slim

WORKDIR /app

# Instalar dependencias de Python
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código del backend
COPY backend/ ./backend/

# Copiar el build del frontend desde la Etapa 1
COPY --from=build-frontend /app/frontend/dist ./frontend/dist

# Exponer el puerto 5000
EXPOSE 5001

# Comando para correr la app
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "5001"]