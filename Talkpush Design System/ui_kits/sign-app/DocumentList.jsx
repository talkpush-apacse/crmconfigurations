const DOCS = [
  { name: 'Offer letter — Maria Santos', sent: 'Aug 12', status: 'Completed' },
  { name: 'NDA — Contractor batch 3', sent: 'Aug 12', status: 'Pending' },
  { name: 'Background check consent — J. Cruz', sent: 'Aug 11', status: 'Viewed' },
  { name: 'Offer letter — Ana Reyes', sent: 'Aug 10', status: 'Voided' },
  { name: 'Onboarding packet — Q3 cohort', sent: 'Aug 9', status: 'Completed' }
];

const toneFor = s => ({ Completed: 'success', Pending: 'attention', Viewed: 'info', Voided: 'neutral' }[s] || 'neutral');

function DocumentList({ Table, Badge, Input, Tabs, onOpen }) {
  return (
    <div style={{ flex: 1, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--sign-muted-foreground)' }}>Inbox</div>
          <h1 style={{ margin: '2px 0 0', fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 700, color: 'var(--sign-foreground)' }}>Documents</h1>
        </div>
        <div style={{ width: 220 }}><Input placeholder="Search documents" /></div>
      </div>
      <Tabs items={[{ label: 'All', value: 'all' }, { label: 'Pending signature', value: 'pending' }, { label: 'Completed', value: 'done' }]} />
      <div className="context-sign" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <Table variant="sign"
          columns={[
            { key: 'name', label: 'Document' },
            { key: 'sent', label: 'Sent' },
            { key: 'status', label: 'Status', render: s => <Badge tone={toneFor(s)}>{s}</Badge> }
          ]}
          rows={DOCS.map(d => ({ ...d, name: <span onClick={() => onOpen(d)} style={{ cursor: 'pointer', fontWeight: 600 }}>{d.name}</span> }))}
        />
      </div>
    </div>
  );
}
window.DocumentList = DocumentList;
