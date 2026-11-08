let donutSelection=null,donutProject=null;
const renderBeforeInteractive=render;
const taskRenderBeforeInteractive=renderTasks;
renderTasks=function(tasks){
  taskRenderBeforeInteractive(donutSelection?tasks.filter(t=>status(t)===donutSelection):tasks);
};
function drawInteractiveDonut(){
  const tasks=currentProjects().flatMap(workTasks);
  const names=['Completed','In Progress','Upcoming','Overdue'],colors=['#007e70','#002f56','#b7dcd0','#c77a72'];
  const counts=names.map(s=>tasks.filter(t=>status(t)===s).length),total=tasks.length;
  let offset=0;
  const segments=names.map((s,i)=>{
    const portion=total?counts[i]/total*100:0,begin=offset;offset+=portion;
    return portion?'<circle class="donut-segment" data-status="'+i+'" tabindex="0" role="button" aria-label="'+s+': '+counts[i]+' tasks, '+Math.round(portion)+' percent. Filter tasks." aria-pressed="'+(donutSelection===s)+'" cx="120" cy="120" r="88" fill="none" stroke="'+colors[i]+'" stroke-width="32" pathLength="100" stroke-dasharray="'+portion+' '+(100-portion)+'" stroke-dashoffset="'+(-begin)+'" transform="rotate(-90 120 120)"><title>'+s+': '+counts[i]+' ('+Math.round(portion)+'%)</title></circle>':'';
  }).join('');
  $('statusChart').innerHTML='<div class="donut-layout interactive-donut"><div class="donut-svg-wrap"><svg viewBox="0 0 240 240" aria-label="Task status chart"><circle cx="120" cy="120" r="88" fill="none" stroke="#edf4f1" stroke-width="32"/>'+segments+'</svg><div class="donut-center" aria-live="polite"><strong id="donutCount"></strong><small id="donutDescription"></small></div></div><div class="donut-legend">'+names.map((s,i)=>'<button class="legend-item donut-choice" data-status="'+i+'" aria-pressed="'+(donutSelection===s)+'"><i style="background:'+colors[i]+'"></i><span>'+s+'</span><b>'+counts[i]+'</b><small>'+(total?Math.round(counts[i]/total*100):0)+'%</small></button>').join('')+'<button id="clearDonut" class="donut-clear">Show all tasks</button></div></div>';
  const center=s=>{const i=names.indexOf(s);$('donutCount').textContent=i<0?total:counts[i];$('donutDescription').textContent=i<0?'All tasks':s+' · '+(total?Math.round(counts[i]/total*100):0)+'%'};
  center(donutSelection);
  const choose=i=>{donutSelection=donutSelection===names[i]?null:names[i];drawInteractiveDonut();renderTasks(currentProjects().flatMap(p=>workTasks(p).map(t=>({...t,project:p.name}))));};
  $('statusChart').querySelectorAll('[data-status]').forEach(b=>{
    const i=Number(b.dataset.status);b.onclick=()=>choose(i);
    b.onmouseenter=()=>center(names[i]);b.onmouseleave=()=>center(donutSelection);
    b.onfocus=()=>center(names[i]);b.onblur=()=>center(donutSelection);
    if(b.tagName.toLowerCase()==='circle')b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(i)}};
  });
  $('clearDonut').onclick=()=>{donutSelection=null;drawInteractiveDonut();renderTasks(currentProjects().flatMap(p=>workTasks(p).map(t=>({...t,project:p.name}))));};
}
render=function(){
  if(donutProject!==selected){donutSelection=null;donutProject=selected}
  renderBeforeInteractive();drawInteractiveDonut();
};
if(projects.length)render();
