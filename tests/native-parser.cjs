const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
if(!process.argv[2])throw new Error('Usage: node tests/native-parser.cjs <patched-frame.js>');
const source=fs.readFileSync(process.argv[2],'utf8');
const TYPE=new Proxy({}, {get:(obj,key)=>obj[key]||(obj[key]=key)});
let uid=0;
class Node {
  constructor(attrs={}){this.attributes={children:[],...attrs};this.cid='test-'+(++uid);}
  get(key){return this.attributes[key];}
  set(key,value){this.attributes[key]=value;return this;}
  unset(key){delete this.attributes[key];return this;}
  safeGetStrAttr(key){return this.get(key)||'';}
  getText(){return this.get('text')||'';}
  getFirstChild(){return this.get('children')[0];}
  getLastChild(){return this.get('children').slice(-1)[0];}
  getVeryFirst(){return this;}
  getVeryLast(){return this;}
  canContainBlock(){return false;}
  isDeleted(){return false;}
  isBlock(){return true;}
  appendChild(n){const children=this.get('children');const last=children[children.length-1];if(last){last.set('after',n);n.set('before',last);}children.push(n);n.set('parent',this);return n;}
  appendChildrenTillEnd(first){for(let n=first;n;){const next=n.get('after');this.appendChild(n);n=next;}}
  addAfter(n){n.set('before',this);n.set('after',this.get('after'));this.set('after',n);return n;}
  copyContentFrom(n){const keep={...this.attributes};Object.assign(this.attributes,n.attributes);this.attributes.before=keep.before;this.attributes.after=keep.after;return this;}
  detach(){}
  remove(){}
  toHTML(){return '';}
}
Node.isType=(n,...types)=>n!=null&&types.includes(typeof n==='object'?n.get('type'):n);
Node.ListType={ul:'ul',ol:'ol',task:'task'};
const escape=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const strings={escape,escapeInQuote:escape,escapeForPreWrap:escape,escapeInHtml:escape,unescape:s=>s,orDefault:(x,y)=>x??y,isNullOrBlank:s=>!s||!s.trim(),wcswidth:s=>s.length,decodeHtmlEntity:()=>null,escapeRegExp:s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')};
const types={Node,TYPE,NodeMap:class {},NodeCollectionUtils:{toHTML:()=>''}};
const decorator={decorate:t=>JSON.stringify(t)+'\n'};
const html={INLINE_TYPE:[],HIDDEN_TYPE:[],UNSFAE_TAGS:[],BLOCK_OPEN_REG:/^<(?:div|section|pre|script)(?:\s|>)/,getHTMLTagReg:()=>null};
const deps={'11':strings,'13':types,'2f':decorator,'17':html,'1b':{},'46':{},'1e':{}};
const context=vm.createContext({window:{},self:{},console:{...console,sendError:()=>{}},File:{option:{enableInlineMath:true,strictMarkdown:true,indentSize:2},shouldRemapPunctuation:()=>false,editor:{focusCid:'unused'},useCRLF:false},svgCache:{},document:{},Map,Set,Node});
vm.runInContext('Array.prototype.last=function(){return this[this.length-1]};Array.prototype.subarray=function(a,b){return this.slice(a,b)};Array.prototype.remove=function(x){let i=this.indexOf(x);if(i>=0)this.splice(i,1)};',context);
vm.runInContext(fs.readFileSync(__dirname+'/../payload/compat.js','utf8'),context);
function getModule(id){let start=source.indexOf('$__System.registerDynamic("'+id+'"');let end=source.indexOf('$__System.registerDynamic(',start+30);return source.slice(start,end).replace(/,\s*$/,';');}
let exported;
context.$__System={registerDynamic:(id,names,flag,factory)=>{let mod={exports:{}};factory(k=>deps[k]||{},mod.exports,mod);exported=mod.exports;}};
vm.runInContext(getModule('19'),context);const parser=exported;
function tokens(text){return parser.InlineLexer.prototype.output.call(new parser.InlineLexer(),text,decorator.decorate,false,{url:true,attr:false}).trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));}
let list=tokens(String.raw`正文 \(x_1+\frac{a}{b}\) 和 $y^2$。`);
assert.deepEqual(list.filter(t=>t.type==='inline_math').map(t=>[t.text,t.pattern,t.endPattern]),[['x_1+\\frac{a}{b}','\\(','\\)'],['y^2','$',undefined]]);
assert.equal(tokens(String.raw`代码 \`\(x\)\`，转义 \\(y\\)，公式 \(z\)。`.replaceAll('\\`','`')).filter(t=>t.type==='inline_math').length,1);
assert.equal(tokens(String.raw`未闭合 \(x`).filter(t=>t.type==='inline_math').length,0);
assert.equal(tokens(String.raw`空公式 \( \)`).filter(t=>t.type==='inline_math').length,0);
assert.equal(tokens(String.raw`\(a_1\) / \(b_2\)`).filter(t=>t.type==='inline_math').length,2);
assert.equal(tokens(String.raw`**\(x\)**`).filter(t=>t.type==='strong')[0]?.inner.includes('inline_math'),true);
assert.equal(parser.splitTableCell(String.raw`| \(a|b\) | $c|d$ |`,0,2).length,2);
assert.equal(parser.splitTableCell(String.raw`| \(a|b\) | $c|d$ |`,0,2)[0].trim(),String.raw`\(a|b\)`);
const helper=context.window.TyporaMathCompat;
const dollar=/^\s*\${2}\s*(?:\{(.+)\})?$/;
assert.equal(helper.blockStart('\\[',dollar)[2],'latex');assert.ok(helper.blockEnd('\\]',dollar,true));assert.equal(helper.blockEnd('$$',dollar,true),null);assert.equal(helper.blockEnd('\\]',dollar,false),null);
vm.runInContext(getModule('12'),context);
let block=new Node({type:'math_block',text:'x^2+1',mathDelimiter:'latex'});assert.equal(block.toMark(),'\\[\nx^2+1\n\\]');
block=new Node({type:'math_block',text:'x^2+1'});assert.equal(block.toMark(),'$$\nx^2+1\n$$');
assert.equal(new Node({type:'table_cell',text:String.raw`\(a|b\)`}).toMark(),String.raw`\(a|b\)`);
assert.ok(source.includes('"tagBefore","tagAfter","mathDelimiter","mathCompat","noCloseTag","empty"'));
const fixtures=[
 String.raw`\[ K\bigl(d_i(x,y)\bigr)f_i(x,y) = \alpha_i\bigl(d_i(x,y)\bigr)f_i(x,y), \tag{8} \]`,
 String.raw`\[ \begin{aligned} &\left( K\bigl(|d_i(x,y)|+w\bigr) - K\bigl(|d_i(x,y)|-w\bigr) \right)f_i(x,y)\\ &=\alpha_i\bigl(d_i(x,y),w\bigr)f_i(x,y), \end{aligned} \tag{9} \]`,
 String.raw`$$ x^2+y^2=z^2 $$`,
 String.raw`\[
x^2
\]`,
 String.raw`\[ x^2+
y^2 \]`,
 String.raw`$$x^2+
y^2$$`,
 String.raw`\begin{equation}
E=mc^2
\end{equation}`,
 String.raw`\begin{align}a&=b\\c&=d\end{align}`,
 '```math\nx^2+1\n```',
 '~~~math\nx^2+1\n~~~',
 String.raw`   \[  \frac{a}{b}  \]  `,
 String.raw`$$
\begin{aligned}x&=y\\z&=w\end{aligned}
$$`
];
for(const value of fixtures){
 const parsed=helper.readBlock(value.split('\n'),0);assert.ok(parsed,'unrecognized block: '+value);
 assert.equal(helper.serialize(parsed.tex,parsed.meta).join('\n'),value);
 const native=new Node({type:'raw_edit',text:value});
 native.parseFrom({skips:{}},undefined,true);
 assert.equal(native.get('type'),'math_block',value);
 assert.ok(native.get('mathCompat'),value);
 assert.equal(native.toMark(),value);
}
for(const value of ['[ordinary text]','[a](https://example.com)','    \\[x\\]','\\[ unclosed','```latex\n\\[x\\]\n```','```javascript\nx=1\n```'])assert.equal(helper.readBlock(value.split('\n'),0),null,value);
let codeNode=new Node({type:'raw_edit',text:'```markdown\n\\[x\\]\n```'});codeNode.parseFrom({skips:{}},undefined,true);assert.equal(codeNode.get('type'),'fences');
console.log('PASS: native inline lexer, 12 native block-parser/serializer cases, exact equations (8)/(9), code, tables, escapes, unmatched delimiters');
