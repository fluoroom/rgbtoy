import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="page">
      <header className="home-header">
        <div className="home-logo">
          <span className="r">r</span>
          <span className="g">g</span>
          <span className="b">b</span>
          <span>toy</span>
        </div>
        <p className="home-subtitle">RGB split for toy thermal cameras</p>
      </header>

      <nav className="home-buttons">
        <Link to="/split" className="home-btn">
          <span className="num">1</span>
          <div className="btn-content">
            <span className="btn-title">Split</span>
            <span className="btn-desc">Separate image into RGB strips for printing</span>
          </div>
        </Link>
        <Link to="/unify" className="home-btn">
          <span className="num">2</span>
          <div className="btn-content">
            <span className="btn-title">Unify</span>
            <span className="btn-desc">Combine 3 photographed strips into color</span>
          </div>
        </Link>
      </nav>
    </div>
  )
}
