"""Reproduce supplied nine-fold model selection and export browser inference assets.
Run with numpy, pandas, scikit-learn and lightgbm installed, from this directory.
"""
from pathlib import Path
import json, gzip
source = Path('dist/aftershock_model.py').read_text(encoding='utf-8')
# Bound CPU threads; estimator parameters and validation remain the supplied ones.
source = source.replace('verbose=-1)', 'verbose=-1, n_jobs=4)')
source = source.replace('n_jobs=-1,', 'n_jobs=4,')
exec(compile(source, 'aftershock_model.py', 'exec'))

def export(m):
    if isinstance(m, MedianModel): return {'kind':'median','value':m.m}
    if isinstance(m, lgb.LGBMRegressor):
        def node(n):
            if 'leaf_value' in n: return [n['leaf_value']]
            assert n['decision_type'] == '<='
            return [n['split_feature'],n['threshold'],node(n['left_child']),node(n['right_child'])]
        return {'kind':'lgbm','trees':[node(t['tree_structure']) for t in m.booster_.dump_model()['tree_info']]}
    trees=[]
    for est in m.estimators_:
        t=est.tree_
        trees.append([t.children_left.tolist(),t.children_right.tolist(),t.feature.tolist(),t.threshold.tolist(),t.value[:,0,0].tolist()])
    return {'kind':'rf','trees':trees}

models={}; fitted={}
for tg in TARGETS:
    names=['lgbm_l1','rf'] if best[tg]=='blend' else [best[tg]]
    fitted[tg]=[MODELS[n]().fit(X,Y[tg]) for n in names]
    models[tg]={'kind':'blend','models':[export(m) for m in fitted[tg]]} if len(names)==2 else export(fitted[tg][0])
metadata={'trainingPairs':len(train),'folds':N_FOLDS,'seed':SEED,'secondsScale':SEC_SCALE,
          'selected':best,'featureNames':list(X.columns),'ranges':{c:[float(train[c].min()),float(train[c].max())] for c in ALL},
          'mae':{g:float(col_err[g]) for g in GEO},
          'elapsedHoursMAE':float(np.abs(np.expm1(final_oof['dt'])-np.clip(dt_sec,0,None)).mean()/3600),
          'timeSelectionMetric':'Mean MAE across six calendar fields, as supplied; mixed units',
          'validation':'Nine shuffled folds; target selection on the same folds. Not a prospective or independent test.',
          'example':{c:float(test.iloc[0][c]) for c in ALL}}
Path('dist/model.json').write_text(json.dumps({'metadata':metadata,'models':models},separators=(',',':')),encoding='utf-8')
Path('dist/model-metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
fixtures=[]
for i in [0,1,2,15,100,299]:
    fixtures.append({'input':{c:float(test.iloc[i][c]) for c in ALL},'features':Xte.iloc[i].tolist(),
       'deltas':{tg:float(np.mean([m.predict(Xte.iloc[[i]])[0] for m in fitted[tg]])) for tg in TARGETS}})
Path('inference-fixtures.json').write_text(json.dumps(fixtures),encoding='utf-8')
print('Exported',Path('dist/model.json').stat().st_size,'bytes',flush=True)
