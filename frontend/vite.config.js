import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'prompt', // Controlamos la actualización manualmente
            injectRegister: 'auto',
            includeAssets: ['logo-hospital.png', 'logo-alcaldia.png'], // <-- ACTUALIZADO A .PNG
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg}'],
                cleanupOutdatedCaches: true,
            },
            manifest: {
                name: 'Salud-Mosquera APS',
                short_name: 'Salud-Mosquera',
                description: 'Sistema de Atención Primaria en Salud',
                theme_color: '#1e3a8a',
                background_color: '#f8fafc',
                display: 'standalone', // <-- ESTO OBLIGA A PANTALLA COMPLETA
                start_url: '/',
                orientation: 'portrait',
                icons: [
                    { src: 'logo-hospital.png', sizes: '192x192', type: 'image/png' }, // <-- LOGO DEL HOSPITAL
                    { src: 'logo-hospital.png', sizes: '512x512', type: 'image/png' }
                ]
            }
        })
    ],
})