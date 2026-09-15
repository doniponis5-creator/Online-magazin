const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 fs.mkdirSync('review/home-story',{recursive:true});
 const results=[];
 for(const [label,width,height,lang] of [['desktop',1440,1000,'ru'],['mobile',390,844,'ru'],['small-ky',360,640,'ky']]) {
  const page=await browser.newPage({viewport:{width,height}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://localhost:3100/${lang}`); await page.locator('.home-story[data-enhanced]').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  for(const p of [0,.45,1,.45,0]) {
   await page.locator('.home-story').evaluate((el,p)=>{
    const stage=el.querySelector('.home-story__stage');
    const top=parseFloat(getComputedStyle(el).getPropertyValue('--story-top'));
    window.scrollTo(0,el.getBoundingClientRect().top+scrollY-top+p*(el.offsetHeight-stage.offsetHeight));
   },p);
   await page.waitForTimeout(100);
   const state=await page.locator('.home-story').evaluate(el=>({p:Number(el.dataset.progress),title:el.querySelector('h1').textContent,overflow:document.documentElement.scrollWidth>innerWidth,cta:el.querySelector('a').getBoundingClientRect().bottom,stage:el.querySelector('.home-story__stage').getBoundingClientRect().bottom}));
   assert(!state.overflow); assert(Math.abs(state.p-p)<.02); assert(state.cta<state.stage);
   await page.screenshot({path:`review/home-story/${label}-${p}.png`});
   results.push({label,...state});
  }
  await page.locator('.home-story__cta').click();
  await page.waitForURL('**/catalog?cat=home');
  assert.equal(errors.length,0); await page.close();
 }
 for(const mode of ['reduced','nojs','missing-image']) {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:mode==='reduced'?'reduce':'no-preference',javaScriptEnabled:mode!=='nojs'});
  const page=await context.newPage();
  if(mode==='missing-image') await page.route('**/home-story/home-awakens.png',route=>route.abort());
  await page.goto('http://localhost:3100/ru');
  assert(await page.locator('.home-story__cta').isVisible());
  if(mode!=='missing-image') assert.equal(await page.locator('.home-story__stage').evaluate(el=>getComputedStyle(el).position),'relative');
  await page.screenshot({path:`review/home-story/${mode}.png`});
  await context.close();
 }
 fs.writeFileSync('review/home-story/results.json',JSON.stringify(results,null,2));
 await browser.close(); console.log('PASS: 3 viewports, forward/back scroll, CTA, reduced motion, no JS and image failure.');
})().catch(e=>{console.error(e);process.exit(1)});
