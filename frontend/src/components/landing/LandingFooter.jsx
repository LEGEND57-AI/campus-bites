import { Link } from "react-router-dom";

export default function LandingFooter() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="f-grid">
          <div className="f-about">
            <a className="brand" href="#top">
              <svg className="mark" viewBox="0 0 40 40" aria-hidden="true">
                <rect width="40" height="40" rx="11" fill="url(#mk)"/>
                <path d="M26.8 14.2a8.4 8.4 0 100 11.6" stroke="#fff" strokeWidth="3.6" fill="none" strokeLinecap="round"/>
                <circle cx="27.4" cy="20" r="2.1" fill="#93C5FD"/>
              </svg>
              <span>Campus<span className="accent">Craves</span></span>
            </a>
            <p>Canteen ordering built for one campus at a time — a live menu, an order placed between lectures, and a token instead of a queue.</p>
          </div>

          <div className="f-cols">
            <div>
              <h4>Product</h4>
              <ul>
                <li><a href="#features">Features</a></li>
                <li><a href="#how">How It Works</a></li>
                <li><a href="#menu">Menu</a></li>
                <li><Link to="/login">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <h4>Canteens</h4>
              <ul>
                <li><a href="#canteens">For Canteens</a></li>
                <li><a href="#contact">Partner with us</a></li>
                <li><a href="#canteens">Counter dashboard</a></li>
                <li><a href="#contact">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4>Legal</h4>
              <ul>
                <li><a href="#contact">Privacy</a></li>
                <li><a href="#contact">Terms</a></li>
                <li><a href="#contact">Refunds</a></li>
                <li><a href="#contact">Support</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="f-bottom">
          <span>© <span className="num">{new Date().getFullYear()}</span> CampusCraves. Made for campus canteens.</span>
        </div>
      </div>
    </footer>
  );
}
