const rows = [
  { market: 'Colombia', apps: '5,120', rate: '34.0%', status: 'Resolved' },
  { market: 'Philippines', apps: '7,860', rate: '22.0%', status: 'In progress' },
  { market: 'Mexico', apps: '3,410', rate: '24.0%', status: 'In progress' },
  { market: 'Egypt', apps: '2,905', rate: '18.0%', status: 'Aging 14d' },
  { market: 'Kenya', apps: '2,140', rate: '15.0%', status: 'Aging 30d' }
];

const toneFor = s => s === 'Resolved' ? 'success' : s.startsWith('Aging 30') ? 'danger' : s.startsWith('Aging 14') ? 'warning' : 'info';

function StatusPage({ Table, InsightNote, Badge }) {
  const columns = [
    { key: 'market', label: 'Market' },
    { key: 'apps', label: 'Applications' },
    { key: 'rate', label: 'Conversion' },
    { key: 'status', label: 'Status', render: s => <Badge tone={toneFor(s)}>{s}</Badge> }
  ];
  return (
    <div style={{ background: 'var(--color-beige)', width: '100%', height: '100%', padding: '40px 52px', display: 'flex', flexDirection: 'column', gap: 18, fontFamily: 'var(--font-body)' }}>
      <Header />
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Market breakdown</div>
        <h2 style={{ margin: '4px 0 0', fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Two markets need attention on aging applications</h2>
      </div>
      <Table variant="report" columns={columns} rows={rows} />
      <InsightNote accent="var(--color-orange)">Egypt and Kenya are the two markets carrying aged applications past the 14-day mark. Recommend a targeted recruiter push this week.</InsightNote>
      <div style={{ background: '#fff', border: '1px solid var(--border-hairline)', borderRadius: 10, padding: '14px 18px', fontSize: 12, color: 'var(--text-muted)' }}>
        <strong style={{ color: 'var(--text-primary)' }}>Data notes.</strong> Kenya's application count excludes the last three days of the period; the recruiting center's export job was delayed. All other markets are complete through August 14.
      </div>
      <Footer page="3" />
    </div>
  );
}
window.StatusPage = StatusPage;
