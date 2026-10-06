/** The client page of a shared workflow reads in Inter. `contents` keeps the wrapper out of the page layout. */
export default function ClientWorkflowLayout({ children }: { children: React.ReactNode }) {
  return <div className="font-workflow contents">{children}</div>;
}
