from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import json
import smtplib
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

# --- IMPORTACIONES DE BASE DE DATOS ---
from sqlalchemy import create_engine, Column, String, JSON, Integer
from sqlalchemy.orm import declarative_base, sessionmaker

app = FastAPI(title="Hospital Maria Auxiliadora API - Sincronizacion APS")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)
# Comprime cualquier respuesta mayor a 1KB (el paneo de /api/registros baja hasta ~7x)
app.add_middleware(GZipMiddleware, minimum_size=1000)

TABLAS_VALIDAS = [
    "viviendas", "hogares", "pacientes", "canalizaciones", "form_clinico",
    "form_psicosocial", "cartografias", "jornadas", "profesionales",
]

base_dir = os.path.dirname(os.path.abspath(__file__))

# ==========================================
# CONFIGURACIÓN SMTP (Variables de Entorno)
# ==========================================
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

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

class RegistroAPS(Base):
    __tablename__ = "registros_consolidados_aps"
    uid = Column(String, primary_key=True, index=True) 
    tabla_origen = Column(String, index=True) 
    datos = Column(JSON) 

Base.metadata.create_all(bind=engine)

# ==========================================
# MODELOS DE DATOS (PYDANTIC)
# ==========================================
class SyncPayload(BaseModel):
    viviendas: List[Dict[str, Any]] = []
    hogares: List[Dict[str, Any]] = []
    pacientes: List[Dict[str, Any]] = []
    canalizaciones: List[Dict[str, Any]] = []
    form_clinico: List[Dict[str, Any]] = []
    form_psicosocial: List[Dict[str, Any]] = []
    cartografias: List[Dict[str, Any]] = []
    jornadas: List[Dict[str, Any]] = []
    profesionales: List[Dict[str, Any]] = []

class AnexoModel(BaseModel):
    nombre: str
    datosBase64: str

class CanalizacionRequest(BaseModel):
    paciente_id: str
    nombre_paciente: str
    telefono1: str
    telefono2: Optional[str] = ""
    direccion: str
    microterritorio: str
    eps: str
    ips_primaria_hospital: str
    servicio_canalizado: str
    observaciones: str
    correos_destinatarios: List[str]
    anexos: Optional[List[AnexoModel]] = []
    nombre_gestor: str

