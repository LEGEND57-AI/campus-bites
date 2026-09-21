
export default function HowItWorks() {
  return (
    <section className="section" id="how" style={{ background: 'var(--surface)', borderBlock: '1px solid var(--border)' }}>
      <div className="wrap">
        <div className="sec-head rv">
          <span className="kicker">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h16m0 0-6-6m6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Five steps, about ninety seconds
          </span>
          <h2 className="h2">From your phone to your tray</h2>
          <p className="lede">The whole thing happens before you've packed your bag.</p>
        </div>

        <ol className="steps">
          <li className="step is-lit rv rv-1"><span className="step-n num">01</span><div className="step-b"><h3 className="h3">Browse</h3><p>Open today's menu for your canteen and see what's actually available right now.</p></div></li>
          <li className="step is-lit rv rv-2"><span className="step-n num">02</span><div className="step-b"><h3 className="h3">Choose</h3><p>Add what you want, adjust quantities, and pick your collection slot.</p></div></li>
          <li className="step is-lit rv rv-3"><span className="step-n num">03</span><div className="step-b"><h3 className="h3">Order</h3><p>Confirm. Your order lands on the canteen's screen in the queue, in sequence.</p></div></li>
          <li className="step rv rv-4"><span className="step-n num">04</span><div className="step-b"><h3 className="h3">Pay</h3><p>Settle by UPI, card or campus wallet. Your token is issued the second payment clears.</p></div></li>
          <li className="step rv rv-5"><span className="step-n num">05</span><div className="step-b"><h3 className="h3">Pick up</h3><p>Walk up when the status says ready, show your token, and take your food.</p></div></li>
        </ol>
      </div>
    </section>
  );
}
