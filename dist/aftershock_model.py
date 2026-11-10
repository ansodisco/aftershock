"""
Earthquake Aftershock Prediction - multi-output regression, metric = MAE.

Key ideas
---------
1. Predict DELTAS relative to the main shock (dt, dlat, dlon, ddepth, dclass),
   not absolute values. The aftershock is usually close to the main shock, so
   deltas are small and much easier to learn.
2. The metric is MAE -> the optimal prediction is the conditional MEDIAN.
   So we use L1 objectives (LightGBM objective='l1') and a median baseline.
3. Time delta is heavy-tailed -> model log1p(dt). The median is invariant
   under monotonic transforms, so expm1(median(log)) = median(dt).
4. Several candidates (median baseline, LightGBM-L1, RandomForest, blend) are
   compared with out-of-fold CV for EACH target; the best one is used.
5. Predicted time = main time + dt, then decomposed into 6 columns.

Install:  pip install pandas numpy scikit-learn lightgbm
Run:      python aftershock_model.py
"""
import warnings
import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import KFold

warnings.filterwarnings("ignore")

# ----------------------------- CONFIG ---------------------------------------
TRAIN_PATH = "train.csv"
TEST_PATH = "test.csv"
OUT_PATH = "submission.csv"
ID = "id_eq"
SEC_SCALE = 1.0   # set to 0.001 if 'sec' is stored in milliseconds in the data
N_FOLDS = 9
SEED = 42

TIME = ["year", "month", "day", "hour", "min", "sec"]
GEO = ["lat", "lon", "depth", "class"]
ALL = TIME + GEO
TARGETS = ["dt", "lat", "lon", "depth", "class"]  # what we actually model


# ----------------------------- HELPERS --------------------------------------
def to_time(df, suffix=""):
    base = pd.to_datetime(pd.DataFrame({
        "year": df["year" + suffix], "month": df["month" + suffix],
        "day": df["day" + suffix], "hour": df["hour" + suffix],
        "minute": df["min" + suffix]}))
    return base + pd.to_timedelta(df["sec" + suffix].values * SEC_SCALE, unit="s")


def make_features(df):
    t = to_time(df)
    X = pd.DataFrame(index=df.index)
    for c in ALL:
        X[c] = df[c].values
    X["ts"] = (t - pd.Timestamp("1970-01-01")).dt.total_seconds().values
    doy = t.dt.dayofyear.values
    hfrac = (t.dt.hour + t.dt.minute / 60).values
    X["doy_sin"], X["doy_cos"] = np.sin(2 * np.pi * doy / 366), np.cos(2 * np.pi * doy / 366)
    X["h_sin"], X["h_cos"] = np.sin(2 * np.pi * hfrac / 24), np.cos(2 * np.pi * hfrac / 24)
    X["lat_x_lon"] = df["lat"].values * df["lon"].values
    X["class_x_depth"] = df["class"].values * df["depth"].values
    return X


def time_columns(main_time, dt):
    """main time + dt seconds -> 6 submission columns."""
    t = (main_time.values + pd.to_timedelta(np.maximum(dt, 0), unit="s").values)
    t = pd.Series(pd.to_datetime(t)).dt.round("ms")
    return pd.DataFrame({
        "year": t.dt.year, "month": t.dt.month, "day": t.dt.day,
        "hour": t.dt.hour, "min": t.dt.minute,
        "sec": (t.dt.second + t.dt.microsecond / 1e6) / SEC_SCALE})


def time_mae(true_df, main_time, dt):
    rec = time_columns(main_time, dt)
    return float(np.mean([np.abs(rec[c].values - true_df[c + "_as"].values).mean()
                          for c in TIME]))


class MedianModel:
    def fit(self, X, y):
        self.m = float(np.median(y)); return self
    def predict(self, X):
        return np.full(len(X), self.m)


MODELS = {
    "median": lambda: MedianModel(),
    "lgbm_l1": lambda: lgb.LGBMRegressor(
        objective="l1", n_estimators=500, learning_rate=0.03, num_leaves=15,
        min_child_samples=10, subsample=0.8, subsample_freq=1,
        colsample_bytree=0.8, random_state=SEED, verbose=-1),
    "rf": lambda: RandomForestRegressor(
        n_estimators=400, min_samples_leaf=3, max_features=0.7,
        n_jobs=-1, random_state=SEED),
}


