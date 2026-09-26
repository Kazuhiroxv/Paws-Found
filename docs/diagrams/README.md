# Diagrams

The two figures used in the revised Phase 1 and Phase 2 submission.

| File | Figure | Shows |
| --- | --- | --- |
| `fig1-architecture.svg` / `.png` | Figure 1 | Three-tier system architecture: React client, PHP REST API, MySQL |
| `fig2-erd.svg` / `.png` | Figure 2 | The revised ERD — 14 tables, 23 foreign keys |

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
