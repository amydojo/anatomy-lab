import { defineConfig,devices } from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'*.spec.mjs',timeout:40000,expect:{timeout:7000},fullyParallel:false,retries:1,workers:2,
 reporter:[['list'],['html',{outputFolder:'artifacts/report',open:'never'}]],
 use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',screenshot:'on',video:'retain-on-failure'},
 projects:[
  {name:'chromium-mobile',use:{...devices['iPhone 13'],browserName:'chromium'}},
  {name:'webkit-mobile',use:{...devices['iPhone 13'],browserName:'webkit'}},
  {name:'desktop-chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}}
 ],
 webServer:{command:'python3 -m http.server 4173 --bind 127.0.0.1',port:4173,reuseExistingServer:!process.env.CI,timeout:20000}
});