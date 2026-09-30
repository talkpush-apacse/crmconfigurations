Data table. `variant="report"` follows the report/proposal convention (ink header, zebra rows, hairline border). `variant="sign"` follows the Sign UI convention (`rounded-xl border bg-card`, secondary-color header).

```jsx
<Table variant="report" columns={[{key:'name',label:'Candidate'},{key:'status',label:'Status',render:s=><Badge tone="success">{s}</Badge>}]} rows={data} />
```
