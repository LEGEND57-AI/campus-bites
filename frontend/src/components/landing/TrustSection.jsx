
export default function TrustSection() {
  return (
    <section className="section" style={{ paddingTop: '0' }}>
      <div className="wrap">
        <div className="sec-head is-center rv">
          <h2 className="h2">Designed around the 12:40 rush</h2>
          <p className="lede">Illustrative scenarios, based on how a campus canteen actually runs.</p>
        </div>
        <div className="quotes">
          <figure className="quote rv rv-1">
            <p>“I order while the last slide is still up. By the time I get downstairs the token says ready and I walk straight past the line.”</p>
            <footer><span className="face face-a">AR</span><span><span className="who">Aarav R.</span><span className="role">Second year · sample persona</span></span></footer>
          </figure>
          <figure className="quote rv rv-2">
            <p>“We used to lose the rush to writing down orders and counting change. Now the screen tells us what to cook and in what order.”</p>
            <footer><span className="face face-b">MK</span><span><span className="who">Meera K.</span><span className="role">Canteen supervisor · sample persona</span></span></footer>
          </figure>
          <figure className="quote rv rv-3">
            <p>“Everything is paid and logged, so the day's total matches without anyone reconciling a cash box at closing.”</p>
            <footer><span className="face face-c">SP</span><span><span className="who">S. Prakash</span><span className="role">Campus operations · sample persona</span></span></footer>
          </figure>
        </div>
      </div>
    </section>
  );
}
