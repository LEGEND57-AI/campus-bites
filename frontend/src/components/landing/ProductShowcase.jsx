
/*
 * Second 3D scene: the student order screen. Same depth model as the hero.
 * #scene2 / #scene2_3d are read by useLandingEffects, which turns the scene a
 * few degrees as it crosses the viewport.
 */

export default function ProductShowcase() {
  return (
    <section className="section" id="showcase">
      <div className="wrap">
        <div className="showcase on-navy">
          <div className="show-grid">
            <div className="rv">
              <span className="kicker">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="3" stroke="currentColor" strokeWidth="1.9"/><path d="M10.5 18.5h3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>
                The student app
              </span>
              <h2 className="h2">One screen, from craving to collected</h2>
              <p className="lede">No calls, no shouting your name across a counter, no finding out the dosa ran out ten minutes ago. Everything a student needs sits on one screen and updates itself.</p>
              <ul className="show-list">
                <li><span className="tick" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>Live availability — sold-out items grey out instantly</li>
                <li><span className="tick" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>Your token and pickup time pinned to the top of the app</li>
                <li><span className="tick" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>Order history with every receipt, searchable</li>
                <li><span className="tick" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>Reorder your usual in two taps</li>
              </ul>
            </div>

            <div className="stage-2 rv rv-2">
              <div className="scene2" id="scene2" role="img" aria-label="A second 3D view: the CampusCraves order screen on a floating phone above a glowing ring, with order-ready and payment cards, a food bowl and a cup.">
                <div className="scene2-3d" id="scene2_3d">

                  <div className="s2-plat" aria-hidden="true">
                    <span className="s2-ring"></span>
                    <span className="s2-disc"></span>
                    <span className="s2-edge"></span>
                  </div>

                  <div className="gcard s2-card c2-b is-dark">
                    <span className="ic" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.6" stroke="#93C5FD" strokeWidth="2"/><path d="M12 7.5V12l3 1.8" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                    <span><b>Ready 12:52</b><span className="sub">Kitchen is on it</span></span>
                  </div>

                  <div className="s2-phone">
                    <span className="ph-layer" style={{ transform: 'translateZ(-14px)' }} aria-hidden="true"></span>
                    <span className="ph-layer" style={{ transform: 'translateZ(-8px)' }} aria-hidden="true"></span>
                    <span className="ph-layer" style={{ transform: 'translateZ(-2px)' }} aria-hidden="true"></span>
                    <span className="ph-layer" style={{ transform: 'translateZ(4px)' }} aria-hidden="true"></span>
                    <span className="ph-rail" aria-hidden="true"></span>
                    <span className="ph-btn is-vol1" aria-hidden="true"></span>
                    <span className="ph-btn is-vol2" aria-hidden="true"></span>
                    <span className="ph-btn is-pwr" aria-hidden="true"></span>
                    <div className="ph-body">
                      <div className="ph-screen">
                        <span className="notch" aria-hidden="true"></span>
                        <span className="ph-gloss" aria-hidden="true"></span>
                        <div className="sbar">
                          <span className="num">12:44</span>
                          <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <span className="sig" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                            <span className="batt" aria-hidden="true"></span>
                          </span>
                        </div>
                        <div className="app">
                          <p className="app-brand">
                            <svg width="10" height="10" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#2563EB"/><path d="M26.8 14.2a8.4 8.4 0 100 11.6" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round"/></svg>
                            Your order
                          </p>
                          <div className="tokcard" style={{ marginTop: '9px' }}>
                            <div className="t-top"><span><span className="ldot"></span>Being prepared</span><span className="num">Counter 2</span></div>
                            <div className="t-num num">Token 042</div>
                            <div className="t-bar"><i></i></div>
                            <div className="t-meta"><span>2 items</span><span className="num">Ready 12:52</span></div>
                          </div>
                          <div className="app-row"><b>In this order</b><i>Receipt</i></div>
                          <div className="fcard">
                            <span className="fthumb" aria-hidden="true"><svg viewBox="26 16 188 188"><rect x="-99" y="-99" width="999" height="999" fill="#F1F6FF"/><use href="#ccBowl" width="240" height="216"/></svg></span>
                            <span className="fbody"><span className="fname">Paneer Rice Bowl</span><span className="ftag" style={{ color: '#64748B' }}>Qty 1</span><span className="fprice num">₹120</span></span>
                          </div>
                          <div className="fcard">
                            <span className="fthumb" aria-hidden="true"><svg viewBox="6 18 118 118"><rect x="-99" y="-99" width="999" height="999" fill="#F1F6FF"/><use href="#ccCup" width="130" height="186"/></svg></span>
                            <span className="fbody"><span className="fname">Filter Coffee</span><span className="ftag" style={{ color: '#64748B' }}>Qty 1</span><span className="fprice num">₹30</span></span>
                          </div>
                          <div className="app-row"><b>Paid · UPI</b><i className="num">₹150</i></div>
                          <div className="fcard" style={{ borderColor: '#DBEAFE', background: 'linear-gradient(140deg,#F5F9FF,#EAF2FF)' }}>
                            <span className="ic" aria-hidden="true" style={{ width: '26px', height: '26px', borderRadius: '8px', display: 'grid', placeItems: 'center', flex: 'none', background: '#fff', border: '1px solid #DBEAFE' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5.5" width="17" height="13" rx="3" stroke="#2563EB" strokeWidth="2"/><path d="M8 5.5v13" stroke="#2563EB" strokeWidth="2" strokeDasharray="2 2.4"/></svg>
                            </span>
                            <span className="fbody">
                              <span className="fname">Show Token 042 at counter 2</span>
                              <span className="ftag" style={{ color: '#2563EB' }}>Tap to enlarge</span>
                            </span>
                          </div>
                        </div>
                        <div className="app-nav">
                          <div><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M4 11 12 4l8 7v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8Z" fill="#94A3B8"/></svg>Home</div>
                          <div className="on"><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2.5" stroke="#2563EB" strokeWidth="2"/><path d="M9 9h6M9 13h6M9 17h3" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/></svg>Orders</div>
                          <div><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M4 6h2.2l2 10.2a1.6 1.6 0 0 0 1.6 1.3h7.4" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M7.4 8.6H20l-1.6 6H8.6" stroke="#94A3B8" strokeWidth="2" strokeLinejoin="round"/></svg>Cart</div>
                          <div><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.5" r="3.7" stroke="#94A3B8" strokeWidth="2"/><path d="M4.8 20a7.4 7.4 0 0 1 14.4 0" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/></svg>Profile</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="s2-obj o2-cup" aria-hidden="true">
                    <svg viewBox="0 0 130 186"><use href="#ccCup" width="130" height="186"/></svg>
                  </div>

                  <div className="s2-obj o2-bowl" aria-hidden="true">
                    <svg viewBox="0 0 240 216"><use href="#ccBowl" width="240" height="216"/></svg>
                  </div>

                  <div className="gcard s2-card c2-a">
                    <span className="ic" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="#059669"/><path d="m8 12.4 2.6 2.6L16.4 9" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                    <span><b>Order ready</b><span className="sub">Collect from counter 2</span></span>
                  </div>

                  <div className="gcard s2-card c2-c">
                    <span className="ic" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="12.5" rx="2.6" fill="#2563EB"/><path d="M3 10h18" stroke="#fff" strokeWidth="2"/><rect x="6" y="13.4" width="5" height="2" rx="1" fill="#BFDBFE"/></svg></span>
                    <span><b className="num">Paid ₹150</b><span className="sub">UPI · 12:39 pm</span></span>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
