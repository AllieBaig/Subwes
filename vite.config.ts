
// 2026-04-29 09:28:10
// File creation: 2026-04-29 09:28:10

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  
  // Detect if we are building for GitHub Pages
  // Vercel usually sets its own environment, or you can check for a custom var
  const isGitHubPages = mode === 'production'; 

  return {
    // If you want it to work on Vercel AND GitHub, 
    // it's often easiest to just use './' (relative)
    base: isGitHubPages ? '/Subwes/' : '/',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});


