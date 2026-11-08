const storageKey = 'microsynergy.schedule-import.v1';
const upload = $('uploadData');
const filesInput = $('scheduleFiles');
const reset = $('resetData');
let published = [];
let local;

const scheduleDate = value => Number.isFinite(value)
  ? new Date(value).toISOString().slice(0, 19)
  : null;
const projectKey = name => name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

export function convertProject(project, fileName) {
  const tasks = project.tasks
    .filter(task => task.name && task.name.trim() !== 'TT File Preparation & Gap Assessment Initiation')
    .map(task => ({
      id: task.id,
      name: task.name,
      start: scheduleDate(task.start),
      finish: scheduleDate(task.finish),
      baselineStart: scheduleDate(task.baselineStart),
      baselineFinish: scheduleDate(task.baselineFinish),
      actualStart: scheduleDate(task.actualStart),
      actualFinish: scheduleDate(task.actualFinish),
      duration: task.duration ? `${task.duration.value}${task.duration.units}` : null,
      percentComplete: Math.min(100, Math.max(0, Number(task.percentComplete) || 0)),
      outlineLevel: task.outlineLevel,
      summary: task.summary,
      milestone: task.milestone,
      critical: task.critical
    }));

  if (!tasks.some(task => task.id !== 0 && !task.summary && task.start && task.finish)) {
    throw new Error('No scheduled activities found.');
  }
  const name = project.title?.trim() || fileName.replace(/\s*\(\d+\)?\.(mpp|xml)$/i, '').replace(/\.(mpp|xml)$/i, '');
  return { name, fileName, start: scheduleDate(project.start), finish: scheduleDate(project.finish), tasks };
}

function display(message) {
  const overrides = new Map((local?.projects || []).map(project => [projectKey(project.name), project]));
  const data = new Map(published.map(project => [projectKey(project.name), project]));
  for (const [key, project] of overrides) data.set(key, project);
  showProjects([...data.values()], local?.updatedAt || new Date());
  $('importInfo').hidden = !message;
  $('importStatus').textContent = message;
  reset.hidden = !local;
}

upload.onclick = () => filesInput.click();
filesInput.onchange = async () => {
  const files = [...filesInput.files];
  filesInput.value = '';
  if (!files.length) return;
  upload.disabled = reset.disabled = true;
  const updated = new Map((local?.projects || []).map(project => [projectKey(project.name), project]));
  const errors = [];
  let imported = 0;
  try {
    const { readProject } = await import('./vendor/mpxj.mjs');
    for (const file of files) {
      try {
        if (!/\.(mpp|xml)$/i.test(file.name)) throw new Error('Choose a Microsoft Project MPP or XML file.');
        const project = convertProject(await readProject(new Uint8Array(await file.arrayBuffer())), file.name);
        updated.set(projectKey(project.name), project);
        imported++;
      } catch (error) {
        errors.push(`${file.name}: ${error.message}`);
      }
    }
    if (imported) {
      local = { projects: [...updated.values()], updatedAt: new Date().toISOString() };
      try {
        localStorage.setItem(storageKey, JSON.stringify(local));
      } catch {
        errors.push('Browser storage unavailable. These changes are available for this session.');
      }
    }
    display([imported && `${imported} file(s) imported on this browser.`, ...errors].filter(Boolean).join(' '));
  } catch {
    display('Could not load the project file reader.');
  } finally {
    upload.disabled = reset.disabled = false;
  }
};

reset.onclick = () => {
  try {
    localStorage.removeItem(storageKey);
    local = null;
    display('');
  } catch {
    display('Could not clear browser storage.');
  }
};

try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (Array.isArray(stored?.projects) && stored.projects.length) local = stored;
} catch {
  // The published data is still available if browser storage cannot be read.
}
try {
  const response = await fetch('./projects.json');
  if (!response.ok) throw new Error('Published schedules unavailable.');
  published = await response.json();
  display(local ? 'Showing imported schedules saved on this browser.' : '');
} catch {
  if (local) display('Showing imported schedules. Published data could not be loaded.');
  else $('projectGrid').textContent = 'Project data could not be loaded.';
} finally {
  upload.disabled = false;
}
