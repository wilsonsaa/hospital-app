import { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mapasTerritorios, mapasMicroterritorios } from '../territoriosData';

const MOSQUERA_CENTER = [4.7059, -74.2302];

function AjustarCamara({ geoData }) {
    const map = useMap();
    useEffect(() => {
        if (geoData) {
            const layer = L.geoJSON(geoData);
            const bounds = layer.getBounds();
            if (bounds.isValid()) {
                map.flyToBounds(bounds, { padding: [20, 20], duration: 1.5 });
            }
        }
    }, [geoData, map]);
    return null;
}

export default function MapaTerritorio({ territorio, microterritorio }) {
    let geoDataAMostrar = null;
    let colorFondo = 'var(--inst-blue)';

    if (microterritorio) {
        const feature = mapasMicroterritorios.features.find(f => f.properties.Name === microterritorio);
        if (feature) { geoDataAMostrar = feature; colorFondo = 'var(--inst-orange)'; }
    } else if (territorio) {
        const feature = mapasTerritorios.features.find(f => f.properties.Name === territorio);
        if (feature) { geoDataAMostrar = feature; }
    }

    return (
        <MapContainer center={MOSQUERA_CENTER} zoom={14} style={{ height: '100%', width: '100%', zIndex: 1 }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
            {geoDataAMostrar && (
                <>
                    <GeoJSON key={geoDataAMostrar.properties.Name} data={geoDataAMostrar} style={{ color: 'var(--inst-blue)', fillColor: colorFondo, fillOpacity: 0.5, weight: 3 }} />
                    <AjustarCamara geoData={geoDataAMostrar} />
                </>
            )}
        </MapContainer>
    );
}