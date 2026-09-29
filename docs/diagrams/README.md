# Diagrams

The two figures used in the revised Phase 1 and Phase 2 submission.

| File | Figure | Shows |
| --- | --- | --- |
| `fig1-architecture.svg` / `.png` | Figure 1 | Three-tier system architecture: React client, PHP REST API, MySQL |
| `fig2-erd.svg` / `.png` | Figure 2 | The revised ERD — 15 tables, 24 foreign keys. The database has 17; the figure's own note says which two are left off and why |

## Print ERD (A3)

`erd-a3.pdf` / `erd-a3.png` / `erd-a3.svg` / `erd.mmd` are generated, not
drawn: `python scripts/erd.py` reads tables, columns, types, keys and foreign
keys from `information_schema`, refuses to draw unless they match
`database/schema.sql` exactly, and fails if any foreign key has no line or any
line has no foreign key. Every column is shown, in `DESCRIBE` order. Print the
PDF on A3 landscape at 100% (actual size); everything sits at least 7 mm
inside the edge. `erd.mmd` is the same diagram as Mermaid, for editing
elsewhere. Rerun the script after any schema change; do not edit its outputs.

`fig2` below is the hand-drawn figure from the Phase 1/2 submission. It
summarises some columns (for example `latitude / longitude`), so use the A3
ERD when comparing against the database.

## Submission figures

The SVGs are the source; edit those, not the PNGs. To regenerate a PNG after
editing:

```
python -c "import pymupdf; pymupdf.open('fig2-erd.svg')[0].get_pixmap(dpi=110).save('fig2-erd.png')"
```

Both were drawn from the live schema (`information_schema`) and the endpoint
list in `api/README.md`, so they describe what is actually built rather than
what was planned. If the schema changes, these need updating with it.

The ERD is placed on a landscape page in the submission document — at portrait
width the field names are not legible.
