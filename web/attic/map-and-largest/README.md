# The map and the list of largest earthquakes (parked)

Parked 2026-08-23. Destined for a page of its own.

## Contents

- `markup.html`  the `.map-row` block from index.html: the map figure and the
                 `.largest` aside beside it
- `logic.ts`     writeMap / writeLargest and the map section of src/main.ts
- `styles.css`   .map-row, .map-figure, #map, .largest*, .legend

`src/map.ts` is untouched -- `loadLand` and `renderMap` are a module of their
own and will be wanted again. The land topology asset likewise.

## To restore

Put the markup back inside the panel, restore the element lookups in `el`
(`map`, `mapTitle`, `mapLegend`, `largest`, `largestHeading`, `largestNote`,
`sort`), and call writeMap/writeLargest from `update()` again. The sort control
(`SORT_MODES`, `#sort-control`) belongs to the list, not to the page.
