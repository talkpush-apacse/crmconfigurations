const { Table, Badge, Input, Tabs, Dialog, Button } = window.TalkpushDesignSystem_0ed2b8;

function SignApp() {
  const [active, setActive] = React.useState('Inbox');
  const [doc, setDoc] = React.useState(null);
  return (
    <div className="context-sign" style={{ display: 'flex', minHeight: '100vh', background: 'var(--sign-background)', fontFamily: 'var(--font-body)' }}>
      <SidebarNav active={active} onSelect={setActive} />
      <DocumentList Table={Table} Badge={Badge} Input={Input} Tabs={Tabs} onOpen={setDoc} />
      <Dialog open={!!doc} title={doc ? doc.name : ''} onClose={() => setDoc(null)}
        footer={<><Button variant="ghost" onClick={() => setDoc(null)}>Close</Button><Button variant="cta" onClick={() => setDoc(null)}>Sign document</Button></>}>
        Review the document, then sign to complete this request. This action cannot be undone.
      </Dialog>
    </div>
  );
}
window.SignApp = SignApp;
