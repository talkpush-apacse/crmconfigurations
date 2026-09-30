Centered modal with a dark scrim, used for confirmations like "Sign this document?".

```jsx
<Dialog open={open} title="Confirm signature" onClose={close} footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="cta" onClick={sign}>Sign</Button></>}>
  This action cannot be undone.
</Dialog>
```
