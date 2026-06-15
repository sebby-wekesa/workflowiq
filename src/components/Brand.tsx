export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      <span className="brand-name">Workflow<span>IQ</span></span>
    </div>
  );
}