# ----------------------------- LOAD -----------------------------------------
train = pd.read_csv(TRAIN_PATH)
test = pd.read_csv(TEST_PATH)

need_main = ALL
need_tgt = [c + "_as" for c in ALL]
missing = [c for c in need_main if c not in train.columns] + \
          [c for c in need_tgt if c not in train.columns]
if missing:
    raise SystemExit(f"Columns not found in train.csv: {missing}\n"
                     f"Available: {list(train.columns)}\n"
                     f"-> rename columns in the CSV or edit TIME/GEO at the top.")

main_time_tr = to_time(train)
main_time_te = to_time(test)
X = make_features(train)
Xte = make_features(test)

# deltas (targets for the models)
dt_sec = (to_time(train, "_as") - main_time_tr).dt.total_seconds().values
Y = {
    "dt": np.log1p(np.clip(dt_sec, 0, None)),
    "lat": train["lat_as"].values - train["lat"].values,
    "lon": train["lon_as"].values - train["lon"].values,
    "depth": train["depth_as"].values - train["depth"].values,
    "class": train["class_as"].values - train["class"].values,
}

# ----------------------------- CROSS-VALIDATION -----------------------------
kf = KFold(N_FOLDS, shuffle=True, random_state=SEED)
oof = {tg: {m: np.zeros(len(X)) for m in MODELS} for tg in TARGETS}

for tr, va in kf.split(X):
    for tg in TARGETS:
        for name, make in MODELS.items():
            mdl = make().fit(X.iloc[tr], Y[tg][tr])
            oof[tg][name][va] = mdl.predict(X.iloc[va])

for tg in TARGETS:
    oof[tg]["blend"] = 0.5 * oof[tg]["lgbm_l1"] + 0.5 * oof[tg]["rf"]


def score(tg, pred):
    if tg == "dt":
        return time_mae(train, main_time_tr, np.expm1(pred))
    return float(np.abs(pred - Y[tg]).mean())


best = {}
print("\nCV scores (lower is better)")
for tg in TARGETS:
    scores = {m: score(tg, p) for m, p in oof[tg].items()}
    best[tg] = min(scores, key=scores.get)
    print(f"  {tg:6s} " + "  ".join(f"{m}={s:.4f}" for m, s in scores.items())
          + f"   -> {best[tg]}")

# overall CV metric on the 10 submission columns
final_oof = {tg: oof[tg][best[tg]] for tg in TARGETS}
rec = time_columns(main_time_tr, np.expm1(final_oof["dt"]))
col_err = {c: np.abs(rec[c].values - train[c + "_as"].values).mean() for c in TIME}
for g in GEO:
    col_err[g] = np.abs(final_oof[g] - Y[g]).mean()
print("\nPer-column CV MAE:", {k: round(v, 4) for k, v in col_err.items()})
print(f"Overall CV MAE (mean of 10 columns): {np.mean(list(col_err.values())):.4f}")

# ----------------------------- FIT ON ALL + PREDICT -------------------------
test_pred = {}
for tg in TARGETS:
    if best[tg] == "blend":
        a = MODELS["lgbm_l1"]().fit(X, Y[tg]).predict(Xte)
        b = MODELS["rf"]().fit(X, Y[tg]).predict(Xte)
        test_pred[tg] = 0.5 * a + 0.5 * b
    else:
        test_pred[tg] = MODELS[best[tg]]().fit(X, Y[tg]).predict(Xte)

sub = pd.DataFrame({ID: test[ID].values})
tc = time_columns(main_time_te, np.expm1(test_pred["dt"]))
for c in ["year", "month", "day", "hour", "min"]:
    sub[c + "_as"] = tc[c].values.astype(int)
sub["sec_as"] = tc["sec"].values.round(3)
sub["lat_as"] = test["lat"].values + test_pred["lat"]
sub["lon_as"] = test["lon"].values + test_pred["lon"]
sub["depth_as"] = np.clip(test["depth"].values + test_pred["depth"], 0, None)
sub["class_as"] = test["class"].values + test_pred["class"]

sub.to_csv(OUT_PATH, index=False)
print(f"\nSaved {OUT_PATH} ({len(sub)} rows)")
