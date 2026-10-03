# Client sanitization

Ask at intake whether the diagram is internal or client-facing. For client-facing work:

- **Never show**: internal system identifiers (campaign ids, autoflow set ids, folder ids), ticket numbers such as `SE-3685`, tenant addresses (`*.talkpush.com`), or an individual staff member's name in fault or escalation text (use the team).
- **Keep**: rejection-reason notes, message descriptions, tags, title, version and date.
- Staff-only content: put it in `internalNotes`, or mark a whole step `visibility: internal`. The server removes internal steps and their connectors from every client page, download and shared link. Feasibility is hidden from clients unless the owner turns it on.
- `validate_workflow` returns a `sanitization` list: text that looks internal. It only reports. Fix with the SE; do not silently delete wording.
- Check with `render_preview` using `audience: client`.
