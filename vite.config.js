import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace 'ai-digital-stethoscope' with YOUR GitHub repository name
export default defineConfig({
  plugins: [react()],
  base: '/https://github.com/ishareefshaik/ai-digital-stethoscope/',
})
