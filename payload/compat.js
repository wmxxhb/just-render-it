/* Typora 1.2.4 LaTeX delimiter compatibility. Local-only; no I/O. */
(function(root){
  'use strict';
  function inline(source){
    if(source.slice(0,2)!=='\\(')return null;
    for(var i=2;i<source.length-1;i++){
      if(source.slice(i,i+2)!=='\\)')continue;
      var preceding=0;for(var j=i-1;j>=0&&source[j]==='\\';j--)preceding++;
      if(preceding%2)continue;
      var body=source.slice(2,i);
      if(!body.trim())return null;
      return [source.slice(0,i+2),body,'\\(','\\)'];
    }
    return null;
  }
  function blockStart(line,original){
    var found=/^\s*\\\[\s*$/.exec(line);
    return found?[found[0],undefined,'latex']:line.match(original);
  }
  function blockEnd(line,original,latex){
    return latex?/^\s*\\\]\s*$/.exec(line):line.match(original);
  }
  function protectTable(source,store,left,right){
    var result='';
    for(var i=0;i<source.length;){
      var preceding=0;for(var j=i-1;j>=0&&source[j]==='\\';j--)preceding++;
      var found=preceding%2?null:inline(source.slice(i));
      if(found){var index=store.push(found[0])-1;result+=left+index+right;i+=found[0].length;}
      else result+=source[i++];
    }
    return result;
  }
  function isEscaped(text,index){
    var count=0;for(var i=index-1;i>=0&&text[i]==='\\';i--)count++;
    return count%2===1;
  }
  function result(raw,open,close,end,kind){
    var leading=(/^\s*/.exec(raw)||[''])[0];
    var trailing=(/\s*$/.exec(raw)||[''])[0];
    if(!raw.trim())return null;
    return {tex:raw.slice(leading.length,raw.length-trailing.length),end:end,meta:{version:2,kind:kind,open:open,close:close,leading:leading,trailing:trailing}};
  }
  function readBlock(lines,index){
    var first=lines[index];
    if(typeof first!=='string'||/^(?: {4}|\t)/.test(first))return null;
    var start=/^( {0,3})(\\\[|\$\$)(?!\$)/.exec(first);
    if(start){
      // Preserve Typora's original $$ {tag} extension.
      if(start[2]==='$$'&&/^\s*\$\$\s*\{.+\}\s*$/.test(first))return null;
      var close=start[2]==='$$'?'$$':'\\]';
      var opening=start[0],parts=[];
      for(var line=index;line<lines.length;line++){
        var text=line===index?first.slice(opening.length):lines[line];
        var at=-close.length;
        while((at=text.indexOf(close,at+close.length))!==-1){
          if(isEscaped(text,at)||!/^\s*$/.test(text.slice(at+close.length)))continue;
          parts.push(text.slice(0,at));
          return result(parts.join('\n'),opening,close+text.slice(at+close.length),line,'delimited');
        }
        parts.push(text);
      }
      return null;
    }
    var fence=/^( {0,3})(`{3,}|~{3,})[ \t]*math[ \t]*$/i.exec(first);
    if(fence){
      var closeFence=new RegExp('^ {0,3}'+fence[2][0]+'{'+fence[2].length+',}[ \\t]*$');
      for(var end=index+1;end<lines.length;end++)if(closeFence.test(lines[end]))return result('\n'+lines.slice(index+1,end).join('\n')+'\n',first,lines[end],end,'fence');
      return null;
    }
    var environment=/^ {0,3}\\begin\{(equation\*?|align\*?|aligned|gather\*?|gathered|multline\*?|displaymath|eqnarray\*?)\}/.exec(first);
    if(environment){
      var closing='\\end{'+environment[1]+'}';
      for(var envEnd=index;envEnd<lines.length;envEnd++){
        var position=lines[envEnd].indexOf(closing);
        if(position<0)continue;
        if(!/^(?:\s|\\(?:tag\*?|label)\{[^{}]*\})*$/.test(lines[envEnd].slice(position+closing.length)))return null;
        return result(lines.slice(index,envEnd+1).join('\n'),'','',envEnd,'environment');
      }
    }
    return null;
  }
  function serialize(text,meta){
    return (meta.open+meta.leading+String(text||'').replace(/\uE027/g,'')+meta.trailing+meta.close).split(/\r?\n/);
  }
  root.TyporaMathCompat={version:'2.0.0',inline:inline,blockStart:blockStart,blockEnd:blockEnd,protectTable:protectTable,readBlock:readBlock,serialize:serialize};
})(typeof window!=='undefined'?window:globalThis);
