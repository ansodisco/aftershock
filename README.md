# Aftershock — A Seismic Atlas

An interactive research website for the supplied KBTU aftershock prediction project. The original archive is unchanged.

## Preview locally

From this folder run `node server.cjs`, then open http://localhost:4173. The site needs HTTP to load its JSON dataset; opening index.html directly is insufficient.

## Included

- Cinematic landing page with a procedural wireframe landscape and animated seismic signals.
- Interactive coordinate atlas using all 72,284 supplied earthquake records, cumulative year filtering, class/depth coloring, point inspection, and an accessible record selector.
- Annual frequency chart and known-depth distribution calculated from the supplied catalog.
- Real aftershock inference in the browser, editable main-shock inputs, sample loading, UTC timestamp normalization, range warnings, and downloadable predictions.
- Nine-fold validation metrics and downloadable model metadata.
- Methodology explanation based on the original Python model; catalog and model downloads.
- Responsive layouts, visible keyboard focus, and reduced-motion support.

The terrain is an artistic visualization, not measured topography. The atlas uses catalog coordinates, not a live map. The fitted models run locally in the browser; no external API or server inference dependency is required. The catalog's class field is preserved without assuming a magnitude scale. Seconds in the source include values over 59. Inference faithfully preserves the supplied Python SEC_SCALE=1 convention, including rolling excess seconds into subsequent minutes. The underlying data unit is not independently established; do not interpret it as verified forecasting performance. Google Fonts enhance typography when online; system fallbacks are provided.

## Structure

`dist/` contains the deployable static website. `data.json` contains the complete catalog in compact numeric arrays with year, latitude, longitude, depth, class, month, and day. `earthquake-catalog.csv` and `aftershock_model.py` are unchanged copies of the supplied files.

## Reproduce the fitted model

Install numpy, pandas, scikit-learn and lightgbm, then run `python train_web_model.py` from this directory. Training preserves the supplied 9 shuffled folds (seed 42), candidates, feature engineering, target selection metric and delta reconstruction. CPU threads are limited to four. The script fits selected candidates on all 1,250 pairs and exports `dist/model.json` and `dist/model-metadata.json`; training and test files are included for reproducibility.

`node verify-inference.cjs` compares JavaScript features and all five predicted deltas against six Python-generated test fixtures, including sklearn float32 split semantics. Maximum observed absolute delta difference: 4.45e-16. It also checks six invalid inputs and timestamp normalization.

Selected models: time/depth LightGBM, latitude/class equal LightGBM + Random Forest blends, longitude median. Validation MAE: latitude 0.0663 degrees, longitude 0.0891 degrees, depth delta 3.9809 km, class 0.7984 original units; elapsed time 54.15 hours. Selection/reporting reuse the same validation folds; this is not nested validation, an independent holdout, or prospective performance. Unknown depths (-1) remain in training, including depth error calculations. Longitude's selected median delta is zero; no invented location variation is added. No calibrated probability or confidence interval is reported. Predictions estimate paired-event attributes, not earthquake occurrence or warning times.

The static model asset is approximately 14.6 MB and is fetched once per page session, on first prediction. Inputs stay in the browser. To upgrade the raw-second interpretation, first establish its data definition, then retrain and revalidate rather than silently changing it in the UI.
