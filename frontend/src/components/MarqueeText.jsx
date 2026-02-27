export default function MarqueeText({ items = [] }) {
  const safeItems = items.length ? items : ['Interview', 'Coding', 'Communication'];

  return (
    <div className="marquee-shell" aria-label="moving-text-strip">
      <div className="marquee-track">
        {safeItems.concat(safeItems).map((item, idx) => (
          <span key={`${item}-${idx}`} className="marquee-item">{item}</span>
        ))}
      </div>
    </div>
  );
}
