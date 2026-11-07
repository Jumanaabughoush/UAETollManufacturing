function baselineDelayCell(t){
  if(!t.baselineFinish)return '<td title="Baseline finish date unavailable">—</td>';
  const completed=t.percentComplete>=100||t.actualFinish;
  const now=new Date();
  const todayLocal=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  const comparison=completed
    ? (t.actualFinish||t.finish)
    : (!t.finish||todayLocal>t.finish.slice(0,10)?todayLocal:t.finish);
  if(!comparison)return '<td title="Finish date unavailable">—</td>';
  const parseDate=v=>new Date(Date.UTC(Number(v.slice(0,4)),Number(v.slice(5,7))-1,Number(v.slice(8,10))));
  const from=parseDate(t.baselineFinish),to=parseDate(comparison);
  let days=0;
  for(let d=new Date(from.getTime()+86400000);d<=to;d=new Date(d.getTime()+86400000)){
    const weekday=d.getUTCDay();
    if(weekday!==5&&weekday!==6)days++;
  }
  const basis=completed?'Actual finish':(comparison.slice(0,10)===todayLocal?'Today':'Current scheduled finish');
  return '<td title="'+basis+' compared with baseline finish; Friday and Saturday excluded">'+Math.max(0,days)+'</td>';
}
// Preserve project navigation and use the supplied chart arrangement.
const originalRender=render;
const detailGrid=document.querySelector('.detail-grid');
const milestonePanel=$('milestoneList').closest('article');
milestonePanel.classList.add('milestone-panel');
detailGrid.after(milestonePanel);
const histogramPanel=document.createElement('article');
histogramPanel.className='panel';
histogramPanel.innerHTML='<div class="panel-head"><h3>Progress Distribution</h3><span>Tasks by completion range</span></div><div class="histogram" id="histogram"></div>';
detailGrid.append(histogramPanel);
const detailTitle=document.createElement('h3');detailTitle.className='detail-title';detailGrid.before(detailTitle);
document.querySelector('.projects').classList.add('hidden');
const kpis=document.querySelector('.kpis');
kpis.children[0].querySelector('.kpi-top').firstChild.textContent='Total Tasks';
kpis.children[0].querySelector('.kpi-note').textContent='Active selection';
kpis.children[1].querySelector('.kpi-top').firstChild.textContent='Overall Progress';
kpis.children[1].querySelector('.kpi-note').textContent='Average schedule completion';
kpis.append(kpis.children[3]);
status=function(t){
  if(t.percentComplete>=100||t.actualFinish)return 'Completed';
  if(t.finish&&new Date(t.finish)<today)return 'Overdue';
  if(t.percentComplete>0||t.actualStart)return 'In Progress';
  return 'Upcoming';
};
render=function(){
  originalRender();
  const current=currentProjects(),tasks=current.flatMap(workTasks),total=tasks.length;
  detailTitle.textContent=(selected==='all'?'All Projects':current[0].name)+' Details';
  $('kpiProjects').textContent=total;
  $('kpiTasks').textContent=(total?Math.round(tasks.reduce((a,t)=>a+(t.percentComplete||0),0)/total):0)+'%';
  $('updated').textContent='Last update '+fmt(new Date())+' · '+projects.length+' projects';
  $('statusCaption').textContent='Current distribution';
  const groups=['Completed','In Progress','Upcoming','Overdue'],colors=['#00a88f','#185d68','#d89b25','#cc5266'];
  const counts=groups.map(s=>tasks.filter(t=>status(t)===s).length);
  let offset=0;
  const stops=counts.map((n,i)=>{const start=offset;offset+=total?n/total*100:0;return colors[i]+' '+start+'% '+offset+'%'}).join(',');
  $('statusChart').innerHTML='<div class="donut-layout"><div class="donut" role="img" aria-label="'+esc(groups.map((s,i)=>s+': '+counts[i]).join(', '))+'" style="background:'+(total?'conic-gradient('+stops+')':'#edf1f5')+'"><div class="donut-hole"><strong>'+total+'</strong><small>tasks</small></div></div><div class="donut-legend">'+groups.map((s,i)=>'<div class="legend-item"><i style="background:'+colors[i]+'"></i><span>'+s+'</span><b>'+counts[i]+'</b></div>').join('')+'</div></div>';
  const ranges=['0%','1–25%','26–50%','51–75%','76–99%','100%'],bins=[0,0,0,0,0,0];
  tasks.forEach(t=>{const p=t.percentComplete||0;bins[p===0?0:p<=25?1:p<=50?2:p<=75?3:p<100?4:5]++});
  const max=Math.max(1,...bins);
  $('histogram').innerHTML=bins.map((n,i)=>'<div class="hist-column"><strong>'+n+'</strong><div class="hist-bar" style="height:'+(n/max*200)+'px" aria-label="'+ranges[i]+': '+n+' tasks"></div><small>'+ranges[i]+'</small></div>').join('');
  const milestones=current.flatMap(p=>workTasks(p).filter(t=>t.milestone).map(t=>({...t,project:p.name}))).sort((a,b)=>new Date(a.finish)-new Date(b.finish));
  milestonePanel.querySelector('.panel-head span').textContent='Scheduled completion dates';
  $('milestoneList').innerHTML=milestones.map(t=>'<div class="milestone"><strong>'+esc(t.name)+'</strong>'+(selected==='all'?'<small>'+esc(t.project)+'</small>':'')+'<time>'+fmt(t.finish)+'</time><span class="state">'+status(t)+'</span><div class="baseline-details"><span>Baseline: <time>'+fmt(t.baselineFinish)+'</time></span><span>Status: <b class="schedule-'+scheduleComparison(t).key+'">'+scheduleComparison(t).label+'</b></span></div></div>').join('')||'<p class="empty">No milestones recorded.</p>';
  renderGantt(current);
};
renderTasks=function(tasks){
  const q=$('taskSearch').value.trim().toLowerCase();
  const filtered=tasks.filter(t=>!q||(t.name||'').toLowerCase().includes(q)||(t.project||'').toLowerCase().includes(q));
  $('taskCount').textContent=filtered.length+' of '+tasks.length+' tasks';
  const table=$('taskRows').closest('table');
  table.querySelector('thead').innerHTML='<tr><th>ID</th><th>Task Name</th><th>Project</th><th>Start</th><th>Finish</th><th>Progress</th><th>Critical</th><th>Status</th><th title="Working days after baseline finish; Friday and Saturday excluded; actual finish for completed tasks, today for unfinished tasks">Baseline Delay (workdays)</th></tr>';
  $('taskRows').innerHTML=filtered.map(t=>'<tr><td>'+t.id+'</td><td class="task">'+esc(t.name)+'</td><td>'+esc(t.project)+'</td><td>'+fmt(t.start)+'</td><td>'+fmt(t.finish)+'</td><td>'+Math.round(t.percentComplete||0)+'%</td><td>'+(t.critical?'Yes':'No')+'</td><td><span class="status-pill '+statusClass(status(t))+'">'+status(t)+'</span></td>'+baselineDelayCell(t)+'</tr>').join('')||'<tr><td colspan="9" class="empty">No matching tasks.</td></tr>';
};
if(projects.length)render();
