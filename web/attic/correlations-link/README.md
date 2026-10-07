# The link to the correlations page (parked)

Parked 2026-10-07 at the author's request. The first of the two arrow links in
`nav.read-next` at the foot of the front page; the Substack link below it stays.

## What was removed

- the `<a class="explore">` in `markup.html`, from `unusual/index.html`

## What was deliberately LEFT in place

`/correlations.html` itself is still built and published -- it is an entry in
`vite.config.ts` and the pipeline still writes its `context.json`. Nothing on
the front page links to it any more, so it is reachable only by its URL. Its
own back-link now points at `/unusual/`.

If the page is to go too, read "The aftershocks page (removed)" in the
top-level README first: a page that is published but unlinked drifts.

## To restore

Put `markup.html` back as the first child of `nav.read-next` in
`unusual/index.html`. The `.explore` styles were never removed. The href is
absolute because the front page moved to `/unusual/`, where the old relative
`correlations.html` would resolve to `/unusual/correlations.html` and 404.
