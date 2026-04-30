import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    const port = parseInt(env.VITE_PORT || '5173', 10);
    const allowedHosts = env.VITE_ALLOWED_HOSTS
        ? env.VITE_ALLOWED_HOSTS.split(',').map((h) => h.trim())
        : [];

    return {
        plugins: [react()],
        base: './',
        server: {
            port,
            cors: true,
            allowedHosts,
        },
    };
});
