
export default function FeaturesSection() {
  return (
    <section className="section" id="features">
      <div className="wrap">
        <div className="sec-head rv">
          <span className="kicker">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="2" fill="currentColor"/><rect x="13.5" y="3.5" width="7" height="7" rx="2" fill="currentColor" opacity=".55"/><rect x="3.5" y="13.5" width="7" height="7" rx="2" fill="currentColor" opacity=".55"/><rect x="13.5" y="13.5" width="7" height="7" rx="2" fill="currentColor"/></svg>
            What you get
          </span>
          <h2 className="h2">Everything between hungry and holding your tray</h2>
          <p className="lede">Six pieces that replace the paper menu, the cash box and the queue that forms at half past twelve.</p>
        </div>

        <div className="cards" id="menu">
          <article className="card rv rv-1">
            <span className="ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="17" height="17" rx="4" stroke="#2563EB" strokeWidth="1.9"/><path d="M7.5 9h9M7.5 12.5h9M7.5 16h5.5" stroke="#2563EB" strokeWidth="1.9" strokeLinecap="round"/></svg></span>
            <h3 className="h3">Digital menu</h3>
            <p>Every item, price and photo your canteen publishes — with anything that ran out marked unavailable the moment it does.</p>
          </article>
          <article className="card rv rv-2">
            <span className="ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="15.5" rx="3.5" stroke="#2563EB" strokeWidth="1.9"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" stroke="#2563EB" strokeWidth="1.9" strokeLinecap="round"/><path d="m10 14.5 1.8 1.8 3.4-3.6" stroke="#2563EB" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
            <h3 className="h3">Order ahead</h3>
            <p>Pick a collection slot that fits your timetable. The kitchen starts your food so it's ready when your lecture ends.</p>
          </article>
          <article className="card rv rv-3">
            <span className="ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="5.5" width="18" height="13" rx="3" stroke="#2563EB" strokeWidth="1.9"/><path d="M8.5 5.5v13" stroke="#2563EB" strokeWidth="1.9" strokeDasharray="2.4 2.8"/><path d="M12.5 10h5.5M12.5 14h4" stroke="#2563EB" strokeWidth="1.9" strokeLinecap="round"/></svg></span>
            <h3 className="h3">Smart pickup token</h3>
            <p>One number, zero-padded and easy to read across a counter. Show it, say it, collect — no name-calling, no confusion.</p>
          </article>
          <article className="card rv rv-4">
            <span className="ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.8" stroke="#2563EB" strokeWidth="1.9"/><path d="M12 6.8V12l3.4 2" stroke="#2563EB" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
            <h3 className="h3">Real-time status</h3>
            <p>Confirmed, being prepared, ready. The screen updates as the kitchen moves, so you leave your seat at the right minute.</p>
          </article>
          <article className="card rv rv-5">
            <span className="ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="2.8" y="5.5" width="18.4" height="13" rx="3" stroke="#2563EB" strokeWidth="1.9"/><path d="M2.8 10h18.4" stroke="#2563EB" strokeWidth="1.9"/><rect x="6" y="13.4" width="4.6" height="2.2" rx="1.1" fill="#2563EB"/></svg></span>
            <h3 className="h3">Digital payments</h3>
            <p>UPI, card or campus wallet, settled before you walk over. Receipts stay in your order history instead of your pocket.</p>
          </article>
          <article className="card rv rv-6">
            <span className="ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3.5 19.5v-6M9 19.5V8M14.5 19.5v-9M20 19.5V4.5" stroke="#2563EB" strokeWidth="1.9" strokeLinecap="round"/></svg></span>
            <h3 className="h3">A faster counter</h3>
            <p>Orders arrive sorted and already paid, so staff spend the rush handing over food instead of taking down orders.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
