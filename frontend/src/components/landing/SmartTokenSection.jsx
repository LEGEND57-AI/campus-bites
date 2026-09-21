
export default function SmartTokenSection() {
  return (
    <section className="section" style={{ paddingTop: '0' }}>
      <div className="wrap">
        <div className="split">

          <div className="panel rv">
            <span className="kicker">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="3" stroke="currentColor" strokeWidth="1.9"/><path d="M8 5.5v13" stroke="currentColor" strokeWidth="1.9" strokeDasharray="2 2.4"/></svg>
              Smart token
            </span>
            <h2 className="h2">The queue becomes a number</h2>
            <p className="lede" style={{ marginTop: '.75rem' }}>Payment clears, a token is issued, and the counter works through them in order. You watch the status instead of the line.</p>

            <div className="tok-hero" style={{ marginTop: '1.75rem' }}>
              <p className="lbl">Your pickup token</p>
              <p className="big num">Token 042</p>
              <div className="bar"><i></i></div>
              <div className="foot"><span>Being prepared</span><span className="num">Ready 12:52</span></div>
            </div>

            <ul className="tl">
              <li className="done"><span className="dot" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"/></svg></span>Order placed · <span className="num">12:38</span></li>
              <li className="done"><span className="dot" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"/></svg></span>Paid by UPI · <span className="num">12:39</span></li>
              <li><span className="dot" aria-hidden="true"></span>Being prepared · counter 2</li>
              <li><span className="dot" aria-hidden="true"></span>Ready to collect · <span className="num">12:52</span></li>
            </ul>
          </div>

          <div className="panel rv rv-2">
            <span className="kicker">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="3" stroke="currentColor" strokeWidth="1.9"/><path d="M3 10h18" stroke="currentColor" strokeWidth="1.9"/></svg>
              Digital payments
            </span>
            <h2 className="h2">Paid before you stand up</h2>
            <p className="lede" style={{ marginTop: '.75rem' }}>No cash at the counter, no change to count, no card machine holding up the line. The money settles while you're still in your seat.</p>

            <div className="pay-row">
              <span className="pay-chip"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 3 12 9-12 9V3Z" fill="#2563EB"/></svg>UPI</span>
              <span className="pay-chip"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2.6" fill="#2563EB"/><path d="M3 10h18" stroke="#fff" strokeWidth="2"/></svg>Card</span>
              <span className="pay-chip"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="3" stroke="#2563EB" strokeWidth="1.9"/><circle cx="16.5" cy="12" r="2" fill="#2563EB"/></svg>Campus wallet</span>
              <span className="pay-chip"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="#2563EB" strokeWidth="1.9"/><rect x="13" y="4" width="7" height="7" rx="1.5" stroke="#2563EB" strokeWidth="1.9"/><rect x="4" y="13" width="7" height="7" rx="1.5" stroke="#2563EB" strokeWidth="1.9"/><rect x="14.5" y="14.5" width="4" height="4" fill="#2563EB"/></svg>Scan to pay</span>
            </div>

            <ul className="tl" style={{ marginTop: '1.75rem' }}>
              <li className="done"><span className="dot" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"/></svg></span>Receipt saved to your order history</li>
              <li className="done"><span className="dot" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"/></svg></span>Refunds go back the way you paid</li>
              <li className="done"><span className="dot" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"/></svg></span>The canteen's daily total reconciles itself</li>
            </ul>
          </div>

        </div>
      </div>
    </section>
  );
}
