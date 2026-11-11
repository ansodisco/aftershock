const assert=require('node:assert/strict'),fs=require('node:fs'),core=require('./dist/predictor-core.js');
const bundle=JSON.parse(fs.readFileSync('dist/model.json')),fixtures=JSON.parse(fs.readFileSync('inference-fixtures.json'));
let maxError=0;
for(const f of fixtures){const features=core.features(f.input);features.forEach((v,i)=>assert.ok(Math.abs(v-f.features[i])<1e-7,`Feature ${i}`));const p=core.predict(bundle,f.input);for(const k in f.deltas){const error=Math.abs(p.deltas[k]-f.deltas[k]);maxError=Math.max(maxError,error);assert.ok(error<1e-7,`${k}: ${error}`)}assert.ok(p.elapsedSeconds>=0);assert.ok(p.depth>=0)}
for(const update of [{lat:91},{lon:181},{month:2,day:30},{sec:-1},{depth:-.5},{class:NaN}])assert.throws(()=>core.predict(bundle,{...fixtures[0].input,...update}));
assert.equal(new Date(core.timestamp(fixtures[0].input)).toISOString(),'2018-02-14T23:29:25.000Z');
console.log(JSON.stringify({fixtures:fixtures.length,targets:5,maxAbsoluteError:maxError,invalidInputChecks:6,sample:core.predict(bundle,fixtures[0].input)},null,2));
