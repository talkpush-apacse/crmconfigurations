Intentional addition wrapping the brand's signature decorative motif: "Small rotated squares, 10 to 18px, in the four accent colors... Two to four per page maximum." Absolutely positioned; place it inside a `position: relative` container (a cover or title block), count capped at 4.

```jsx
<div style={{position:'relative'}}><AccentSquares count={3} seed={2} /><h1>Cover title</h1></div>
```
