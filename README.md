Hosts christian.benstein.nl. Setup using: https://docs.codeberg.org/codeberg-pages/using-custom-domain/

## Popovers

`popover.js` turns any link into a hover popover. Short text goes straight on
the link:

```html
<a href="..." data-popover-label="Blog" data-popover="Plain text, or a bit of <em>HTML</em>.">Blog</a>
```

If the popover contains links, put the content in a `<template>` at the bottom
of `index.html` instead (no attribute escaping needed) and point at it:

```html
<a href="..." data-popover-label="DevOps" data-popover-ref="#pop-devops">DevOps</a>

<template id="pop-devops">
  Some text with <a href="https://example.com" target="_blank" rel="noopener noreferrer">a link</a>.
</template>
```

A link *inside* a popover can carry its own `data-popover` / `data-popover-ref`,
which opens a second popover on top of the first. Each level takes the next
Dracula accent colour.

| Attribute | What it does |
| --- | --- |
| `data-popover` | Popover body (inline HTML allowed) |
| `data-popover-ref` | `#id` of a `<template>` holding the body |
| `data-popover-label` | Header text (defaults to the link's own text) |
| `data-popover-accent` | Force a colour, e.g. `#50fa7b` |

Behaviour: opens on hover and on keyboard focus, closes on `Esc`, on click
outside, or when the pointer leaves. Nav buttons open on hover alone; inline
links also get a small `?` marker, which is what makes them tappable on phones.
Without JS the links still work as plain links.

Adding a new nav button? Give it a colour by adding one line to the
`.links > :nth-child(n)` block in `styles.css`.
