const { Table, TermItem } = window.TalkpushDesignSystem_0ed2b8;

function ProposalApp() {
  const [page, setPage] = React.useState(0);
  const pages = [<ProposalCoverPage />, <ModulesPage />, <PricingPage Table={Table} TermItem={TermItem} />];
  const labels = ['Cover', 'Modules', 'Pricing & terms'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '30px 0', background: '#e9e6da', minHeight: '100vh' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {labels.map((l, i) => (
          <button key={l} onClick={() => setPage(i)} style={{
            border: 'none', borderRadius: 999, padding: '8px 16px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
            background: page === i ? '#000' : '#fff', color: page === i ? '#fff' : 'var(--text-primary)'
          }}>{l}</button>
        ))}
      </div>
      <div style={{ width: 816, height: 1000, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        {pages[page]}
      </div>
    </div>
  );
}
window.ProposalApp = ProposalApp;
