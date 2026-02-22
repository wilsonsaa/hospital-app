import { useState, useEffect } from 'react'
import { db } from './db'
import { useLiveQuery } from 'dexie-react-hooks'
import { territoriosData } from './territoriosData'
import { MapContainer, TileLayer, Marker, useMapEvents, Popup, GeoJSON, useMap } from 'react-leaflet'
import { mapasTerritorios, mapasMicroterritorios } from './mapasData'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import './App.css'

// ================= ICONOS Y MAPAS =================
const HospitalIcon = L.divIcon({
  className: 'custom-hospital-icon',
  html: `<div style="background-color: white; border-radius: 50%; border: 3px solid var(--inst-blue); width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.4);"><img src="/logo-hospital.jpg" style="width: 100%; height: auto; object-fit: contain;" /></div>`,
  iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -35]
});
const UserLocIcon = L.divIcon({
  className: 'user-loc-icon',
  html: `<div style="background-color: #2563eb; border: 3px solid white; border-radius: 50%; width: 18px; height: 18px; box-shadow: 0 0 10px rgba(0,0,0,0.6);"></div>`,
  iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -9]
});

const normalizarNombre = (str) => str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : "";

function AutoControlMapa({ poligono, ubicacionActual }) {
  const map = useMap();
  useEffect(() => {
    if (poligono) {
      const bounds = L.geoJSON(poligono).getBounds();
      if (bounds.isValid()) map.flyToBounds(bounds, { padding: [20, 20], duration: 1.5 });
    } else if (ubicacionActual) {
      map.flyTo(ubicacionActual, 16, { duration: 1.5 });
    } else {
      map.locate({ setView: true, maxZoom: 15, enableHighAccuracy: true });
      map.once('locationerror', () => map.flyTo([4.7059, -74.2302], 13));
    }
  }, [poligono, ubicacionActual, map]);
  return null;
}

function FixMapResize({ isFullscreen }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [isFullscreen, map]);
  return null;
}

function MapaSoloVisual({ nombreTerritorio }) {
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const poligonoTerritorio = mapasTerritorios?.features?.find((f) => normalizarNombre(f.properties.Name) === normalizarNombre(nombreTerritorio));
  const wrapperStyle = pantallaCompleta
    ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, backgroundColor: '#000' }
    : { position: 'relative', width: '100%', height: '250px', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--inst-blue)', marginBottom: '10px' };

  return (
    <>
      <div style={wrapperStyle}>
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000 }}>
          <button type="button" onClick={() => setPantallaCompleta(!pantallaCompleta)} style={{ backgroundColor: 'var(--inst-green)', color: 'white', border: '2px solid white', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontWeight: 'bold' }}>
            {pantallaCompleta ? '↙️ Minimizar' : '🔲 Pantalla Completa'}
          </button>
        </div>
        <MapContainer center={[4.7059, -74.2302]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google" />
          <FixMapResize isFullscreen={pantallaCompleta} />
          <AutoControlMapa poligono={poligonoTerritorio} />
          {poligonoTerritorio && <GeoJSON key={`terr-${nombreTerritorio}`} data={poligonoTerritorio} style={{ color: '#00f3ff', weight: 3, fillColor: '#00f3ff', fillOpacity: 0.2 }} />}
        </MapContainer>
      </div>
      {!pantallaCompleta && <div style={{ textAlign: 'center', backgroundColor: 'var(--inst-blue)', color: 'white', padding: '5px', fontSize: '0.9rem', fontWeight: 'bold', borderRadius: '8px', marginBottom: '20px' }}>🗺️ ZONA SELECCIONADA: {nombreTerritorio?.toUpperCase()}</div>}
    </>
  )
}

