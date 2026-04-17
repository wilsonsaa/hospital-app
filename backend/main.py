from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import json

# --- IMPORTACIONES DE BASE DE DATOS ---
from sqlalchemy import create_engine, Column, String, JSON, Integer
from sqlalchemy.orm import declarative_base, sessionmaker

app = FastAPI(title="Hospital Maria Auxiliadora API - Sincronizacion APS")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

base_dir = os.path.dirname(os.path.abspath(__file__))

# ==========================================
# CONFIGURACIÓN DE BASE DE DATOS
# ==========================================
db_folder = os.path.join(base_dir, 'db_data')
os.makedirs(db_folder, exist_ok=True)
db_path = os.path.join(db_folder, 'hospital_datos.db')
SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_path}"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# NUEVO MODELO UNIVERSAL: Guarda cualquier tabla que mande Dexie
class RegistroAPS(Base):
    __tablename__ = "registros_consolidados_aps"
    uid = Column(String, primary_key=True, index=True) # Identificador único compuesto
    tabla_origen = Column(String, index=True) # 'viviendas', 'pacientes', etc.
    datos = Column(JSON) # El JSON completo del frontend

Base.metadata.create_all(bind=engine)

# ==========================================
# MODELOS DE DATOS (PYDANTIC) PARA RECIBIR
# ==========================================
class SyncPayload(BaseModel):
    viviendas: List[Dict[str, Any]] = []
    hogares: List[Dict[str, Any]] = []
    pacientes: List[Dict[str, Any]] = []
    canalizaciones: List[Dict[str, Any]] = []
    form_clinico: List[Dict[str, Any]] = []
    form_psicosocial: List[Dict[str, Any]] = []

# ==========================================
# ENDPOINT DE SINCRONIZACIÓN INTELIGENTE
# ==========================================
@app.post("/api/sync")
def sincronizar_datos(payload: SyncPayload):
    try:
        db = SessionLocal()
        agregados = 0
        actualizados = 0
        
        # Convertimos el payload en un diccionario iterable
        tablas_recibidas = payload.dict()
        
        for nombre_tabla, lista_registros in tablas_recibidas.items():
            for registro in lista_registros:
                # Buscar el ID real del registro (puede llamarse 'id', 'numero_documento', 'id_atencion'...)
                registro_id = str(registro.get('id') or registro.get('numero_documento') or registro.get('id_atencion') or registro.get('id_intervencion'))
                
                # Creamos un UID único para SQLite: "pacientes_102030" o "hogares_uuid123"
                uid_compuesto = f"{nombre_tabla}_{registro_id}"
                
                existe = db.query(RegistroAPS).filter(RegistroAPS.uid == uid_compuesto).first()
                
                if not existe:
                    nuevo_registro = RegistroAPS(uid=uid_compuesto, tabla_origen=nombre_tabla, datos=registro)
                    db.add(nuevo_registro)
                    agregados += 1
                else:
                    # Si ya existe, lo actualizamos (Ej: el médico atendió la canalización)
                    existe.datos = registro
                    actualizados += 1
                    
        db.commit()
        db.close()
        return {"status": "ok", "agregados": agregados, "actualizados": actualizados}
    except Exception as e:
        return {"status": "error", "detalle": str(e)}
# ==========================================
# ENDPOINT: LECTURA GLOBAL PARA PANELES
# ==========================================
@app.get("/api/registros")
def obtener_registros_nube():
    try:
        db = SessionLocal()
        registros = db.query(RegistroAPS).all()
        
        # Agrupamos los datos por tabla
        datos_consolidados = {
            "viviendas": [], "hogares": [], "pacientes": [], 
            "canalizaciones": [], "form_clinico": [], 
            "form_psicosocial": [], "cartografias": []
        }
        
        for r in registros:
            if r.tabla_origen in datos_consolidados:
                datos_consolidados[r.tabla_origen].append(r.datos)
                
        db.close()
        return {"status": "ok", "data": datos_consolidados}
    except Exception as e:
        return {"status": "error", "detalle": str(e)}
# ==========================================
# SERVIR FRONTEND
# ==========================================
frontend_dist_path = os.path.normpath(os.path.join(base_dir, "../frontend/dist"))
if os.path.exists(frontend_dist_path):
    app.mount("/", StaticFiles(directory=frontend_dist_path, html=True), name="static")

@app.get("/api/health")
def health_check(): return {"status": "ok"}