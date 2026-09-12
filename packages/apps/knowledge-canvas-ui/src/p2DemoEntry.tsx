import { createRoot } from 'react-dom/client'
import { P2Demo } from './P2Demo'
import './styles/app.css'

const el = document.getElementById('root')
if (el) createRoot(el).render(<P2Demo />)
