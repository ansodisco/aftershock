(function(root){
  const fields=['year','month','day','hour','min','sec','lat','lon','depth','class'];
  function timestamp(v){return Date.UTC(v.year,v.month-1,v.day,v.hour,v.min)+v.sec*1000}
  function validate(v){
    if(fields.some(k=>!Number.isFinite(v[k])))throw Error('Complete every field with a valid number.');
    const d=new Date(Date.UTC(v.year,v.month-1,v.day));
    if(v.year<1900||v.year>2100||d.getUTCFullYear()!==v.year||d.getUTCMonth()+1!==v.month||d.getUTCDate()!==v.day)throw Error('Enter a valid date between 1900 and 2100.');
    if(v.hour<0||v.hour>23||v.min<0||v.min>59||!Number.isInteger(v.hour)||!Number.isInteger(v.min)||v.sec<0||v.sec>3600)throw Error('Check the time. Source seconds must be between 0 and 3600.');
    if(Math.abs(v.lat)>90||Math.abs(v.lon)>180||v.depth< -1||v.depth>1000||v.depth<0&&v.depth!==-1)throw Error('Use valid coordinates and depth from 0–1000 km, or −1 for unknown.');
  }
  function features(v){
    validate(v);const ts=timestamp(v),d=new Date(ts),doy=Math.floor((Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-Date.UTC(d.getUTCFullYear(),0,1))/86400000)+1;
    const a=2*Math.PI*doy/366,b=2*Math.PI*(d.getUTCHours()+d.getUTCMinutes()/60)/24;
    return [...fields.map(k=>v[k]),ts/1000,Math.sin(a),Math.cos(a),Math.sin(b),Math.cos(b),v.lat*v.lon,v.class*v.depth];
  }
  function evaluate(m,x){
    if(m.kind==='median')return m.value;
    if(m.kind==='blend')return m.models.reduce((a,n)=>a+evaluate(n,x),0)/m.models.length;
    if(m.kind==='lgbm')return m.trees.reduce((a,t)=>{while(t.length>1)t=x[t[0]]<=t[1]?t[2]:t[3];return a+t[0]},0);
    // sklearn forests cast prediction inputs to float32.
    return m.trees.reduce((a,t)=>{let n=0;while(t[0][n]!==-1)n=Math.fround(x[t[2][n]])<=t[3][n]?t[0][n]:t[1][n];return a+t[4][n]},0)/m.trees.length;
  }
  function predict(bundle,v){
    const x=features(v),d=Object.fromEntries(Object.entries(bundle.models).map(([k,m])=>[k,evaluate(m,x)]));
    const elapsedSeconds=Math.max(0,Math.expm1(d.dt));
    const lat=v.lat+d.lat,lon=v.lon+d.lon;
    if(!Number.isFinite(elapsedSeconds)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('The model cannot produce a valid result for these inputs. Try an event closer to the training range.');
    return {timestamp:new Date(Math.round(timestamp(v)+elapsedSeconds*1000)).toISOString(),elapsedSeconds,lat,lon,depth:Math.max(0,v.depth+d.depth),class:v.class+d.class,deltas:d};
  }
  const api={fields,timestamp,features,evaluate,predict,validate};
  if(typeof module!=='undefined')module.exports=api;else root.AftershockModel=api;
})(globalThis);
