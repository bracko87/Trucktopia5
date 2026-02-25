import { createRoot } from 'react-dom/client'
import './shadcn.css'
import 'leaflet/dist/leaflet.css'
import App from './App'

const root = createRoot(document.getElementById('app')!)
root.render(<App />)