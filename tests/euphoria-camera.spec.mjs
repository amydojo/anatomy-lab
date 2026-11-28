import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const samples=[
 {label:'AFTERGLOW-flight-collapse',state:{p:[.1473645267734386,3.185232456605722,-.4328440135923989],n:[-.014559535924296384,.945729078481715,-.3246298353937845],frame:[.9051883557714047,-.12545286626340416,-.4060734156801663],f:[.8933023470220781,.15816407725840786,.42070778631948735],v:[-.0201566391775867,-.0027866178707543123,-.015172730995717492],ground:false,glide:true}},
 {label:'AFTERGLOW-capture-collapse',state:{p:[.1687183612150738,3.129562594517166,-.35940552159126155],n:[-.6008149663811888,.37663530126131367,-.7051008622999767],frame:[.9051883557714047,-.12545286626340416,-.4060734156801663],f:[.5950409303029763,.7997181451965314,-.07985724455294185],v:[.06830316108465939,-.1039333037803761,.16291546495227413],ground:false,glide:true}},
 {label:'AFTERGLOW-retry-stalled-flight',state:{p:[.24692431584919144,3.010088837196958,-.8140008680998547],n:[.6465013375538998,-.0872516708646211,-.757907096201342],frame:[-.6745697232400631,-.5294145388033155,-.5144666506115798],f:[-.06127882608968908,-.9961676491243691,.06240929667202957],v:[0,0,0],ground:false,glide:true}}
];
test('EUPHORIA recorded WebKit cavity poses on actual anatomy',async({page},info)=>{
 test.setTimeout(180000);
 await page.goto('/play/?mode=marrow&vehicle=vector');await page.bringToFront();
 await expect(page.locator('#marrow-hud')).toBeVisible({timeout:120000});
 const result=await page.evaluate(samples=>window.__MARROW__.qualifyCamera(samples,390,664),samples);
 fs.writeFileSync(info.outputPath('euphoria-recorded-anatomy.json'),JSON.stringify(result,null,2));
 console.log('EUPHORIA_ANATOMY',JSON.stringify(result));
 expect(result).toHaveLength(samples.length);
 for(const item of result){expect(item.camera.framed,item.label).toBe(true);expect(item.camera.projection.depth,item.label).toBeGreaterThan(.006);expect(item.camera.controlYaw).toBe(0);}
});
