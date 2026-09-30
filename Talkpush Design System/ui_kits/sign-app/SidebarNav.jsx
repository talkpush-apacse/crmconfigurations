const NAV = [
  { label: 'Inbox', icon: '\u25A3' },
  { label: 'Sent', icon: '\u25B3' },
  { label: 'Templates', icon: '\u25C7' },
  { label: 'Settings', icon: '\u2699' }
];

function SidebarNav({ active, onSelect }) {
  return (
    <div style={{ width: 208, background: 'var(--sign-card)', borderRight: '1px solid var(--sign-border)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 6, background: 'var(--sign-gradient)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 18px 10px' }}>
        <img src="../../assets/logo-mark.jpg" alt="Talkpush" style={{ width: 28, height: 28, borderRadius: 7 }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--sign-foreground)' }}>Sign</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 10px' }}>
        {NAV.map(n => (
          <div key={n.label} onClick={() => onSelect(n.label)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 6, cursor: 'pointer',
            fontSize: 14, fontWeight: 600, color: active === n.label ? 'var(--sign-foreground)' : 'var(--sign-muted-foreground)',
            background: active === n.label ? 'var(--sign-secondary)' : 'transparent'
          }}>
            <span style={{ fontSize: 13, width: 20, textAlign: 'center' }}>{n.icon}</span>{n.label}
          </div>
        ))}
      </div>
    </div>
  );
}
window.SidebarNav = SidebarNav;
