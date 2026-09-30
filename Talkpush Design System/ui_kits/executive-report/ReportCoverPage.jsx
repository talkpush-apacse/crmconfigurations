function ReportCoverPage({ AccentSquares }) {
  return (
    <div style={{ position: 'relative', background: 'var(--color-beige)', width: '100%', height: '100%', padding: '56px 60px', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
      <AccentSquares count={4} seed={5} />
      <img src="../../assets/logo-mark.jpg" alt="Talkpush" style={{ width: 40, height: 40, borderRadius: 9 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, maxWidth: 640 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Funnel report &middot; August 2026</div>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 46, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.08, color: 'var(--text-primary)' }}>
          Colombia converted 1 in 3 qualified candidates, the best rate across all six markets
        </h1>
        <div style={{ height: 10, width: 220, borderRadius: 5, background: 'var(--gradient-signature)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        <span>Talkpush &middot; Business Operations</span>
        <span>Page 1 of 3 &middot; Confidential</span>
      </div>
    </div>
  );
}
window.ReportCoverPage = ReportCoverPage;
