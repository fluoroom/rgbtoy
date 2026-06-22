import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Split from './pages/Split'
import Unify from './pages/Unify'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/split" element={<Split />} />
      <Route path="/unify" element={<Unify />} />
    </Routes>
  )
}
