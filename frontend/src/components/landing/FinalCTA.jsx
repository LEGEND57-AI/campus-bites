import { Link } from "react-router-dom";

export default function FinalCTA() {
  return (
    <section className="section" id="contact" style={{ paddingTop: '0' }}>
      <div className="wrap">
        <div className="final rv">
          <div className="final-in">
            <h2>Ready to make campus food smarter?</h2>
            <p>Start ordering from your canteen, or bring CampusCraves to your college counter.</p>
            <div className="final-ctas">
              <Link className="btn btn-onnavy" to="/login">
                Get Started
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
              <Link className="btn btn-outline" to="/signup">Create an account</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
