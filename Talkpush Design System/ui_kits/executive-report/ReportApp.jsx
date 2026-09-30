const { KpiCard, InsightNote, ChevronFlow, Table, Badge, AccentSquares } = window.TalkpushDesignSystem_0ed2b8;

function ReportApp() {
  const [page, setPage] = React.useState(0);
  const pages = [
    <ReportCoverPage AccentSquares={AccentSquares} />,
    <FunnelPage KpiCard={KpiCard} InsightNote={InsightNote} ChevronFlow={ChevronFlow} />,
    <StatusPage Table={Table} InsightNote={InsightNote} Badge={Badge} />
  ];
  const labels = ['Cover', 'Funnel', 'Market status'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '30px 0', background: '#e9e6da', minHeight: '100vh' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {labels.map((l, i) => (
          <button key={l} onClick={() => setPage(i)} style={{
            border: 'none', borderRadius: 999, padding: '8px 16px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
            background: page === i ? 'var(--color-ink)' : '#fff', color: page === i ? '#fff' : 'var(--text-primary)'
          }}>{l}</button>
        ))}
      </div>
      <div style={{ width: 794, height: 1000, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        {pages[page]}
      </div>
    </div>
  );
}
window.ReportApp = ReportApp;
