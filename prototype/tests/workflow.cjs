const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const url=pathToFileURL(path.join(__dirname,'..','index.html')).href;
const screenshots=fs.mkdtempSync(path.join(os.tmpdir(),'bento-workflow-'));
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,...(process.env.BENTO_CHROME_PATH ? {executablePath:process.env.BENTO_CHROME_PATH} : {})});
 const page=await browser.newPage({viewport:{width:1024,height:900}});
 page.setDefaultTimeout(8000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);
 await page.getByRole('button',{name:'Meeting note',exact:true}).click();
 const editor=page.getByRole('textbox',{name:'Meeting Markdown'});
 const original=await editor.inputValue();
 assert.match(original,/- \[ \] Review the marked-up plan/);
 assert.equal(await page.getByRole('button',{name:'Add checkbox',exact:true}).count(),0);
 await editor.fill(original+'\n- [ ] New direct action (due 2026-10-21)\n  - [ ] Nested action\n\n```md\n- [ ] Fenced sample\n```\n\n    - [ ] Indented sample\n\n<div>\n- [ ] HTML sample\n</div>\n');
 assert.match(await page.locator('#b-task-count').innerText(),/5 tracked todos/);
 await page.getByRole('button',{name:'Daily overview',exact:true}).click();
 assert.equal(await page.getByRole('checkbox',{name:'Complete New direct action',exact:true}).count(),1);
 assert.equal(await page.getByRole('checkbox',{name:'Complete Nested action',exact:true}).count(),1);
 assert.equal(await page.getByRole('checkbox',{name:'Complete Fenced sample',exact:true}).count(),0);
 await page.getByRole('checkbox',{name:'Complete New direct action',exact:true}).click();
 await page.getByRole('button',{name:'Meeting note',exact:true}).click();
 assert.match(await editor.inputValue(),/- \[x\] New direct action/);
 await page.getByRole('button',{name:'Read',exact:true}).click();
 assert.equal(await page.getByRole('checkbox',{name:'Complete New direct action',exact:true}).isChecked(),true);
 assert.equal(await page.locator('#b-reading').locator('script,img').count(),0);
 assert.match(await page.locator('#b-reading pre').first().innerText(),/^- \[ \] Fenced sample$/m);
 await page.getByRole('checkbox',{name:'Complete New direct action',exact:true}).click();
 await page.getByRole('button',{name:'Write Markdown',exact:true}).click();
 assert.match(await editor.inputValue(),/- \[ \] New direct action/);
 const special='# Test\n\n- [ ] Repeated\n- [ ] Repeated\n> - [ ] Quoted action\n1. [ ] Ordered action\n\n```\n- [ ] Repeated\n```\n';
 await editor.fill(special);
 await page.getByRole('button',{name:'Daily overview',exact:true}).click();
 await page.getByRole('checkbox',{name:'Complete Repeated',exact:true}).nth(1).click();
 await page.getByRole('button',{name:'Meeting note',exact:true}).click();
 assert.match(await editor.inputValue(),/- \[ \] Repeated\n- \[x\] Repeated/);
 await editor.fill('# Safe\n\n<img src=x onerror="window.bentoBad=true">\n\n- [ ] Safe action\n');
 await page.getByRole('button',{name:'Read',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.bentoBad),undefined);
 assert.equal(await page.locator('#b-reading img').count(),0);
 await page.getByRole('button',{name:'Write Markdown',exact:true}).click();
 await editor.fill(original);
 await page.getByRole('button',{name:'Preview agent suggestion',exact:true}).click();
 await page.getByRole('button',{name:'Insert Markdown checkbox',exact:true}).click();
 assert.match(await editor.inputValue(),/- \[ \] Prepare an agenda/);
 await page.getByRole('button',{name:'Undo last change',exact:true}).click();
 assert.equal(await editor.inputValue(),original);
 for(const width of [320,736,1024]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Overflow '+width);
 }
 await page.getByRole('button',{name:'Read',exact:true}).click();
 await page.screenshot({path:path.join(screenshots,'read.png'),fullPage:true});
 await page.getByRole('button',{name:'Write Markdown',exact:true}).click();
 await page.screenshot({path:path.join(screenshots,'write.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Passed Markdown capture, nested/quoted/ordered tasks, code and HTML exclusion, duplicate-task targeting, bidirectional source completion, escaping, agent insertion, undo, and responsive layouts.');

 const context=await browser.newContext({timezoneId:'America/Los_Angeles',viewport:{width:1024,height:900}});
 const profilePage=await context.newPage();
 await profilePage.clock.install({time:new Date('2026-10-19T19:00:00Z')});
 await profilePage.addInitScript(()=>{window.bentoSent=[];window.openai={setWidgetState:async value=>{window.bentoSent.push(value);}};});
 await profilePage.goto(url);
 await profilePage.getByRole('heading',{name:'Hello, Makena',exact:true}).waitFor();
 await profilePage.getByRole('button',{name:'Profile',exact:true}).click();
 assert.equal(await profilePage.getByLabel('Last name',{exact:true}).inputValue(),'');
 assert.equal(await profilePage.getByLabel('Birthday',{exact:true}).inputValue(),'');
 await profilePage.getByLabel('First name',{exact:true}).fill('Makena');
 await profilePage.getByLabel('Last name',{exact:true}).fill('Example');
 await profilePage.getByLabel('Birthday',{exact:true}).fill('1990-10-19');
 await profilePage.getByRole('button',{name:'Save profile',exact:true}).click();
 await profilePage.getByRole('heading',{name:'hbd Makena!',exact:true}).waitFor();
 assert.match(await profilePage.locator('#b-status').innerText(),/Profile saved/);
 const saved=await profilePage.evaluate(()=>JSON.parse(localStorage.getItem(BentoProfile.key)));
 assert.deepEqual(saved,{version:1,firstName:'Makena',lastName:'Example',birthday:'1990-10-19'});
 const outbound=await profilePage.evaluate(()=>JSON.stringify(window.bentoSent));
 assert.equal(outbound.includes('1990-10-19'),false);
 assert.equal(outbound.includes('Example'),false);
 await profilePage.reload();
 await profilePage.getByRole('heading',{name:'hbd Makena!',exact:true}).waitFor();
 await profilePage.clock.setSystemTime(new Date('2026-10-20T19:00:00Z'));
 await profilePage.clock.runFor(60_001);
 await profilePage.getByRole('heading',{name:'Hello, Makena',exact:true}).waitFor();
 const dateCases=await profilePage.evaluate(()=>{
   const profile={version:1,firstName:'Sam',lastName:'',birthday:'2000-02-29'};
   return [
     BentoProfile.greeting(profile,new Date('2028-02-29T12:00:00')),
     BentoProfile.greeting(profile,new Date('2027-02-28T12:00:00')),
     BentoProfile.validate({...profile,birthday:'2001-02-29'}),
     BentoProfile.validate({...profile,birthday:'2100-01-01'}),
     BentoProfile.validate({...profile,firstName:'   '})
   ];
 });
 assert.deepEqual(dateCases,['hbd Sam!','Hello, Sam',false,false,false]);
 await profilePage.getByRole('button',{name:'Profile',exact:true}).click();
 await profilePage.getByLabel('First name',{exact:true}).fill('Maki');
 await profilePage.getByLabel('Birthday',{exact:true}).fill('');
 await profilePage.getByRole('button',{name:'Save profile',exact:true}).click();
 await profilePage.getByRole('heading',{name:'Hello, Maki',exact:true}).waitFor();
 await profilePage.getByRole('button',{name:'Profile',exact:true}).click();
 for(const width of [320,736,1024]){
   await profilePage.setViewportSize({width,height:900});
   assert.equal(await profilePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Profile overflow '+width);
 }
 await profilePage.screenshot({path:path.join(screenshots,'profile.png'),fullPage:true});
 await profilePage.getByRole('button',{name:'Back to overview',exact:true}).click();
 await profilePage.screenshot({path:path.join(screenshots,'daily.png'),fullPage:true});
 const blocked=await context.newPage();
 await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Unavailable');}}));
 await blocked.goto(url);
 await blocked.getByRole('button',{name:'Profile',exact:true}).click();
 await blocked.getByLabel('First name',{exact:true}).fill('Session user');
 await blocked.getByRole('button',{name:'Save profile',exact:true}).click();
 await blocked.getByRole('heading',{name:'Hello, Session user',exact:true}).waitFor();
 assert.match(await blocked.locator('#b-status').innerText(),/storage is unavailable/);
 console.log('Passed profile persistence/clear/edit, birthday and normal greetings, local date change, leap-day handling, date validation, blocked-storage fallback, no profile in host snapshots, and profile responsive widths.');
 await context.close();

})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();});