function MapaRiesgosMultiples({ value, onChange, formData }) {
  const [marcadores, setMarcadores] = useState(value ? JSON.parse(value) : [])
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const [ubicacionActual, setUbicacionActual] = useState(null)

  const nombreMicroterritorio = formData?.microterritorio;
  const poligonoMicroterritorio = mapasMicroterritorios?.features?.find((f) => normalizarNombre(f.properties.Name) === normalizarNombre(nombreMicroterritorio));

  const crearPinEnriquecido = (lat, lng, nombreRiesgo) => ({
    id: Date.now(), lat, lng, nombre: nombreRiesgo,
    territorio: formData?.territorio || 'No asignado', microterritorio: formData?.microterritorio || 'No asignado',
    barrio: formData?.barrio_territorio || 'No asignado', fecha_captura: new Date().toISOString()
  });

  const MapClick = () => {
    useMapEvents({
      click(e) {
        if (!formData?.microterritorio) return alert("Seleccione Territorio y Microterritorio antes de mapear.");
        const nombreRiesgo = window.prompt("🚩 Ingrese la categoría del riesgo en este punto:");
        if (nombreRiesgo) {
          const nuevosMarcadores = [...marcadores, crearPinEnriquecido(e.latlng.lat, e.latlng.lng, nombreRiesgo)];
          setMarcadores(nuevosMarcadores); onChange(JSON.stringify(nuevosMarcadores));
        }
      },
    })
    return null
  }

  const ubicarMiPosicion = () => {
    if (!navigator.geolocation) return alert("Su dispositivo no soporta GPS.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setUbicacionActual([pos.coords.latitude, pos.coords.longitude]),
      () => alert("Active el GPS de su tablet y otorgue permisos."), { enableHighAccuracy: true }
    );
  }

  const moverMarcador = (id, lat, lng) => {
    const actualizados = marcadores.map(m => m.id === id ? { ...m, lat, lng, fecha_actualizacion: new Date().toISOString() } : m);
    setMarcadores(actualizados); onChange(JSON.stringify(actualizados));
  }

  const limpiarPuntos = () => {
    if (window.confirm("¿Borrar todos los puntos del mapa?")) { setMarcadores([]); onChange(""); }
  }

  const wrapperStyle = pantallaCompleta
    ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, backgroundColor: '#000' }
    : { position: 'relative', width: '100%', height: '400px', borderRadius: '8px', overflow: 'hidden', border: '3px solid #ff3b30', marginBottom: '5px' };

  return (
    <>
      <div style={wrapperStyle}>
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
          <button type="button" onClick={ubicarMiPosicion} style={{ backgroundColor: '#2563eb', color: 'white', border: '2px solid white', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontWeight: 'bold' }}>📍 Encontrarme</button>
          <button type="button" onClick={() => setPantallaCompleta(!pantallaCompleta)} style={{ backgroundColor: 'var(--inst-green)', color: 'white', border: '2px solid white', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontWeight: 'bold' }}>{pantallaCompleta ? '↙️ Cerrar Mapa' : '🔲 Pantalla Completa'}</button>
          {marcadores.length > 0 && <button type="button" onClick={limpiarPuntos} style={{ backgroundColor: '#ef4444', color: 'white', border: '2px solid white', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontWeight: 'bold' }}>🗑️ Limpiar ({marcadores.length})</button>}
        </div>

        <MapContainer center={[4.7059, -74.2302]} zoom={14} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
          <FixMapResize isFullscreen={pantallaCompleta} />
          <MapClick />
          <AutoControlMapa poligono={poligonoMicroterritorio} ubicacionActual={ubicacionActual} />
          {poligonoMicroterritorio && <GeoJSON key={`micro-${nombreMicroterritorio}`} data={poligonoMicroterritorio} style={{ color: '#ff3b30', weight: 4, fillColor: '#ff3b30', fillOpacity: 0.15 }} />}
          {ubicacionActual && <Marker position={ubicacionActual} icon={UserLocIcon}><Popup>Usted está aquí</Popup></Marker>}
          {marcadores.map((m) => (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={HospitalIcon} draggable={true} eventHandlers={{ dragend: (e) => moverMarcador(m.id, e.target.getLatLng().lat, e.target.getLatLng().lng) }}>
              <Popup>
                <div style={{ textAlign: 'center', minWidth: '150px' }}>
                  <strong style={{ color: 'var(--inst-orange)' }}>{m.nombre.toUpperCase()}</strong><br />
                  <small style={{ color: '#666', display: 'block', margin: '5px 0' }}><strong>{m.barrio}</strong></small>
                  <small>Lat: {m.lat.toFixed(5)} <br /> Lng: {m.lng.toFixed(5)}</small>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      {!pantallaCompleta && <div style={{ textAlign: 'center', backgroundColor: '#ff3b30', color: 'white', padding: '5px', fontSize: '0.9rem', fontWeight: 'bold', borderRadius: '8px', marginBottom: '15px' }}>📍 ZONA DE TRABAJO: {nombreMicroterritorio?.toUpperCase() || 'ESPERANDO SELECCIÓN...'}</div>}
    </>
  )
}

// =================================================================
// COMPONENTE PRINCIPAL APP
// =================================================================
function App() {
  const [vista, setVista] = useState('MAIN')
  const [contexto, setContexto] = useState({ modulo: '', programa: '', profesional: '' })
  const [schema, setSchema] = useState(null)
  const [formData, setFormData] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [profesionalBloqueado, setProfesionalBloqueado] = useState(false)

  const visitasLocales = useLiveQuery(() => db.visitas.toArray())

  useEffect(() => {
    const borrador = localStorage.getItem('borradorFormulario')
    if (borrador) {
      setFormData(JSON.parse(borrador))
      if (JSON.parse(borrador).nombre_profesional) setProfesionalBloqueado(true)
    }
  }, [])

  const handleDataUpdate = (newData) => {
    setFormData(newData)
    localStorage.setItem('borradorFormulario', JSON.stringify(newData))
  }

  const handleChange = (e) => handleDataUpdate({ ...formData, [e.target.name]: e.target.value })

  // --- NUEVA FUNCIÓN: VALIDADOR MÁGICO DE TEXTOS (N/A) ---
  const handleBlurTexto = (e, campoId) => {
    let val = e.target.value.trim();
    if (!val) return; // Si lo deja vacío, el 'required' de HTML hará su trabajo

    const valLower = val.toLowerCase();
    // Si escribe menos de 3 caracteres (ej. "no", "-") o variaciones de NA, forzamos "N/A"
    if (val.length < 3 || valLower === "na" || valLower === "n/a" || valLower === "no aplica" || valLower === "ninguno" || valLower === "ninguna") {
      handleDataUpdate({ ...formData, [campoId]: "N/A" });
    } else {
      handleDataUpdate({ ...formData, [campoId]: val }); // Guarda sin espacios extra
    }
  }

  const limpiarBorrador = () => {
    if (window.confirm("⚠️ ¿Desea borrar todo el progreso actual de este formulario?")) {
      setFormData({}); localStorage.removeItem('borradorFormulario'); setProfesionalBloqueado(false);
    }
  }

  const handleFoto = (e, campoId) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => handleDataUpdate({ ...formData, [campoId]: reader.result })
      reader.readAsDataURL(file)
    }
  }

  const irMenuPrincipal = () => { setVista('MAIN'); setContexto({ modulo: '', programa: '', profesional: '' }); setSchema(null); }

  const cargarFormulario = (formId) => {
    setSchema(null); setVista('FORMULARIO');
    fetch(`/api/forms/${formId}`).then(res => res.json()).then(data => data.error ? alert(data.mensaje) : setSchema(data)).catch(err => console.error(err))
  }

  const capturarGPS = (campoId) => {
    if (!navigator.geolocation) return alert("Tu dispositivo no soporta geolocalización.")
    handleDataUpdate({ ...formData, [campoId]: "Obteniendo coordenadas..." })
    navigator.geolocation.getCurrentPosition(
      (pos) => handleDataUpdate({ ...formData, [campoId]: `${pos.coords.latitude}, ${pos.coords.longitude}` }),
      () => { alert("Error obteniendo GPS."); handleDataUpdate({ ...formData, [campoId]: "Error de ubicación" }) }, { enableHighAccuracy: true }
    )
  }

  const validarDocumento = async (campoId) => {
    const doc = formData[campoId];
    if (!doc) return alert("Digite su número de documento primero.");
    const prof = await db.profesionales.get(doc);
    if (prof) {
      handleDataUpdate({ ...formData, nombre_profesional: prof.nombre })
      setProfesionalBloqueado(true); alert(`✅ Bienvenido(a), ${prof.nombre}`);
    } else {
      handleDataUpdate({ ...formData, nombre_profesional: '' })
      setProfesionalBloqueado(false); alert("⚠️ Documento nuevo. Ingrese su nombre.");
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGuardando(true)
    const etiquetaModulo = [contexto.modulo, contexto.programa, contexto.profesional].filter(Boolean).join(' - ').toUpperCase()

    try {
      if (!profesionalBloqueado && formData.documento_profesional && formData.nombre_profesional) {
        await db.profesionales.put({ documento: formData.documento_profesional, nombre: formData.nombre_profesional, cargo: contexto.profesional });
      }
      await db.visitas.add({
        uuid: crypto.randomUUID(), fecha: new Date().toISOString(), modulo: etiquetaModulo,
        paciente: formData.paciente || formData.barrio_territorio || 'Registro General', datos: formData, sincronizado: 0
      })
      alert(`✅ Registro guardado en la tablet.`)
      setFormData({}); localStorage.removeItem('borradorFormulario'); setProfesionalBloqueado(false); irMenuPrincipal()
    } catch (error) { alert("❌ Error guardando en local") }
    setGuardando(false)
  }

  const sincronizarDatos = async () => {
    if (!visitasLocales || visitasLocales.length === 0) return;
    setSincronizando(true)
    try {
      const response = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitas: visitasLocales }) });
      const result = await response.json();
      if (result.status === 'ok') {
        const ids = visitasLocales.map(v => v.id);
        await db.visitas.bulkDelete(ids);
        alert(`☁️ SINCRONIZACIÓN EXITOSA.\n\nNuevos: ${result.agregados}\nDuplicados bloqueados: ${result.duplicados_ignorados}`);
      }
    } catch (error) { alert("⚠️ Error de conexión con el servidor."); }
    setSincronizando(false)
  }

  const HeaderInstitucional = () => (
    <div className="header-institucional">
      <div className="logos-container">
        <img src="/logo-hospital.jpg" alt="Hospital" className="logo" />
        <img src="/logo-alcaldia.png" alt="Alcaldía" className="logo" />
      </div>
      <h1 className="title-hospital">Hospital María Auxiliadora</h1>
      <h2 className="subtitle-alcaldia">Alcaldía de Mosquera</h2>
    </div>
  )

  return (
    <div className="container">
      <HeaderInstitucional />

      {vista === 'MAIN' && (
        <>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 'bold' }}>Seleccione el Módulo de Operación:</p>
          <div className="menu-grid">
            <button className="btn-modulo ebs" onClick={() => { setContexto({ modulo: 'ebs' }); setVista('EBS_PROFS') }}>🩺 Equipos Básicos (EBS)</button>
            <button className="btn-modulo aps" onClick={() => { setContexto({ modulo: 'aps' }); setVista('APS_PROGS') }}>🏫 Atención Primaria (APS)</button>
          </div>
          <BandejaSalida visitas={visitasLocales} sincronizarDatos={sincronizarDatos} sincronizando={sincronizando} />
        </>
      )}

      {vista === 'EBS_PROFS' && (
        <>
          <button onClick={irMenuPrincipal} className="btn-back">⬅ Volver al Menú Principal</button>
          <h3 style={{ color: 'var(--inst-blue)', textAlign: 'center' }}>Equipos Básicos de Salud (EBS)</h3>
          <div className="menu-grid">
            <button className="btn-modulo ebs" onClick={() => { setContexto({ ...contexto, profesional: 'gestor_comunitario' }); cargarFormulario('ebs_gestor_comunitario') }}>🗺️ Gestor Comunitario</button>
            <button className="btn-modulo ebs" onClick={() => { setContexto({ ...contexto, profesional: 'medicina' }); cargarFormulario('ebs_medicina') }}>👨‍⚕️ Medicina</button>
            <button className="btn-modulo ebs" onClick={() => { setContexto({ ...contexto, profesional: 'enfermeria' }); cargarFormulario('ebs_enfermeria') }}>💉 Enfermería</button>
            <button className="btn-modulo ebs" onClick={() => { setContexto({ ...contexto, profesional: 'psicologia' }); cargarFormulario('ebs_psicologia') }}>🧠 Psicología</button>
            <button className="btn-modulo ebs" onClick={() => { setContexto({ ...contexto, profesional: 'trabajo_social' }); cargarFormulario('ebs_trabajo_social') }}>🤝 Trabajo Social</button>
          </div>
        </>
      )}

      {vista === 'APS_PROGS' && (
        <>
          <button onClick={irMenuPrincipal} className="btn-back">⬅ Volver al Menú Principal</button>
          <h3 style={{ color: 'var(--inst-green)', textAlign: 'center' }}>Atención Primaria en Salud (APS)</h3>
          <div className="menu-grid">
            <button className="btn-modulo aps" onClick={() => { setContexto({ ...contexto, programa: 'colegios' }); setVista('APS_PROFS') }}>🎒 Clase (Colegios)</button>
            <button className="btn-modulo aps" onClick={() => { setContexto({ ...contexto, programa: 'domi' }); setVista('APS_PROFS') }}>🏠 Domi (Domiciliaria)</button>
            <button className="btn-modulo umo" onClick={() => { setContexto({ ...contexto, programa: 'umo' }); setVista('APS_PROFS') }}>🦷 UMO (Odontología)</button>
          </div>
        </>
      )}

      {vista === 'APS_PROFS' && (
        <>
          <button onClick={() => setVista('APS_PROGS')} className="btn-back">⬅ Volver a Programas APS</button>
          <h3 style={{ color: 'var(--inst-green)', textAlign: 'center' }}>Programa: {contexto.programa.toUpperCase()}</h3>
          <div className="menu-grid">
            <button className="btn-modulo aps" onClick={() => { setContexto({ ...contexto, profesional: 'medicina' }); cargarFormulario(`aps_${contexto.programa}_medicina`) }}>👨‍⚕️ Medicina general</button>
            <button className="btn-modulo aps" onClick={() => { setContexto({ ...contexto, profesional: 'odontologia' }); cargarFormulario(`aps_${contexto.programa}_odontologia`) }}>🦷 Odontología</button>
            <button className="btn-modulo aps" onClick={() => { setContexto({ ...contexto, profesional: 'enfermeria' }); cargarFormulario(`aps_${contexto.programa}_enfermeria`) }}>💉 Enfermería</button>
          </div>
        </>
      )}

      {vista === 'FORMULARIO' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <button type="button" onClick={() => setVista('MAIN')} className="btn-back" style={{ marginBottom: 0 }}>⬅ Salir</button>
            {Object.keys(formData).length > 0 && (
              <button type="button" onClick={limpiarBorrador} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                🗑️ Limpiar Borrador
              </button>
            )}
          </div>

          {!schema ? <p style={{ textAlign: 'center', color: 'var(--inst-blue)' }}>Cargando...</p> : (
            <div className="card">
              <h2 style={{ marginTop: 0, color: 'var(--inst-blue)', borderBottom: '2px solid var(--border-color)', paddingBottom: '15px' }}>
                {schema.titulo}
              </h2>
              <form onSubmit={handleSubmit}>
                {schema.campos?.map((campo) => (
                  <div key={campo.id} className="form-group" style={campo.tipo === 'titulo_seccion' ? { marginBottom: '5px' } : {}}>

                    {campo.tipo === 'titulo_seccion' ? (
                      <h3 style={{ color: 'var(--inst-orange)', marginTop: '30px', borderBottom: '2px solid var(--border-color)', paddingBottom: '10px', fontSize: '1.2rem', textTransform: 'uppercase' }}>{campo.label}</h3>
                    ) : (
                      <>
                        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>{campo.label}</label>

                        {/* RENDERIZADO DE LA DESCRIPCIÓN TIPO "N/A" */}
                        {campo.descripcion && (
                          <small style={{ display: 'block', color: '#64748b', marginBottom: '8px', fontStyle: 'italic' }}>👉 {campo.descripcion}</small>
                        )}

                        {campo.tipo === 'search_doc' ? (
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <input type="number" name={campo.id} value={formData[campo.id] || ''} onChange={handleChange} required={campo.requerido} style={{ flex: 1 }} />
                            <button type="button" onClick={() => validarDocumento(campo.id)} style={{ backgroundColor: 'var(--inst-orange)', color: 'white', border: 'none', borderRadius: '8px', padding: '0 15px', fontWeight: 'bold' }}>🔍 Validar</button>
                          </div>
                        ) : campo.tipo === 'text_auto' ? (
                          <input type="text" name={campo.id} value={formData[campo.id] || ''} onChange={handleChange} required={campo.requerido} readOnly={profesionalBloqueado} style={{ backgroundColor: profesionalBloqueado ? '#e2e8f0' : '#f8fafc' }} />

                        ) : campo.tipo === 'foto' ? (
                          <div style={{ border: '2px dashed var(--border-color)', padding: '15px', borderRadius: '8px', textAlign: 'center', backgroundColor: 'var(--bg-light)' }}>
                            <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFoto(e, campo.id)} required={campo.requerido && !formData[campo.id]} style={{ width: '100%', padding: '10px 0' }} />
                            {formData[campo.id] && <img src={formData[campo.id]} alt="Preview" style={{ marginTop: '15px', width: '100%', maxHeight: '300px', objectFit: 'cover', borderRadius: '8px', border: '2px solid var(--inst-blue)' }} />}
                          </div>

                        ) : campo.tipo === 'mapa_interactivo' ? (
                          <MapaRiesgosMultiples value={formData[campo.id]} onChange={(coords) => handleDataUpdate({ ...formData, [campo.id]: coords })} formData={formData} />

                        ) : campo.tipo === 'selector_territorio' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <select name="territorio" value={formData.territorio || ''} onChange={(e) => handleDataUpdate({ ...formData, territorio: e.target.value, microterritorio: '', barrio_territorio: '' })} required={campo.requerido}>
                              <option value="">1. Seleccione Territorio...</option>
                              {Object.keys(territoriosData).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            {formData.territorio && <MapaSoloVisual nombreTerritorio={formData.territorio} />}
                            <select name="microterritorio" value={formData.microterritorio || ''} onChange={(e) => handleDataUpdate({ ...formData, microterritorio: e.target.value, barrio_territorio: '' })} required={campo.requerido} disabled={!formData.territorio}>
                              <option value="">2. Seleccione Microterritorio...</option>
                              {formData.territorio && Object.keys(territoriosData[formData.territorio]).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <select name="barrio_territorio" value={formData.barrio_territorio || ''} onChange={handleChange} required={campo.requerido} disabled={!formData.microterritorio}>
                              <option value="">3. Seleccione Barrio / Urb...</option>
                              {formData.microterritorio && territoriosData[formData.territorio][formData.microterritorio].map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                          </div>

                        ) : campo.tipo === 'gps' ? (
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <input type="text" name={campo.id} value={formData[campo.id] || ''} readOnly placeholder="Latitud, Longitud" style={{ flex: 1, backgroundColor: '#e2e8f0' }} required={campo.requerido} />
                            <button type="button" onClick={() => capturarGPS(campo.id)} style={{ backgroundColor: 'var(--inst-blue)', color: 'white', border: 'none', borderRadius: '8px', padding: '0 15px' }}>📍 GPS</button>
                          </div>

                        ) : campo.tipo === 'select' ? (
                          <select name={campo.id} value={formData[campo.id] || ''} onChange={handleChange} required={campo.requerido}>
                            <option value="">Seleccione...</option>
                            {campo.opciones?.map(op => <option key={op} value={op}>{op}</option>)}
                          </select>

                          /* APLICAMOS EL VALIDADOR A TEXTOS Y TEXTAREAS */
                        ) : campo.tipo === 'textarea' ? (
                          <textarea name={campo.id} value={formData[campo.id] || ''} onChange={handleChange} onBlur={(e) => handleBlurTexto(e, campo.id)} rows="3" required={campo.requerido} />
                        ) : (
                          <input type={campo.tipo} name={campo.id} value={formData[campo.id] || ''} onChange={handleChange} onBlur={(e) => handleBlurTexto(e, campo.id)} required={campo.requerido} />
                        )}
                      </>
                    )}
                  </div>
                ))}
                <button type="submit" disabled={guardando} className="btn-save" style={{ marginTop: '30px' }}>
                  {guardando ? 'Guardando...' : '💾 Guardar Registro Oficial'}
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function BandejaSalida({ visitas, sincronizarDatos, sincronizando }) {
  // Bandeja de salida intacta
  return (
    <div className="pendientes-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: '0', color: 'var(--text-main)', fontSize: '1.2rem' }}>📂 Bandeja de Salida</h3>
        {visitas && visitas.length > 0 && (
          <button onClick={sincronizarDatos} disabled={sincronizando} style={{ backgroundColor: 'var(--inst-orange)', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: sincronizando ? 'not-allowed' : 'pointer' }}>
            {sincronizando ? 'Sincronizando...' : '☁️ Sincronizar Ahora'}
          </button>
        )}
      </div>
      {!visitas || visitas.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>Todos los registros están en el servidor central.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {visitas.map(v => (
            <li key={v.id} className="pendiente-item">
              <span style={{ color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <strong style={{ color: 'var(--inst-blue)', fontSize: '0.85rem' }}>{v.modulo}</strong>
                <span>📍 {v.paciente}</span>
              </span>
              <span className="badge">En Espera</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App