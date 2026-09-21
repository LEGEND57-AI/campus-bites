
export default function BenefitsStrip() {
  return (
    <div className="wrap">
      <div className="strip rv">
        <div className="strip-item">
          <span className="ic" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4.5" width="17" height="15" rx="3" stroke="#2563EB" strokeWidth="1.9"/><path d="M7.5 9h9M7.5 12.5h9M7.5 16h5" stroke="#2563EB" strokeWidth="1.9" strokeLinecap="round"/></svg></span>
          <div><b>The whole menu</b><p>Today's items and prices, straight from the counter.</p></div>
        </div>
        <div className="strip-item">
          <span className="ic" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M13.2 2.6 4.8 13.4h5.4l-.6 8 8.4-10.8h-5.4l.6-8Z" fill="#2563EB"/></svg></span>
          <div><b>Order between classes</b><p>Place it at 12:10, collect it at 12:40.</p></div>
        </div>
        <div className="strip-item">
          <span className="ic" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="14" rx="3" stroke="#2563EB" strokeWidth="1.9"/><path d="M8 5v14" stroke="#2563EB" strokeWidth="1.9" strokeDasharray="2.2 2.6"/><path d="M12.5 10h5M12.5 14h3.5" stroke="#2563EB" strokeWidth="1.9" strokeLinecap="round"/></svg></span>
          <div><b>A token, not a line</b><p>Your number and pickup time, live on your phone.</p></div>
        </div>
        <div className="strip-item">
          <span className="ic" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2.8 19.5 6v5.6c0 4.6-3.1 8.2-7.5 10.1-4.4-1.9-7.5-5.5-7.5-10.1V6L12 2.8Z" stroke="#2563EB" strokeWidth="1.9" strokeLinejoin="round"/><path d="m9 12 2.2 2.2L15.4 10" stroke="#2563EB" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
          <div><b>Paid before you arrive</b><p>UPI, card or campus wallet. No cash at the counter.</p></div>
        </div>
      </div>
    </div>
  );
}
