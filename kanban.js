const KANBAN_STATE_KEY='microsynergy-kanban-state-v1';
let kanbanState={overrides:{},custom:[]};

try{
  const saved=JSON.parse(localStorage.getItem(KANBAN_STATE_KEY)||'null');
  if(saved&&saved.overrides&&Array.isArray(saved.custom))kanbanState=saved;
}catch(error){/* Use the schedule defaults if local storage is unavailable. */}

function saveKanban(){
  try{localStorage.setItem(KANBAN_STATE_KEY,JSON.stringify(kanbanState))}catch(error){/* Keep the board usable without persistence. */}
}

function defaultKanbanState(task){
  if((task.percentComplete||0)>=100||task.actualFinish)return'done';
  if((task.percentComplete||0)>0||(task.start&&new Date(task.start)<=today))return'wip';
  return'todo';
}

function kanbanTasks(){
  const filter=$('kanbanProjectFilter')?.value||'all';
  const query=($('kanbanSearch')?.value||'').trim().toLowerCase();
  const scheduled=projects.flatMap((project,projectIndex)=>workTasks(project).map(task=>({
    ...task,
    key:'schedule:'+projectIndex+':'+task.id,
    projectIndex:String(projectIndex),
    project:project.name,
    boardState:kanbanState.overrides['schedule:'+projectIndex+':'+task.id]||defaultKanbanState(task),
    custom:false
  })));
  const custom=kanbanState.custom.map(task=>({...task,custom:true,percentComplete:task.boardState==='done'?100:task.boardState==='wip'?50:0}));
  return scheduled.concat(custom).filter(task=>(filter==='all'||task.projectIndex===filter)&&(!query||(task.name||'').toLowerCase().includes(query)||(task.project||'').toLowerCase().includes(query)));
}

function setKanbanState(key,state,custom){
  if(custom){const task=kanbanState.custom.find(item=>item.key===key);if(task)task.boardState=state}
  else kanbanState.overrides[key]=state;
  saveKanban();renderKanban();
}

function renderKanban(){
  if(!$('kanbanBoard')||!projects.length)return;
  const filter=$('kanbanProjectFilter');
  if(filter.options.length!==projects.length+1){
    const current=filter.value||'all';
    filter.innerHTML='<option value="all">All MSP Projects</option>'+projects.map((project,index)=>'<option value="'+index+'">'+esc(project.name)+'</option>').join('');
    filter.value=[...filter.options].some(option=>option.value===current)?current:'all';
  }
  const tasks=kanbanTasks();
  const columns=[
    {key:'todo',label:'To Do',color:'#7c8b9e'},
    {key:'wip',label:'Work in Progress',color:'#d89b25'},
    {key:'done',label:'Done',color:'#00a88f'}
  ];
  $('kanbanTotal').textContent=tasks.length+' task'+(tasks.length===1?'':'s');
  $('kanbanBoard').innerHTML=columns.map(column=>{
    const cards=tasks.filter(task=>task.boardState===column.key);
    return '<section class="kanban-column" data-column="'+column.key+'" style="--column-color:'+column.color+'"><div class="kanban-column-head"><h3>'+column.label+'</h3><span class="kanban-count">'+cards.length+'</span></div><div class="kanban-cards">'+(cards.map(kanbanCard).join('')||'<div class="kanban-empty">No tasks here</div>')+'</div></section>';
  }).join('');
  bindKanbanInteractions();
}

