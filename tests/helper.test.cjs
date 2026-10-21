'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'payload','compat.js'));
const context=vm.createContext({window:{}});
vm.runInContext(source.toString('utf8'),context);
const math=context.window.TyporaMathCompat;
const plain=value=>JSON.parse(JSON.stringify(value));
const lines=text=>text.split('\n');

test('inline LaTeX delimiters preserve the body and distinct closing marker',()=>{
  assert.deepEqual(plain(math.inline(String.raw`\(a_1+b_2\) tail`)),[String.raw`\(a_1+b_2\)`,'a_1+b_2',String.raw`\(`,String.raw`\)`]);
  assert.equal(math.inline(String.raw`\( \)`),null);
  assert.equal(math.inline(String.raw`\(unclosed`),null);
  assert.equal(math.inline(String.raw`\\(escaped\)`),null);
});

test('escaped closing delimiters do not terminate inline math',()=>{
  assert.equal(math.inline(String.raw`\(a\\)b\)`)[1],String.raw`a\\)b`);
});

test('single-line, multiline and mixed block layouts round-trip exactly',()=>{
  for(const text of [String.raw`\[ x^2+y^2=z^2 \]`,'$$ E=mc^2 $$',String.raw`\[
\begin{aligned}
x&=y+1\\
y&=z+2
\end{aligned}
\]`,String.raw`\[ a+b+
c=d \]`,'$$a+b+\nc=d$$','  \\[ a \\]  ']){
    const block=math.readBlock(lines(text),0);
    assert.ok(block,text);
    assert.equal(block.end,lines(text).length-1);
    assert.equal(math.serialize(block.tex,block.meta).join('\n'),text);
  }
});

test('edited blocks retain their delimiter style and surrounding whitespace',()=>{
  const text=String.raw`\[  x^2  \]`;
  const block=math.readBlock(lines(text),0);
  assert.equal(math.serialize('y^2',block.meta).join('\n'),String.raw`\[  y^2  \]`);
});

test('aligned equation with external tag and double backslash round-trips',()=>{
  const text=String.raw`\[ \begin{aligned} &\left( K\bigl(|d_i(x,y)|+w\bigr) - K\bigl(|d_i(x,y)|-w\bigr) \right)f_i(x,y)\\ &=\alpha_i\bigl(d_i(x,y),w\bigr)f_i(x,y), \end{aligned} \tag{9} \]`;
  const block=math.readBlock(lines(text),0);
  assert.ok(block.tex.includes(String.raw`\\ &=`));
  assert.ok(block.tex.endsWith(String.raw`\tag{9}`));
  assert.equal(math.serialize(block.tex,block.meta).join('\n'),text);
});

test('math fences recognize only complete explicitly marked fences',()=>{
  for(const text of ['```math\nx^2\n```','~~~~math\nx^2\n~~~~~','```MATH\nx^2\n```']){
    const block=math.readBlock(lines(text),0);
    assert.equal(block.tex,'x^2');
    assert.equal(math.serialize(block.tex,block.meta).join('\n'),text);
  }
  for(const text of ['```latex\nx^2\n```','```markdown\n\\[x^2\\]\n```','````math\nx^2\n```','```math\nx^2']){
    assert.equal(math.readBlock(lines(text),0),null);
  }
});

test('standalone environments and trailing tags are preserved',()=>{
  for(const env of ['equation','equation*','align','align*','aligned','gather','gather*','gathered','multline','multline*','displaymath','eqnarray','eqnarray*']){
    const text=`\\begin{${env}}\na&=b+c\n\\end{${env}}\\tag{4}`;
    const block=math.readBlock(lines(text),0);
    assert.ok(block,env);
    assert.equal(math.serialize(block.tex,block.meta).join('\n'),text);
  }
  assert.equal(math.readBlock(lines(String.raw`\begin{align} a=b \end{align} trailing prose`),0),null);
});

test('malformed markers, ordinary brackets, native tags and indented code stay unclaimed',()=>{
  for(const text of ['[x^2]','[link](https://example.com)',String.raw`\[ unmatched`,String.raw`\[ x $$`,String.raw`    \[x\]`,'\t$$x$$','$$ {native-tag}']){
    assert.equal(math.readBlock(lines(text),0),null,text);
  }
});

test('table protection hides formula pipes and leaves escaped openers untouched',()=>{
  const store=[];
  const input=String.raw`| \(P(a|b)\) | \(x|y\) |`;
  const protectedText=math.protectTable(input,store,'<token:','>');
  assert.equal(protectedText,'| <token:0> | <token:1> |');
  assert.deepEqual(plain(store),[String.raw`\(P(a|b)\)`,String.raw`\(x|y\)`]);
  const escaped=String.raw`\\(a|b\)`;
  assert.equal(math.protectTable(escaped,[],'<','>'),escaped);
});

test('native block fallback matches the opening delimiter type',()=>{
  const native=/^\s*\$\$\s*$/;
  assert.equal(math.blockStart(String.raw`\[`,native)[2],'latex');
  assert.ok(math.blockEnd(String.raw`\]`,native,true));
  assert.equal(math.blockEnd('$$',native,true),null);
  assert.ok(math.blockEnd('$$',native,false));
});

test('published payload hash, target hashes and replacement rules are coherent',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'payload','patches.json'),'utf8'));
  assert.equal(manifest.helper_sha256,crypto.createHash('sha256').update(source).digest('hex'));
  assert.equal(manifest.patch_version,math.version);
  assert.equal(manifest.typora_version,'1.2.4');
  assert.deepEqual(Object.keys(manifest.files).sort(),['appsrc/window/frame.js','window.html']);
  for(const info of Object.values(manifest.files)){
    assert.match(info.original_sha256,/^[0-9a-f]{64}$/);
    assert.match(info.patched_sha256,/^[0-9a-f]{64}$/);
    assert.notEqual(info.original_sha256,info.patched_sha256);
  }
  assert.equal(manifest.patches.length,17);
  for(const rule of manifest.patches){assert.ok(rule.anchor.length);assert.ok(rule.replacement.length);assert.equal(rule.count,1);}
});
