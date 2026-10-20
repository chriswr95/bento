import { checkQuickOpen } from './quick-open.js';
import { checkShortcuts } from './shortcuts.js';
import { checkColors } from './colors.js';
import { checkThemes } from './themes.js';
import { checkProperties } from './properties.js';
import { serve } from '../../scripts/serve.js';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
const server = await serve(), url = server.url;
const screenshots = process.env.BENTO_SCREENSHOT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'bento-rich-'));
fs.mkdirSync(screenshots, { recursive: true });
let browser;
async function paste(editor, text, html = '') {
  await editor.evaluate((element, data) => {
    const clipboardData = new DataTransfer(); clipboardData.setData('text/plain', data.text);
    if (data.html) clipboardData.setData('text/html', data.html);
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  }, { text, html });
}
(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.BENTO_CHROME_PATH ? { executablePath: process.env.BENTO_CHROME_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 }, acceptDownloads: true }); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('bento.prototype.workspace.v4')));
  const findTask = (value, title) => Object.values(value.workspace.records).find(record => record.database === 'db-todos' && record.title === title);
  await page.goto(url); await page.getByRole('button', { name: 'Meeting note', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Meeting Markdown', exact: true });
  assert.equal(await editor.getAttribute('contenteditable'), 'true');
  assert.equal(await page.locator('#b-reading textarea').count(), 0);
  const before = (await stored())?.workspace.records.coordination.body;
  await editor.locator('h1').click();
  assert.equal(await editor.locator('h1').count(), 1);
  if (before) assert.equal((await stored()).workspace.records.coordination.body, before);
  await editor.press('ControlOrMeta+End'); await editor.press('Enter');
  await editor.pressSequentially('## Follow-up'); await editor.press('Space');
  // A heading shortcut applies as soon as '# ' is typed at the start of a paragraph.
  await editor.press('ControlOrMeta+a'); await paste(editor, '# Meeting\n\nA paragraph with **bold**, *italic*, and `code`.\n\nSecond paragraph.\n');
  await editor.locator('strong').filter({ hasText: 'bold' }).waitFor();
  assert.equal(await editor.locator('em').innerText(), 'italic');
  assert.equal(await editor.locator('code').innerText(), 'code');
  // A real selection spans blocks and replacement can be undone/redone.
  await editor.evaluate(element => {
    const paragraphs = element.querySelectorAll('p'), range = document.createRange();
    range.setStart(paragraphs[0].firstChild, 2); range.setEnd(paragraphs[1].firstChild, 6);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  });
  await editor.pressSequentially('Replacement');
  assert.match(await editor.innerText(), /Replacement/);
  await editor.press('ControlOrMeta+z');
  await editor.locator('p').filter({ hasText: 'Second paragraph.' }).waitFor();
  await editor.press('ControlOrMeta+Shift+z'); assert.match(await editor.innerText(), /Replacement/);
  await editor.press('ControlOrMeta+z');
  await editor.press('ControlOrMeta+End'); await editor.press('Enter');
  await editor.pressSequentially('# '); await editor.pressSequentially('Typed heading');
  await editor.getByRole('heading', { name: 'Typed heading', exact: true }).waitFor();
  await editor.press('Enter'); await editor.pressSequentially('**Typed bold**');
  await editor.locator('strong').filter({ hasText: 'Typed bold' }).waitFor();
  await editor.press('Enter'); await editor.pressSequentially('[] '); await editor.pressSequentially('Rich action');
  const task = findTask(await stored(), 'Rich action'); assert.ok(task);
  await editor.press('ControlOrMeta+z'); await editor.press('ControlOrMeta+Shift+z');
  assert.equal(Object.values((await stored()).workspace.records).filter(record=>record.title==='Rich action').length,1);
  assert.ok((await stored()).workspace.records.coordination.body.includes(task.id));

  await editor.pressSequentially(' revised');
  assert.equal(findTask(await stored(), 'Rich action revised').id, task.id);
  await editor.press('Enter'); await editor.pressSequentially('Second action');
  assert.ok(findTask(await stored(), 'Second action'));
  // A complete task's serialized HTML keeps its navigation identity on paste.
  const clipboard = { text: 'Rich action revised', html: `<ul><li data-bento-checked="false" data-bento-href="${task.id}.md"><p>Rich action revised</p></li></ul>` };
  await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await editor.press('Enter');
  await paste(editor, clipboard.text, clipboard.html);
  assert.equal(Object.values((await stored()).workspace.records).filter(record=>record.id===task.id).length,1);
  const opens = page.getByRole('button', { name: 'Open Rich action revised', exact: true }); await opens.first().click();
  const todoEditor = page.getByRole('textbox', { name: 'Todo Markdown', exact: true });
  await todoEditor.click(); await todoEditor.press('ControlOrMeta+a'); await paste(todoEditor, '# Supporting notes\n\nRich context with **important details**.\n');
  await todoEditor.locator('strong').filter({ hasText: 'important details' }).waitFor();
  await page.getByRole('checkbox', { name: 'Completed', exact: true }).click();
  await page.getByRole('button', { name: 'Back to Weekly coordination', exact: true }).click();
  assert.equal(await page.getByRole('checkbox', { name: 'Complete Rich action revised', exact: true }).first().isChecked(), true);
  await page.getByRole('checkbox', { name: 'Complete Rich action revised', exact: true }).first().click();
  assert.equal(findTask(await stored(), 'Rich action revised').properties['field-task-status'], 'option-open');
  await page.reload();
  await page.getByRole('button', { name: 'Open Rich action revised', exact: true }).first().click();
  assert.match(await page.locator('#b-reading').innerText(), /important details/);
  await page.locator('summary[aria-label="Document actions"]').click();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download Markdown', exact: true }).click();
  const download = await downloadPromise;
  assert.match(fs.readFileSync(await download.path(), 'utf8'), /\*\*important details\*\*/);
  await todoEditor.press('ControlOrMeta+End'); await todoEditor.press('Enter');
  await paste(todoEditor, 'Safe text', '<script>window.bentoBad=true</script><p>Safe <strong>text</strong><img src=x onerror="window.bentoBad=true"></p>');
  assert.equal(await page.evaluate(() => window.bentoBad), undefined); assert.equal(await page.locator('#b-reading img').count(), 0);
  await page.locator('#bento-workflow').screenshot({ path: path.join(screenshots, 'rich-editor.png') });
  for (const width of [320, 736, 1024]) { await page.setViewportSize({ width, height: 900 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Overflow ' + width); }
  assert.deepEqual(errors, []);
  console.log('Passed formatted contenteditable editing, cross-block selection/replacement, undo/redo, Markdown shortcuts/paste, stable todo identity, completion, supporting notes, restart, export, safe HTML paste, and responsive widths.');
 const context=await browser.newContext({timezoneId:'America/Los_Angeles',viewport:{width:1024,height:900}});
 const profilePage=await context.newPage();
 await profilePage.clock.install({time:new Date('2026-10-19T19:00:00Z')});
 await profilePage.addInitScript(()=>{window.bentoSent=[];window.openai={setWidgetState:async value=>{window.bentoSent.push(value);}};});
 await profilePage.goto(url);
 await profilePage.getByRole('heading',{name:'Hello, Makena',exact:true}).waitFor();
 await profilePage.getByRole('button',{name:'Settings',exact:true}).click();
 assert.equal(await profilePage.getByLabel('Last name',{exact:true}).inputValue(),'');
 assert.equal(await profilePage.getByLabel('Birthday',{exact:true}).inputValue(),'');
 await profilePage.getByLabel('First name',{exact:true}).fill('Makena');
 await profilePage.getByLabel('Last name',{exact:true}).fill('Example');
 await profilePage.getByLabel('Birthday',{exact:true}).fill('1990-10-19');
 await profilePage.getByRole('button',{name:'Save profile',exact:true}).click();
 await profilePage.getByRole('heading',{name:'hbd Makena!',exact:true}).waitFor();
 assert.match(await profilePage.locator('#b-status').innerText(),/Profile saved/);
 const saved=await profilePage.evaluate(()=>JSON.parse(localStorage.getItem('bento.prototype.profile.v1')));
 assert.deepEqual(saved,{version:1,firstName:'Makena',lastName:'Example',birthday:'1990-10-19'});
 const outbound=await profilePage.evaluate(()=>JSON.stringify(window.bentoSent));
 assert.equal(outbound.includes('1990-10-19'),false);
 assert.equal(outbound.includes('Example'),false);
 await profilePage.reload();
 await profilePage.getByRole('heading',{name:'hbd Makena!',exact:true}).waitFor();
 await profilePage.clock.setSystemTime(new Date('2026-10-20T19:00:00Z'));
 await profilePage.clock.runFor(60_001);
 await profilePage.getByRole('heading',{name:'Good to see you, Makena',exact:true}).waitFor();
 const dateCases=await profilePage.evaluate(async()=>{
  const {default: BentoProfile} = await import('./profile.js');
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
 await profilePage.getByRole('button',{name:'Settings',exact:true}).click();
 await profilePage.getByLabel('First name',{exact:true}).fill('Maki');
 await profilePage.getByLabel('Birthday',{exact:true}).fill('');
 await profilePage.getByRole('button',{name:'Save profile',exact:true}).click();
 await profilePage.getByRole('heading',{name:'Good to see you, Maki',exact:true}).waitFor();
 await profilePage.clock.setSystemTime(new Date('2026-10-20T11:58:00Z'));
 await profilePage.clock.runFor(60_001);
 await profilePage.getByRole('heading',{name:'At your own pace, Maki',exact:true}).waitFor();
 await profilePage.clock.setSystemTime(new Date('2026-10-20T12:05:00Z'));
 await profilePage.clock.runFor(60_001);
 await profilePage.getByRole('heading',{name:'A fresh start, Maki',exact:true}).waitFor();
 await profilePage.clock.runFor(60_000);
 await profilePage.getByRole('heading',{name:'A fresh start, Maki',exact:true}).waitFor();
 await profilePage.getByRole('button',{name:'Meeting note',exact:true}).click();
 const greetingEditor = profilePage.getByRole('textbox',{name:'Meeting Markdown',exact:true});
 await greetingEditor.click(); await greetingEditor.press('ControlOrMeta+End');
 await greetingEditor.press('Enter'); await greetingEditor.pressSequentially('Keep my writing position');
 const beforeGreetingRefresh = await greetingEditor.evaluate(element => {
   element.dataset.greetingIdentity = 'original';
   return { text: getSelection().anchorNode.textContent, offset: getSelection().anchorOffset };
 });
 await profilePage.clock.setSystemTime(new Date('2026-10-20T13:00:00Z'));
 await profilePage.clock.runFor(60_001);
 assert.equal(await greetingEditor.getAttribute('data-greeting-identity'), 'original');
 assert.deepEqual(await greetingEditor.evaluate(() => ({ text: getSelection().anchorNode.textContent, offset: getSelection().anchorOffset })), beforeGreetingRefresh);
 await profilePage.getByRole('button',{name:'Daily overview',exact:true}).click();
 await profilePage.getByRole('heading',{name:'Good morning, Maki',exact:true}).waitFor();
 await profilePage.getByRole('button',{name:'Settings',exact:true}).click();
 await profilePage.getByLabel('First name',{exact:true}).fill('Makena');
 await profilePage.getByLabel('Last name',{exact:true}).fill('Wong');
 await profilePage.clock.setSystemTime(new Date('2026-10-02T02:00:00-07:00'));
 await profilePage.getByRole('button',{name:'Save profile',exact:true}).click();
 await profilePage.getByRole('heading',{name:'Hello, Mak Attack',exact:true}).waitFor();
 await profilePage.reload();
 await profilePage.getByRole('heading',{name:'Hello, Mak Attack',exact:true}).waitFor();
 assert.deepEqual(await profilePage.evaluate(() => {
   const {firstName,lastName} = JSON.parse(localStorage.getItem('bento.prototype.profile.v1'));
   return {firstName,lastName};
 }), {firstName:'Makena',lastName:'Wong'});
 await profilePage.clock.setSystemTime(new Date('2026-10-02T07:00:00-07:00'));
 await profilePage.clock.runFor(60_001);
 await profilePage.getByRole('heading',{name:'A fresh start, Thumper',exact:true}).waitFor();


 await profilePage.getByRole('button',{name:'Settings',exact:true}).click();
 for(const width of [320,736,1024]){
   await profilePage.setViewportSize({width,height:900});
   assert.equal(await profilePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Profile overflow '+width);
 }
 await profilePage.locator('#bento-workflow').screenshot({path:path.join(screenshots,'profile.png')});
 await profilePage.getByRole('button',{name:'Back to overview',exact:true}).click();
 await profilePage.locator('#bento-workflow').screenshot({path:path.join(screenshots,'profile-daily.png')});
 const blocked=await context.newPage();
 await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Unavailable');}}));
 await blocked.goto(url);
 await blocked.getByRole('button',{name:'Settings',exact:true}).click();
 await blocked.getByLabel('First name',{exact:true}).fill('Session user');
 await blocked.getByRole('button',{name:'Save profile',exact:true}).click();
 await blocked.getByRole('heading',{name:/, Session user\??$/}).waitFor();
 assert.match(await blocked.locator('#b-status').innerText(),/storage is unavailable/);
 console.log('Passed profile persistence/clear/edit, birthday and normal greetings, rare nicknames with stable reloads and unchanged profile, local date change, leap-day handling, date validation, blocked-storage fallback, no profile in host snapshots, and profile responsive widths.');
 const corrupt=await browser.newPage();
 await corrupt.goto(url);
 await corrupt.evaluate(()=>localStorage.setItem('bento.prototype.workspace.v4','{"version":4,"invalid":true}'));
 await corrupt.reload();
 assert.match(await corrupt.locator('#b-status').innerText(),/left unchanged/);
 await corrupt.getByRole('button',{name:'Meeting note',exact:true}).click();
 assert.equal(await corrupt.evaluate(()=>localStorage.getItem('bento.prototype.workspace.v4')),'{"version":4,"invalid":true}');
 await corrupt.close();
 console.log('Passed invalid saved-workspace preservation.');
 // Upgrade a persisted version 3 workspace without changing IDs or its backup copy.
 const migration=await browser.newPage();
 await migration.goto(url);
 const legacy=await migration.evaluate(async()=>{
  const {default: BentoWorkspace} = await import('./workspace.js');
  const workspace=BentoWorkspace.createWorkspace({coordination:'- [ ] Legacy action\n',drainage:'# Drainage\n'});
  const task=BentoWorkspace.allTasks(workspace)[0];
  workspace.records[task.id].body='Legacy supporting notes';
  workspace.records.coordination.body=workspace.records.coordination.body.trimEnd()+' <!-- bento-ref: ref-legacy -->\n';
  workspace.records.coordination.references={'ref-legacy':{target:task.id,base_title:task.title,base_completed:false}};
  workspace.version=3;
  const saved=JSON.stringify({version:3,savedAt:1,view:'document',project:null,document:'coordination',note:'coordination',editor:'write',workspace});
  localStorage.removeItem('bento.prototype.workspace.v4');
  localStorage.setItem('bento.prototype.workspace.v3',saved);
  return {saved,id:task.id};
 });
 await migration.reload();
 await migration.getByRole('button',{name:'Open Legacy action',exact:true}).click();
 assert.match(await migration.locator('#b-reading').innerText(),/Legacy supporting notes/);
 const migrated=await migration.evaluate(()=>({current:JSON.parse(localStorage.getItem('bento.prototype.workspace.v4')),old:localStorage.getItem('bento.prototype.workspace.v3')}));
 assert.equal(migrated.old,legacy.saved);
 assert.equal(migrated.current.workspace.records[legacy.id].title,'Legacy action');
 assert.doesNotMatch(migrated.current.workspace.records.coordination.body,/bento-ref/);
 await migration.close();
 console.log('Passed saved-workspace migration with original backup, stable todo identity, and retained notes.');
 await context.close();
 await checkProperties(browser, url);
 await checkThemes(browser, url, screenshots);
 await checkColors(browser, url, screenshots);
 await checkShortcuts(browser, url, screenshots);
 await checkQuickOpen(browser, url, screenshots);

})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close(); await server.close();});
