from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import json

# --- IMPORTACIONES DE BASE DE DATOS ---
from sqlalchemy import create_engine, Column, String, JSON
from sqlalchemy.orm import declarative_base, sessionmaker

app = FastAPI(title="Hospital Maria Auxiliadora API")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

base_dir = os.path.dirname(os.path.abspath(__file__))

# ==========================================
# CONFIGURACIÓN DE BASE DE DATOS BLINDADA
# ==========================================
# Creamos la carpeta db_data asegurando rutas absolutas
db_folder = os.path.join(base_dir, 'db_data')
os.makedirs(db_folder, exist_ok=True)

# Ruta absoluta al archivo SQLite
db_path = os.path.join(db_folder, 'hospital_datos.db')
SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_path}"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class VisitaDB(Base):
    __tablename__ = "visitas_campo"
    uuid = Column(String, primary_key=True, index=True)
    modulo = Column(String)
    paciente = Column(String)
    fecha_registro = Column(String)
    datos_completos = Column(JSON) 

# Creamos las tablas
Base.metadata.create_all(bind=engine)

# ==========================================
# RUTAS DEL API
# ==========================================
@app.get("/api/health")
def health_check():
    return {"status": "ok", "db_path": db_path}

@app.get("/api/forms/{modulo_id}")
def get_form_structure(modulo_id: str):
    json_path = os.path.join(base_dir, "data", f"{modulo_id}_schema.json")
    try:
        with open(json_path, "r", encoding="utf-8") as f: return json.load(f)
    except FileNotFoundError:
        return {"error": True, "mensaje": f"El formulario {modulo_id} aún no está creado en el servidor."}

# --- MODELOS DE DATOS ---
class VisitaSync(BaseModel):
    id: Optional[int] = None # Tolerancia para el ID de Dexie
    uuid: str
    modulo: str
    paciente: str
    fecha: str
    datos: Dict[str, Any]
    sincronizado: Optional[int] = 0

class SyncPayload(BaseModel):
    visitas: List[VisitaSync]

# --- ENDPOINT DE SINCRONIZACIÓN ---
@app.post("/api/sync")
def sincronizar_datos(payload: SyncPayload):
    try:
        db = SessionLocal()
        agregados = 0
        duplicados = 0
        
        for v in payload.visitas:
            existe = db.query(VisitaDB).filter(VisitaDB.uuid == v.uuid).first()
            if not existe:
                nueva_visita = VisitaDB(
                    uuid=v.uuid, modulo=v.modulo, paciente=v.paciente,
                    fecha_registro=v.fecha, datos_completos=v.datos
                )
                db.add(nueva_visita)
                agregados += 1
            else:
                duplicados += 1
                
        db.commit()
        db.close()
        return {"status": "ok", "agregados": agregados, "duplicados_ignorados": duplicados}
    except Exception as e:
        # Esto evitará que la app se caiga en silencio y nos dirá exactamente qué falló
        return {"status": "error", "detalle": str(e)}

# ==========================================
# SERVIR FRONTEND
# ==========================================
frontend_dist_path = os.path.normpath(os.path.join(base_dir, "../frontend/dist"))
if os.path.exists(frontend_dist_path):
    app.mount("/", StaticFiles(directory=frontend_dist_path, html=True), name="static")