import {test, expect} from '@playwright/test';
// Representative valid plain-text content: the HTML parser sees </script> before JSON parsing can occur.
const value={message:'</script><script>window.inlineProbe=1</script>'};
test('inline JSON guidance escapes HTML delimiters and round-trips content',async({page})=>{
 const htmlSafeJson=value=>JSON.stringify(value).replace(/</g,'\\u003c');
 await page.setContent(`<script type="application/json" id="config">${htmlSafeJson(value)}</script>`);
 expect(await page.evaluate(()=>window.inlineProbe)).toBeUndefined();
 expect(await page.locator('#config').textContent().then(JSON.parse)).toEqual(value);
});
