(function(){
var D=JSON.parse(document.getElementById('MD').textContent),$=function(i){return document.getElementById(i)};
var mm=$('mm'),mt=$('mt'),mw=$('mw'),mp=$('mp'),ma=$('ma');
function br(v){return 'R$ '+String(v).replace(/\B(?=(\d{3})+(?!\d))/g,'.')}
function opt(s,l){s.innerHTML=l.map(function(x,i){return '<option value="'+i+'">'+x+'</option>'}).join('')}
opt(mm,D.m.map(function(m){return m.n}));
var q=new URLSearchParams(location.search).get('m');D.m.forEach(function(m,i){if(m.id===q)mm.value=i});
function M(){return D.m[mm.value]}
function setm(){var m=M();
 $('lt').hidden=!m.t;$('lw').hidden=!m.w||m.w.length<2;$('lp').hidden=!m.parts;
 if(m.parts)opt(mp,m.parts.map(function(p){return p[0]}));
 if(m.w){opt(mw,m.w.map(function(w){return w[0]}));fillt()}
 ma.innerHTML=m.add.map(function(a,i){return '<label class="ck"><input type="checkbox" value="'+i+'"><span>'+a[1]+'</span><b data-k="'+a[0]+'">'+(a[2]?'+ '+br(a[2]):'')+'</b></label>'}).join('');
 calc()}
function fillt(){var m=M(),w=m.w[mw.value][1],o=mt.value;
 mt.innerHTML=m.t.map(function(t,i){return w[i]==null?'':'<option value="'+i+'">'+t+'</option>'}).join('');
 if(o&&mt.querySelector('option[value="'+o+'"]'))mt.value=o}
function calc(){var m=M(),tot=0,lin=[m.n],obs='',tom=null,parts=1,chk={};
 ma.querySelectorAll('input').forEach(function(c){chk[m.add[c.value][0]]=c.checked});
 if(m.parts){var p=m.parts[mp.value];tot=p[1];lin.push(p[0]);parts=parseInt(p[0],10);tom='Ré grave'}
 else{var w=m.w[mw.value];tom=m.t[mt.value];tot=w[1][mt.value];lin.push('Tom: '+tom);if(m.w.length>1)lin.push('Material: '+w[0]);
  if(m.march){tot+=w[0]==='Bambu'?m.march.Bambu:m.march['*'];lin.push('Com marchetaria')}}
 if(chk.encaixe)parts=2;
 var es=parts===2?D.est2:(parts>2?D.est3:D.est[tom]);
 m.add.forEach(function(a){
  if(a[0]==='estojo'){var b=ma.querySelector('b[data-k=estojo]');b.textContent=es?'+ '+br(es):'sob consulta'}
  if(!chk[a[0]])return;
  if(a[0]==='estojo'){if(es)tot+=es;else obs='Estojo: valor sob consulta.';lin.push(a[1])}else{tot+=a[2];lin.push(a[1])}});
 $('mtot').textContent=br(tot);$('mobs').textContent=obs;
 $('mwa').href='https://wa.me/'+D.wa+'?text='+encodeURIComponent('Olá, Igor! Montei no site:\n- '+lin.join('\n- ')+'\nTotal estimado: '+br(tot)+(obs?'\n'+obs:''))}
mm.onchange=setm;mw.onchange=function(){fillt();calc()};mt.onchange=calc;mp.onchange=calc;ma.onchange=calc;setm();
})();
