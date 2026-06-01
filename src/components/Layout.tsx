import { Outlet, Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import './Layout.css'

export default function Layout() {
  return (
    <div className="appShell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="appHeader">
        <Link to="/" className="appBrand">
          Credence
        </Link>
        <nav aria-label="Main navigation" className="appNav">
          <Link to="/bond">Bond</Link>
          <Link to="/trust">Trust Score</Link>
        </nav>
        <ThemeToggle />
      </header>
      <main id="main-content" className="appMain">
        <Outlet />
      </main>

      <footer className="app-footer">
        <div className="container footer-content">
          <div>
            <p className="appFooterTitle">Credence</p>
            <p>© 2026 Credence Protocol. Built on Stellar.</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">
              Documentation
            </a>
            <a href="#" className="footer-link">
              Terms of Service
            </a>
            <a href="#" className="footer-link">
              Privacy Policy
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
