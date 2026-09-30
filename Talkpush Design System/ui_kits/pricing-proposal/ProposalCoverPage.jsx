function ProposalCoverPage() {
  return (
    <div className="context-proposal" style={{ background: '#fff', width: '100%', height: '100%', padding: '64px 70px', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
      <img src="../../assets/logo-mark.jpg" alt="Talkpush" style={{ width: 36, height: 36, borderRadius: 8 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22, maxWidth: 560 }}>
        <div style={{ height: 10, width: 200, borderRadius: 3, background: 'var(--gradient-signature)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-orange)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Pricing proposal</span>
        </div>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1, color: '#000' }}>
          Workforce automation for Concentrix, sourcing through onboarding
        </h1>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Prepared for Concentrix &middot; August 2026</div>
      </div>
      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{ flex: 1, height: 56, background: 'var(--color-green)' }} />
        <div style={{ flex: 1, height: 56, background: 'var(--color-blue)' }} />
        <div style={{ flex: 1, height: 56, background: 'var(--color-pink)' }} />
        <div style={{ flex: 1, height: 56, background: 'var(--color-orange)' }} />
      </div>
    </div>
  );
}
window.ProposalCoverPage = ProposalCoverPage;
