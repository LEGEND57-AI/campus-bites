
/*
 * The hero's 3D product scene. Depth is real: .scene sets `perspective`,
 * .scene-3d and .scene-drift are `transform-style: preserve-3d`, and every
 * card/object carries its own translateZ, so the browser depth-sorts them -
 * Token #042 genuinely sits behind the phone, Paid 120 genuinely in front.
 *
 * Do not add `filter` to a direct child of a preserve-3d layer: it flattens
 * that element out of the 3D context and it loses its depth placement.
 * Filters here live on inner <svg> leaves for exactly that reason.
 *
 * #scene / #scene3d are read by useLandingEffects for pointer parallax and
 * scroll depth.
 */

export default function Hero3DScene() {
  return (
    <div className="stage rv rv-3">
            <div className="scene" id="scene" role="img"
                 aria-label="A 3D scene: the CampusCraves student app on a phone floating above a glowing blue platform, ringed by order-ready, token and payment cards, with a food bowl and a branded cup.">
              <div className="scene-3d" id="scene3d">
                <div className="scene-drift">


                  <div className="platform" aria-hidden="true">
                    <span className="plat plat-halo"></span>
                    <span className="plat plat-ring-b"></span>
                    <span className="plat plat-ring-a"></span>
                    <span className="plat plat-sweep"></span>
                    <span className="plat plat-disc"></span>
                    <span className="plat plat-inner"></span>
                    <span className="plat plat-edge"></span>
                    <span className="plat plat-shadow"></span>
                  </div>


                  <div className="obj obj-bag" aria-hidden="true">
                    <svg viewBox="0 0 130 176"><use href="#ccBag" width="130" height="176"/></svg>
                  </div>

                  <div className="gcard g-token is-dark">
                    <span className="ic" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5.5" width="17" height="13" rx="3" stroke="#93C5FD" strokeWidth="2"/><path d="M8 5.5v13" stroke="#93C5FD" strokeWidth="2" strokeDasharray="2 2.4"/><path d="M12.5 10.5h5M12.5 13.5h3.5" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round"/></svg></span>
                    <span><b className="num">Token #042</b><span className="sub">Show at the counter</span></span>
                  </div>

                  <div className="gcard g-pickup">
                    <span className="ic" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.6" stroke="#2563EB" strokeWidth="2"/><path d="M12 7.5V12l3 1.8" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                    <span><b>Pickup in 8 min</b><span className="sub">Main Canteen · counter 2</span></span>
                  </div>


                  <div className="phone">
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
                          <span className="num">12:38</span>
                          <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <span className="sig" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                            <svg width="10" height="8" viewBox="0 0 12 9" fill="none" aria-hidden="true"><path d="M1 3.2a7.5 7.5 0 0 1 10 0M3 5.4a4.5 4.5 0 0 1 6 0M6 7.6h.01" stroke="#0F172A" strokeWidth="1.3" strokeLinecap="round"/></svg>
                            <span className="batt" aria-hidden="true"></span>
                          </span>
                        </div>

                        <div className="app">
                          <p className="app-brand">
                            <svg width="10" height="10" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#2563EB"/><path d="M26.8 14.2a8.4 8.4 0 100 11.6" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round"/></svg>
                            CampusCraves
                          </p>
                          <p className="app-hi">Hi Aarav</p>
                          <p className="app-sub">Main Canteen · open till 6:00 pm</p>

                          <div className="app-search">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="#94A3B8" strokeWidth="2.4"/><path d="m16.5 16.5 4 4" stroke="#94A3B8" strokeWidth="2.4" strokeLinecap="round"/></svg>
                            Search meals, snacks, drinks
                          </div>

                          <div className="app-cats">
                            <div className="cat"><div className="tile"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 14h16a8 8 0 0 1-16 0Z" fill="#2563EB"/><path d="M3 18h18" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/><path d="M9 8c0-1.5 1-1.5 1-3M13 8c0-1.5 1-1.5 1-3" stroke="#60A5FA" strokeWidth="1.6" strokeLinecap="round"/></svg></div><span>Meals</span></div>
                            <div className="cat"><div className="tile"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 9c3-3 11-3 14 0l-3 10H8L5 9Z" fill="#2563EB"/><path d="M9 12h6" stroke="#BFDBFE" strokeWidth="1.6" strokeLinecap="round"/></svg></div><span>Snacks</span></div>
                            <div className="cat"><div className="tile"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M7 5h10l-1.4 13a2 2 0 0 1-2 1.8h-3.2a2 2 0 0 1-2-1.8L7 5Z" fill="#2563EB"/><rect x="5.5" y="3" width="13" height="3" rx="1.5" fill="#60A5FA"/></svg></div><span>Drinks</span></div>
                            <div className="cat"><div className="tile"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 17h16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2Z" fill="#60A5FA"/><path d="M5 17a7 7 0 0 1 14 0H5Z" fill="#2563EB"/><circle cx="12" cy="6" r="2" fill="#2563EB"/></svg></div><span>Sweets</span></div>
                          </div>

                          <div className="app-row"><b>Popular right now</b><i>See all</i></div>

                          <div className="fcard">
                            <span className="fthumb" aria-hidden="true"><svg viewBox="26 16 188 188"><rect x="-99" y="-99" width="999" height="999" fill="#F1F6FF"/><use href="#ccBowl" width="240" height="216"/></svg></span>
                            <span className="fbody"><span className="fname">Paneer Rice Bowl</span><span className="ftag">Bestseller</span><span className="fprice num">₹120</span></span>
                            <span className="fadd">Add</span>
                          </div>

                          <div className="fcard">
                            <span className="fthumb" aria-hidden="true"><svg viewBox="46 30 150 150"><rect x="-99" y="-99" width="999" height="999" fill="#F1F6FF"/><use href="#ccBowl" width="240" height="216"/></svg></span>
                            <span className="fbody"><span className="fname">Masala Dosa</span><span className="ftag" style={{ color: '#059669' }}>Ready in 8 min</span><span className="fprice num">₹70</span></span>
                            <span className="fadd">Add</span>
                          </div>

                          <div className="fcard">
                            <span className="fthumb" aria-hidden="true"><svg viewBox="52 34 138 138"><rect x="-99" y="-99" width="999" height="999" fill="#F1F6FF"/><use href="#ccBowl" width="240" height="216"/></svg></span>
                            <span className="fbody"><span className="fname">Veg Thali</span><span className="ftag" style={{ color: '#64748B' }}>Limited today</span><span className="fprice num">₹90</span></span>
                            <span className="fadd">Add</span>
                          </div>

                          <div className="tokcard">
                            <div className="t-top"><span><span className="ldot"></span>Order confirmed</span><span className="num">Paid · UPI</span></div>
                            <div className="t-num num">Token 042</div>
                            <div className="t-bar"><i></i></div>
                            <div className="t-meta"><span>Being prepared</span><span className="num">Ready 12:52</span></div>
                          </div>
                        </div>

                        <div className="app-nav">
                          <div className="on"><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M4 11 12 4l8 7v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8Z" fill="#2563EB"/></svg>Home</div>
                          <div><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2.5" stroke="#94A3B8" strokeWidth="2"/><path d="M9 9h6M9 13h6M9 17h3" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/></svg>Orders</div>
                          <div><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M4 6h2.2l2 10.2a1.6 1.6 0 0 0 1.6 1.3h7.4" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M7.4 8.6H20l-1.6 6H8.6" stroke="#94A3B8" strokeWidth="2" strokeLinejoin="round"/><circle cx="10" cy="20" r="1.3" fill="#94A3B8"/><circle cx="17" cy="20" r="1.3" fill="#94A3B8"/></svg>Cart</div>
                          <div><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.5" r="3.7" stroke="#94A3B8" strokeWidth="2"/><path d="M4.8 20a7.4 7.4 0 0 1 14.4 0" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/></svg>Profile</div>
                        </div>
                      </div>
                    </div>
                  </div>


                  <div className="obj obj-cup" aria-hidden="true">
                    <svg viewBox="0 0 130 186"><use href="#ccCup" width="130" height="186"/></svg>
                  </div>

                  <div className="obj obj-bowl" aria-hidden="true">
                    <svg viewBox="0 0 240 216"><use href="#ccBowl" width="240" height="216"/></svg>
                  </div>

                  <div className="gcard g-ready">
                    <span className="ic" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="#059669"/><path d="m8 12.4 2.6 2.6L16.4 9" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                    <span><b>Order ready</b><span className="sub">Collect from counter 2</span></span>
                  </div>

                  <div className="gcard g-paid">
                    <span className="ic" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="12.5" rx="2.6" fill="#2563EB"/><path d="M3 10h18" stroke="#fff" strokeWidth="2"/><rect x="6" y="13.4" width="5" height="2" rx="1" fill="#BFDBFE"/></svg></span>
                    <span><b className="num">Paid ₹120</b><span className="sub">UPI · campus wallet</span></span>
                  </div>

                  <div className="gcard g-fresh">
                    <span className="ic" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3.2 19 6v5.4c0 4.3-2.9 7.6-7 9.4-4.1-1.8-7-5.1-7-9.4V6l7-2.8Z" fill="#2563EB"/><path d="m8.8 12 2.2 2.2 4.2-4.4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                    <span><b>Fresh &amp; hygienic</b><span className="sub">Cooked at your canteen</span></span>
                  </div>

                </div>
              </div>
            </div>
          </div>
  );
}
