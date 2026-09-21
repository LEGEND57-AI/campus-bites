
export default function CanteenSection() {
  return (
    <section className="section" id="canteens" style={{ paddingTop: '0' }}>
      <div className="wrap">
        <div className="canteen on-navy rv">
          <div className="canteen-grid">
            <div>
              <span className="kicker">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h16M5.5 20V10L12 5l6.5 5v10" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"/></svg>
                For canteens and colleges
              </span>
              <h2 className="h2">Run the rush from one screen</h2>
              <p className="lede">CampusCraves gives the counter a live order queue, paid up front and sorted by pickup time — so the half-hour that used to be chaos becomes a list you work through.</p>

              <ul className="show-list">
                <li><span className="tick" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>Order management with a live queue and one-tap status changes</li>
                <li><span className="tick" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>Shorter lines, because ordering and paying happen before arrival</li>
                <li><span className="tick" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>Digital payments with a daily settlement you can reconcile</li>
                <li><span className="tick" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>Analytics on what sells, when it sells, and what to prep tomorrow</li>
                <li><span className="tick" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>Menu and availability you update yourself, in seconds</li>
              </ul>

              <a className="btn btn-onnavy" href="#contact">
                Partner With CampusCraves
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </a>
            </div>

            <div className="dash" role="img" aria-label="The canteen counter dashboard, showing illustrative counts and a live token queue.">
              <div className="dash-top"><i></i><i></i><i></i><b>Counter dashboard — Main Canteen</b></div>
              <div className="dash-body">
                <div className="kpis">
                  <div className="kpi"><p className="k">In queue</p><p className="n num">12</p></div>
                  <div className="kpi"><p className="k">Ready now</p><p className="n num">04</p></div>
                  <div className="kpi"><p className="k">Avg. prep</p><p className="n num">9 min</p></div>
                </div>
                <div className="queue">
                  <div className="q-head"><span>Token · item</span><span>Status</span></div>
                  <div className="qrow"><span className="qtok num">Token 041</span><span className="qname">Veg Thali ×1</span><span className="qchip is-ready">Ready</span></div>
                  <div className="qrow"><span className="qtok num">Token 042</span><span className="qname">Paneer Rice Bowl ×1</span><span className="qchip is-prep">Preparing</span></div>
                  <div className="qrow"><span className="qtok num">Token 043</span><span className="qname">Masala Dosa ×2</span><span className="qchip is-prep">Preparing</span></div>
                  <div className="qrow"><span className="qtok num">Token 044</span><span className="qname">Filter Coffee ×1</span><span className="qchip is-new">New</span></div>
                  <div className="qrow"><span className="qtok num">Token 045</span><span className="qname">Samosa ×3, Chai ×1</span><span className="qchip is-new">New</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="stats" style={{ marginTop: '2.25rem' }}>
            <div className="stat">
              <span className="ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 7h12l-1 12.5a2 2 0 0 1-2 1.8H9a2 2 0 0 1-2-1.8L6 7Z" stroke="#93C5FD" strokeWidth="1.9" strokeLinejoin="round"/><path d="M9 7a3 3 0 0 1 6 0" stroke="#93C5FD" strokeWidth="1.9" strokeLinecap="round"/></svg></span>
              <p className="v num">50K+</p><p className="l">Demo orders placed</p>
            </div>
            <div className="stat">
              <span className="ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.6" r="3.8" stroke="#93C5FD" strokeWidth="1.9"/><path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0" stroke="#93C5FD" strokeWidth="1.9" strokeLinecap="round"/></svg></span>
              <p className="v num">10K+</p><p className="l">Demo student accounts</p>
            </div>
            <div className="stat">
              <span className="ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 20h16M5.5 20V10l6.5-5 6.5 5v10" stroke="#93C5FD" strokeWidth="1.9" strokeLinejoin="round"/><rect x="10" y="13.5" width="4" height="6.5" fill="#93C5FD"/></svg></span>
              <p className="v num">25+</p><p className="l">Demo canteen counters</p>
            </div>
            <div className="stat">
              <span className="ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="m12 3.6 2.6 5.3 5.8.85-4.2 4.1 1 5.8-5.2-2.75-5.2 2.75 1-5.8-4.2-4.1 5.8-.85L12 3.6Z" stroke="#93C5FD" strokeWidth="1.9" strokeLinejoin="round"/></svg></span>
              <p className="v num">4.8</p><p className="l">Demo average rating</p>
            </div>
          </div>
          <p className="demo-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="#7D8FB3" strokeWidth="1.8"/><path d="M12 11v5.5" stroke="#7D8FB3" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="7.8" r="1.1" fill="#7D8FB3"/></svg>
            Illustrative figures — not live usage data.
          </p>
        </div>
      </div>
    </section>
  );
}