function kanbanCard(task){
  const late=task.finish&&new Date(task.finish)<today&&task.boardState!=='done';
  const progress=Math.round(task.percentComplete||0);
  return '<article class="kanban-card" draggable="true" data-key="'+esc(task.key)+'" data-custom="'+task.custom+'"><div class="kanban-card-top"><div><h4>'+esc(task.name)+'</h4><span class="kanban-project">'+esc(task.project)+'</span></div>'+(task.custom?'<button class="kanban-delete" data-delete="'+esc(task.key)+'" aria-label="Delete '+esc(task.name)+'">×</button>':'')+'</div><div class="kanban-meta"><span>'+progress+'% complete</span><span class="'+(late?'late':'')+'">'+(task.finish?(late?'Overdue · ':'Due · ')+fmt(task.finish):'No due date')+'</span></div><select data-status="'+esc(task.key)+'" data-custom="'+task.custom+'" aria-label="Status for '+esc(task.name)+'"><option value="todo"'+(task.boardState==='todo'?' selected':'')+'>To Do</option><option value="wip"'+(task.boardState==='wip'?' selected':'')+'>Work in Progress</option><option value="done"'+(task.boardState==='done'?' selected':'')+'>Done</option></select><div class="kanban-card-progress"><i style="width:'+progress+'%"></i></div></article>';
}

function bindKanbanInteractions(){
  document.querySelectorAll('.kanban-card').forEach(card=>{
    card.addEventListener('dragstart',event=>{card.classList.add('dragging');event.dataTransfer.setData('text/plain',card.dataset.key);event.dataTransfer.setData('application/x-kanban-custom',card.dataset.custom)});
    card.addEventListener('dragend',()=>card.classList.remove('dragging'));
  });
  document.querySelectorAll('.kanban-column').forEach(column=>{
    column.addEventListener('dragover',event=>{event.preventDefault();column.classList.add('is-over')});
    column.addEventListener('dragleave',()=>column.classList.remove('is-over'));
    column.addEventListener('drop',event=>{event.preventDefault();column.classList.remove('is-over');const key=event.dataTransfer.getData('text/plain');if(key)setKanbanState(key,column.dataset.column,event.dataTransfer.getData('application/x-kanban-custom')==='true')});
  });
  document.querySelectorAll('[data-status]').forEach(select=>select.onchange=()=>setKanbanState(select.dataset.status,select.value,select.dataset.custom==='true'));
  document.querySelectorAll('[data-delete]').forEach(button=>button.onclick=()=>{kanbanState.custom=kanbanState.custom.filter(task=>task.key!==button.dataset.delete);saveKanban();renderKanban()});
}

function openKanbanDialog(){
  let dialog=$('kanbanTaskDialog');
  if(!dialog){
    dialog=document.createElement('dialog');dialog.id='kanbanTaskDialog';dialog.className='kanban-dialog';document.body.append(dialog);
  }
  const selectedProject=$('kanbanProjectFilter').value==='all'?'0':$('kanbanProjectFilter').value;
  dialog.innerHTML='<form id="kanbanTaskForm"><h3>Add MSP task</h3><div class="kanban-form"><label>Task name<input name="name" required maxlength="160" autofocus></label><label>Project<select name="project">'+projects.map((project,index)=>'<option value="'+index+'"'+(String(index)===selectedProject?' selected':'')+'>'+esc(project.name)+'</option>').join('')+'</select></label><label>Status<select name="state"><option value="todo">To Do</option><option value="wip">Work in Progress</option><option value="done">Done</option></select></label><label>Due date<input name="due" type="date"></label></div><div class="kanban-dialog-actions"><button class="kanban-secondary" type="button" id="cancelKanbanTask">Cancel</button><button class="kanban-primary" type="submit">Add task</button></div></form>';
  $('cancelKanbanTask').onclick=()=>dialog.close();
  $('kanbanTaskForm').onsubmit=event=>{
    event.preventDefault();const data=new FormData(event.currentTarget),projectIndex=String(data.get('project')),project=projects[Number(projectIndex)];
    kanbanState.custom.push({key:'custom:'+Date.now(),name:String(data.get('name')).trim(),projectIndex,project:project.name,boardState:String(data.get('state')),finish:data.get('due')?String(data.get('due'))+'T17:00':null});
    saveKanban();dialog.close();renderKanban();
  };
  dialog.showModal();
}

$('kanbanProjectFilter').onchange=renderKanban;
$('kanbanSearch').oninput=renderKanban;
$('addKanbanTask').onclick=openKanbanDialog;
window.renderKanban=renderKanban;
