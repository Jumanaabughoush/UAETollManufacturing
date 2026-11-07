function scheduleComparison(task) {
  const baseline=task.baselineFinish?.slice(0,10);
  const finish=(task.actualFinish||task.finish)?.slice(0,10);
  if(!baseline||!finish) return {key:'unknown',label:!baseline?'No baseline':'No finish date'};
  if(finish>baseline) return {key:'behind',label:'Behind'};
  if(finish<baseline) return {key:'ahead',label:'Ahead'};
  return {key:'on',label:'On schedule'};
}

let ganttZoom=1;
function renderGantt(selectedProjects) {
  let panel=document.getElementById('ganttPanel');
  if(!panel) {
    panel=document.createElement('section');panel.id='ganttPanel';panel.className='panel gantt-panel';
    document.getElementById('dashboardPage').append(panel);
  }
  const rows=selectedProjects.flatMap(p=>workTasks(p).map(t=>({...t,project:p.name})));
  const time=v=>v?new Date(v).getTime():NaN;
  const timestamps=rows.flatMap(t=>[time(t.start),time(t.finish)]).filter(Number.isFinite);
  if(!timestamps.length){panel.innerHTML='<div class="panel-head"><h3>Gantt Chart</h3></div><p class="empty">No dated tasks available.</p>';return}
  const start=new Date(Math.min(...timestamps));start.setDate(1);start.setHours(0,0,0,0);
  const end=new Date(Math.max(...timestamps));end.setMonth(end.getMonth()+1,1);end.setHours(0,0,0,0);
  const months=[];for(let d=new Date(start);d<end;d.setMonth(d.getMonth()+1))months.push(new Date(d));
  const width=Math.max(960,months.length*48)*ganttZoom,span=end-start,position=n=>(n-start)/span*width;
  const monthFormat=new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'});
  const ticks=months.map(m=>({x:position(m),label:monthFormat.format(m)}));
  const tickStep=Math.max(1,Math.ceil(85/(width/months.length)));
  const axis='<div class="gantt-axis" style="width:'+width+'px">'+ticks.filter((t,i)=>i%tickStep===0).map(t=>'<span style="left:'+t.x+'px">'+t.label+'</span>').join('')+'</div>';
  const now=position(Date.now());
  const grid=ticks.map(t=>'<line x1="'+t.x+'" x2="'+t.x+'" y1="0" y2="54" stroke="#e3eeeb"/>').join('')+(now>=0&&now<=width?'<line x1="'+now+'" x2="'+now+'" y1="0" y2="54" stroke="#cc5266" stroke-dasharray="3 3"/>':'');
  let lastProject='';
  const body=rows.map((t,index)=>{
    const group=t.project!==lastProject?'<tr class="gantt-group"><th class="gantt-name">'+esc(t.project)+'</th><td style="background:#eaf5f1"></td></tr>':'';
    lastProject=t.project;
    const from=time(t.start),to=time(t.finish),valid=Number.isFinite(from)&&Number.isFinite(to)&&to>=from;
    let drawing='';
    if(valid){
      const x=position(from),w=Math.max(4,position(to)-x),fill=t.summary?'#185d68':'#a2e1d3';
      const title=esc(t.name+' | '+fmt(t.start)+' – '+fmt(t.finish)+' | '+Math.round(t.percentComplete||0)+'%');
      drawing=t.milestone?'<path d="M '+x+' 17 l 7 9 l -7 9 l -7 -9 z" fill="#d89b25"><title>'+title+'</title></path>':'<rect x="'+x+'" y="18" width="'+w+'" height="17" rx="5" fill="'+fill+'"><title>'+title+'</title></rect><rect x="'+x+'" y="18" width="'+w*Math.min(100,Math.max(0,t.percentComplete||0))/100+'" height="17" rx="5" fill="#008b79"/>';
    }
    return group+'<tr><th scope="row" class="gantt-name"><button class="gantt-task-button" data-task="'+index+'" style="padding-left:'+Math.max(0,(t.outlineLevel||1)-1)*12+'px">'+esc(t.id+'. '+t.name)+'</button><small>'+fmt(t.start)+' – '+fmt(t.finish)+'</small></th><td><svg data-task="'+index+'" class="gantt-task-svg" xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="54" role="img" aria-label="'+esc(t.name+' '+fmt(t.start)+' to '+fmt(t.finish))+'">'+grid+drawing+'</svg>'+(valid?'':'<span class="gantt-missing">Dates unavailable</span>')+'</td></tr>';
  }).join('');
  panel.innerHTML='<div class="panel-head"><div><h3>Gantt Chart</h3><span>'+rows.length+' tasks · '+fmt(start)+' – '+fmt(end)+'</span></div><div class="gantt-controls"><button data-zoom="0.65">Overview</button><button data-zoom="1">Quarterly view</button><button data-zoom="2">Monthly view</button><button id="ganttToday">Today</button></div></div><div class="gantt-legend"><span>▬ Scheduled task</span><span>■ Progress</span><span>◆ Milestone</span><span>┊ Today</span><span>Click a task for details</span></div><div class="gantt-scroll" tabindex="0" aria-label="All tasks timeline. Scroll horizontally for later dates."><table class="gantt-table"><thead><tr><th class="gantt-name">Task / Dates</th><th>'+axis+'</th></tr></thead><tbody>'+body+'</tbody></table></div>';
  panel.querySelectorAll('[data-zoom]').forEach(b=>{b.setAttribute('aria-pressed',String(Number(b.dataset.zoom)===ganttZoom));b.onclick=()=>{ganttZoom=Number(b.dataset.zoom);renderGantt(selectedProjects)}});
  panel.querySelector('#ganttToday').onclick=()=>{panel.querySelector('.gantt-scroll').scrollLeft=Math.max(0,now-150)};
  panel.querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>showGanttTask(rows[Number(b.dataset.task)]));
}

function showGanttTask(t){
  let d=document.getElementById('ganttTaskDialog');
  if(!d){d=document.createElement('dialog');d.id='ganttTaskDialog';d.className='gantt-dialog';document.body.append(d)}
  d.innerHTML='<form method="dialog"><button class="dialog-close" aria-label="Close task details">×</button></form><small>'+esc(t.project)+'</small><h3>'+esc(t.name)+'</h3><dl><dt>Start</dt><dd>'+fmt(t.start)+'</dd><dt>Finish</dt><dd>'+fmt(t.finish)+'</dd><dt>Baseline finish</dt><dd>'+fmt(t.baselineFinish)+'</dd><dt>Schedule status</dt><dd>'+scheduleComparison(t).label+'</dd><dt>Progress</dt><dd>'+Math.round(t.percentComplete||0)+'%</dd><dt>Critical</dt><dd>'+(t.critical?'Yes':'No')+'</dd></dl>';
  d.showModal();
}