# ==========================================
# 🚀 LÓGICA DE ENVÍO DE CORREOS INTELIGENTE
# ==========================================
def enviar_correo_background(data: CanalizacionRequest):
    if not SMTP_USER or not SMTP_PASSWORD:
        print("⚠️ Advertencia: No se han configurado SMTP_USER ni SMTP_PASSWORD. El correo no se enviará.")
        return

    try:
        # 1. EVALUAR SI EL PACIENTE ESTÁ SIN EPS (Para disparar la ruta de aseguramiento)
        eps_limpia = data.eps.strip().upper()
        sin_eps = eps_limpia in ["NO APLICA", "NINGUNA", "SIN EPS", "NO TIENE", "NO REGISTRADA", ""]

        # 2. INYECTAR CORREO DE ASEGURAMIENTO SI APLICA
        correo_aseguramiento = "areadeaseguramiento@mosquera-cundinamarca.gov.co"
        if sin_eps and correo_aseguramiento not in data.correos_destinatarios:
            data.correos_destinatarios.append(correo_aseguramiento)

        msg = MIMEMultipart()
        msg['From'] = SMTP_USER
        msg['To'] = ", ".join(data.correos_destinatarios)
        msg['Subject'] = f"ALERTA APS: {'Gestión de Aseguramiento' if sin_eps else 'Canalización'} - Paciente {data.nombre_paciente} ({data.paciente_id})"

        # 3. SELECCIÓN DE PLANTILLAS (3 RUTAS DISTINTAS)
        if sin_eps:
            # 🟣 PLANTILLA 1: ÁREA DE ASEGURAMIENTO (Ciudadano sin EPS)
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #7e22ce; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">🛡️ Área de Aseguramiento - APS</h2>
                    <p style="margin: 5px 0 0 0; font-size: 0.9rem;">Alerta: Ciudadano sin cobertura de EPS identificada</p>
                </div>
                <div style="padding: 20px; background-color: #f8fafc; color: #1e293b;">
                    <p>Estimado equipo de <strong>Aseguramiento</strong>,</p>
                    <p>El equipo territorial de Atención Primaria en Salud (APS) ha identificado a un ciudadano en el municipio que actualmente no cuenta con afiliación activa a una EPS, requiriendo gestión urgente para su cobertura:</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background: white;">
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1; width: 35%;"><strong>Ciudadano:</strong></td><td style="padding: 8px; border: 1px solid #cbd5e1;">{data.nombre_paciente}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>Documento:</strong></td><td style="padding: 8px; border: 1px solid #cbd5e1;">{data.paciente_id}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>Contacto:</strong></td><td style="padding: 8px; border: 1px solid #cbd5e1;">{data.telefono1} / {data.telefono2}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>Ubicación:</strong></td><td style="padding: 8px; border: 1px solid #cbd5e1;">{data.direccion} ({data.microterritorio})</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>Estado actual EPS:</strong></td><td style="padding: 8px; border: 1px solid #cbd5e1; color: #b91c1c; font-weight: bold;">{data.eps}</td></tr>
                    </table>
                    <p><strong>Observaciones y necesidades detectadas en campo:</strong></p>
                    <blockquote style="background: #fff; border-left: 4px solid #7e22ce; padding: 10px; margin: 0 0 15px 0; color: #334155;">{data.observaciones}</blockquote>
                    <p style="font-size: 0.85rem; color: #64748b;">Gestor responsable: {data.nombre_gestor}</p>
                </div>
            </div>
            """
        elif data.ips_primaria_hospital == "Sí":
            # 🔵 PLANTILLA 2: HOSPITAL MARÍA AUXILIADORA
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #1e3a8a; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">🏥 Programa APS - Mosquera</h2>
                    <p style="margin: 5px 0 0 0; font-size: 0.9rem;">Notificación de Canalización Interna - E.S.E. María Auxiliadora</p>
                </div>
                <div style="padding: 20px; background-color: #f8fafc; color: #1e293b;">
                    <p>Estimado equipo de <strong>Consulta Externa / IPS Primaria</strong>,</p>
                    <p>El equipo territorial de Atención Primaria en Salud (APS) ha identificado y canalizado al siguiente ciudadano para su respectiva atención prioritaria:</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background: white;">
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1; width: 35%;"><strong>Paciente:</strong></td><td style="padding: 8px; border: 1px solid #cbd5e1;">{data.nombre_paciente}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>Documento:</strong></td><td style="padding: 8px; border: 1px solid #cbd5e1;">{data.paciente_id}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>Teléfonos:</strong></td><td style="padding: 8px; border: 1px solid #cbd5e1;">{data.telefono1} / {data.telefono2}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>Dirección:</strong></td><td style="padding: 8px; border: 1px solid #cbd5e1;">{data.direccion} ({data.microterritorio})</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>Servicio:</strong></td><td style="padding: 8px; border: 1px solid #cbd5e1; color: #16a34a; font-weight: bold;">{data.servicio_canalizado}</td></tr>
                    </table>
                    <p><strong>Observaciones del Gestor:</strong></p>
                    <blockquote style="background: #fff; border-left: 4px solid #1e3a8a; padding: 10px; margin: 0 0 15px 0; color: #334155;">{data.observaciones}</blockquote>
                    <p style="font-size: 0.85rem; color: #64748b;">Gestor responsable: {data.nombre_gestor}</p>
                </div>
            </div>
            """
        else:
            # 🟢 PLANTILLA 3: GESTIÓN DE EPS (Sanitas, Compensar, etc.)
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #0369a1; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">📋 Gestión de Red y Aseguramiento - APS</h2>
                    <p style="margin: 5px 0 0 0; font-size: 0.9rem;">Solicitud de Ruta / Autorización - EPS {data.eps}</p>
                </div>
                <div style="padding: 20px; background-color: #f8fafc; color: #1e293b;">
                    <p>Estimado(a) Asesor(a) de la EPS <strong>{data.eps}</strong>,</p>
                    <p>El programa APS reporta la necesidad de gestión de servicios de salud para el afiliado:</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background: white;">
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1; width: 35%;"><strong>Afiliado:</strong></td><td style="padding: 8px; border: 1px solid #cbd5e1;">{data.nombre_paciente}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>Identificación:</strong></td><td style="padding: 8px; border: 1px solid #cbd5e1;">{data.paciente_id}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>Contacto:</strong></td><td style="padding: 8px; border: 1px solid #cbd5e1;">{data.telefono1} / {data.telefono2}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>Ubicación:</strong></td><td style="padding: 8px; border: 1px solid #cbd5e1;">{data.direccion} ({data.microterritorio})</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>Servicio Solicitado:</strong></td><td style="padding: 8px; border: 1px solid #cbd5e1; color: #0284c7; font-weight: bold;">{data.servicio_canalizado}</td></tr>
                    </table>
                    <p><strong>Detalle del Caso:</strong></p>
                    <blockquote style="background: #fff; border-left: 4px solid #0369a1; padding: 10px; margin: 0 0 15px 0; color: #334155;">{data.observaciones}</blockquote>
                    <p style="font-size: 0.85rem; color: #64748b;">Se adjuntan soportes clínicos correspondientes.</p>
                </div>
            </div>
            """

        msg.attach(MIMEText(html_content, 'html'))

        # Adjuntar archivos
        for anexo in data.anexos:
            try:
                header, encoded = anexo.datosBase64.split(",", 1)
                file_data = base64.b64decode(encoded)
                p = MIMEBase('application', 'octet-stream')
                p.set_payload(file_data)
                encoders.encode_base64(p)
                p.add_header('Content-Disposition', f"attachment; filename= {anexo.nombre}")
                msg.attach(p)
            except Exception as ex:
                print(f"Error adjuntando archivo {anexo.nombre}: {ex}")

        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, data.correos_destinatarios, msg.as_string())
        print(f"✅ Correo SMTP enviado con éxito para {data.nombre_paciente}.")
    except Exception as e:
        print(f"❌ Error crítico enviando correo SMTP: {e}")

# ==========================================
# ENDPOINT: ENVIAR CORREO DE CANALIZACIÓN
# ==========================================
@app.post("/api/enviar-canalizacion")
def endpoint_canalizar(payload: CanalizacionRequest, background_tasks: BackgroundTasks):
    if not payload.correos_destinatarios:
        raise HTTPException(status_code=400, detail="No hay correos destinatarios configurados.")
    
    background_tasks.add_task(enviar_correo_background, payload)
    return {"status": "success", "message": "Canalización en proceso y correo en cola de envío."}

# ==========================================
# ENDPOINT DE SINCRONIZACIÓN INTELIGENTE
# ==========================================
@app.post("/api/sync")
def sincronizar_datos(payload: SyncPayload):
    try:
        db = SessionLocal()
        agregados = 0
        actualizados = 0
        
        tablas_recibidas = payload.dict()
        
        for nombre_tabla, lista_registros in tablas_recibidas.items():
            for registro in lista_registros:
                registro_id = str(registro.get('id') or registro.get('numero_documento') or registro.get('id_atencion') or registro.get('id_intervencion'))
                uid_compuesto = f"{nombre_tabla}_{registro_id}"
                existe = db.query(RegistroAPS).filter(RegistroAPS.uid == uid_compuesto).first()
                
                if not existe:
                    nuevo_registro = RegistroAPS(uid=uid_compuesto, tabla_origen=nombre_tabla, datos=registro)
                    db.add(nuevo_registro)
                    agregados += 1
                else:
                    existe.datos = registro
                    actualizados += 1
                    
        db.commit()
        db.close()
        return {"status": "ok", "agregados": agregados, "actualizados": actualizados}
    except Exception as e:
        return {"status": "error", "detalle": str(e)}

# ==========================================
# ENDPOINT: LECTURA GLOBAL / FRACCIONADA PARA PANELES
# ==========================================
@app.get("/api/registros")
def obtener_registros_nube(
    tabla: Optional[str] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=5000),
    offset: int = Query(0, ge=0),
):
    """
    Sin parámetro 'tabla': comportamiento original (descarga todo consolidado).
    Con 'tabla': descarga solo esa tabla.
    Con 'tabla' + 'limit'/'offset': descarga paginada de esa tabla (para que
    el frontend baje en lotes, ej. de 1000, y no cargue todo en memoria de golpe).
    """
    try:
        db = SessionLocal()

        if tabla:
            if tabla not in TABLAS_VALIDAS:
                db.close()
                raise HTTPException(status_code=400, detail=f"Tabla '{tabla}' no válida")
            query = (
                db.query(RegistroAPS)
                .filter(RegistroAPS.tabla_origen == tabla)
                .order_by(RegistroAPS.uid)  # orden estable, imprescindible para paginar
            )
            if limit is not None:
                query = query.offset(offset).limit(limit)
            registros = query.all()
            datos = [r.datos for r in registros]
            db.close()
            return {"status": "ok", "data": {tabla: datos}}

        registros = db.query(RegistroAPS).all()
        datos_consolidados = {t: [] for t in TABLAS_VALIDAS}

        for r in registros:
            if r.tabla_origen in datos_consolidados:
                datos_consolidados[r.tabla_origen].append(r.datos)

        db.close()
        return {"status": "ok", "data": datos_consolidados}
    except HTTPException:
        raise
    except Exception as e:
        return {"status": "error", "detalle": str(e)}

@app.get("/api/health")
def health_check(): 
    return {"status": "ok"}

# ==========================================
# SERVIR FRONTEND
# ==========================================
frontend_dist_path = os.path.normpath(os.path.join(base_dir, "../frontend/dist"))
if os.path.exists(frontend_dist_path):
    app.mount("/", StaticFiles(directory=frontend_dist_path, html=True), name="static")