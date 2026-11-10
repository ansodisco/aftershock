# Aftershock — A Seismic Atlas

A responsive presentation website for the supplied KBTU aftershock prediction project. The original archive is unchanged.

## Preview locally

From this folder run `node server.cjs`, then open http://localhost:4173. The site needs HTTP to load its JSON dataset; opening index.html directly is insufficient.

## Included

- Cinematic landing page with a procedural wireframe landscape and animated seismic signals.
- Interactive coordinate atlas using all 72,284 supplied earthquake records, cumulative year filtering, class/depth coloring, point inspection, and an accessible record selector.
- Annual frequency chart and known-depth distribution calculated from the supplied catalog.
- Methodology explanation based on the original Python model; catalog and model downloads.
- Responsive layouts, visible keyboard focus, and reduced-motion support.

The terrain is an artistic visualization, not measured topography. The atlas uses catalog coordinates, not a live map. No inference service or model accuracy claim is added. The catalog's class field is preserved without assuming a magnitude scale. Seconds in the source include values over 59; this showcase does not convert them or claim a timestamp unit. Google Fonts enhance typography when online; system fallbacks are provided.

## Structure

`dist/` contains the deployable static website. `data.json` contains the complete catalog in compact numeric arrays with year, latitude, longitude, depth, class, month, and day. `earthquake-catalog.csv` and `aftershock_model.py` are unchanged copies of the supplied files.
