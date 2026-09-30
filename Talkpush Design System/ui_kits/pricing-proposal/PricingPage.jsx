function PricingPage({ Table, TermItem }) {
  const columns = [
    { key: 'tier', label: 'Tier' },
    { key: 'module', label: 'Module' },
    { key: 'price', label: 'Monthly' }
  ];
  const rows = [
    { tier: 'Tier 1', module: 'Sourcing', price: '$4,200' },
    { tier: 'Tier 2', module: 'Manage & Convert', price: '$6,800' },
    { tier: 'Tier 3', module: 'Hire & Onboard', price: '$3,900' }
  ];
  return (
    <div className="context-proposal" style={{ background: '#fff', width: '100%', height: '100%', padding: '48px 56px', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'var(--font-body)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-orange)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Pricing</span>
      </div>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: '#000' }}>Three modules, one monthly rate</h2>
      <Table variant="report" columns={columns} rows={rows} />
      <div style={{ borderRadius: 10, padding: '18px 22px', background: 'var(--gradient-signature)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#000' }}>Total monthly investment</span>
        <span className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#000' }}>$14,900</span>
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <TermItem label="Contract length" value="12 months" featured />
        <TermItem label="Onboarding support included" included />
      </div>
    </div>
  );
}
window.PricingPage = PricingPage;
