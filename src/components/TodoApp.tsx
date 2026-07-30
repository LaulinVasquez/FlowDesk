"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, Bell, CalendarDays, Check, CheckCircle2, Circle, Loader2,
  Clock3, Folder, Inbox, LayoutGrid, Menu, Moon, MoreHorizontal, PanelLeftClose,
  PanelLeftOpen, Pencil, Plus, RotateCcw, Search, Settings, Sparkles, Sun, Trash2, X
} from "lucide-react";
import { initialProjects, initialTasks } from "@/lib/data";
import { Priority, Project, Task, TaskSearchIntent, View } from "@/lib/types";
import { parseSearchIntent } from "@/lib/search";

type TaskDraft = { title:string; description:string; priority:Priority; dueDate:string; projectId:string; tags:string };
const emptyDraft: TaskDraft = { title:"", description:"", priority:"medium", dueDate:"", projectId:"", tags:"" };
const today = () => new Date().toISOString().slice(0,10);
const fmt = (date?:string) => date ? new Intl.DateTimeFormat("en",{month:"short",day:"numeric"}).format(new Date(`${date}T12:00:00`)) : "No date";
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function StatCard({label,value,helper,icon}:{label:string;value:string|number;helper:string;icon:React.ReactNode}) {
  return <article className="stat-card"><div className="stat-icon">{icon}</div><div><p>{label}</p><strong>{value}</strong><small>{helper}</small></div></article>;
}

function TaskModal({task,projects,onClose,onSave}:{task?:Task;projects:Project[];onClose:()=>void;onSave:(d:TaskDraft)=>void}) {
  const [draft,setDraft]=useState<TaskDraft>(task ? {title:task.title,description:task.description||"",priority:task.priority,dueDate:task.dueDate||"",projectId:task.projectId||"",tags:(task.tags||[]).join(", ")} : emptyDraft);
  const [error,setError]=useState(""); const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{input.current?.focus(); const close=(e:KeyboardEvent)=>e.key==="Escape"&&onClose(); document.addEventListener("keydown",close); return()=>document.removeEventListener("keydown",close)},[onClose]);
  const submit=(e:FormEvent)=>{e.preventDefault();if(!draft.title.trim()){setError("A task title is required.");input.current?.focus();return}onSave({...draft,title:draft.title.trim()})};
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <section className="modal task-modal" role="dialog" aria-modal="true" aria-labelledby="task-title">
      <div className="modal-head"><div><span className="eyebrow">{task?"EDIT TASK":"NEW TASK"}</span><h2 id="task-title">{task?"Update task":"What needs doing?"}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X/></button></div>
      <form onSubmit={submit}>
        <label>Task title<input ref={input} value={draft.title} onChange={e=>{setDraft({...draft,title:e.target.value});setError("")}} placeholder="e.g. Prepare launch brief" aria-invalid={!!error}/>{error&&<span className="error">{error}</span>}</label>
        <label>Description<textarea value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} placeholder="Add context, notes, or a link…" rows={4}/></label>
        <div className="form-grid">
          <label>Priority<select value={draft.priority} onChange={e=>setDraft({...draft,priority:e.target.value as Priority})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
          <label>Due date<input type="date" value={draft.dueDate} onChange={e=>setDraft({...draft,dueDate:e.target.value})}/></label>
          <label>Project<select value={draft.projectId} onChange={e=>setDraft({...draft,projectId:e.target.value})}><option value="">No project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Tags<input value={draft.tags} onChange={e=>setDraft({...draft,tags:e.target.value})} placeholder="design, review"/></label>
        </div>
        <div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary"><Plus size={17}/>{task?"Save changes":"Create task"}</button></div>
      </form>
    </section>
  </div>;
}

function ConfirmDialog({title,body,onCancel,onConfirm}:{title:string;body:string;onCancel:()=>void;onConfirm:()=>void}) {
  const ref=useRef<HTMLButtonElement>(null);
  useEffect(()=>{ref.current?.focus();const close=(e:KeyboardEvent)=>e.key==="Escape"&&onCancel();document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[onCancel]);
  return <div className="overlay"><section className="modal confirm" role="alertdialog" aria-modal="true"><div className="danger-icon"><Trash2/></div><h2>{title}</h2><p>{body}</p><div className="modal-actions"><button ref={ref} className="btn secondary" onClick={onCancel}>Cancel</button><button className="btn danger" onClick={onConfirm}>Delete permanently</button></div></section></div>
}

export function TodoApp() {
  const [tasks,setTasks]=useState<Task[]>([]), [projects,setProjects]=useState<Project[]>([]);
  const [loaded,setLoaded]=useState(false),[view,setView]=useState<View>("all"),[query,setQuery]=useState("");
  const [aiIntent,setAiIntent]=useState<TaskSearchIntent>({}),[interpreting,setInterpreting]=useState(false),[searchSource,setSearchSource]=useState<"ai"|"local"|null>(null),[searchOpen,setSearchOpen]=useState(false),[recentSearches,setRecentSearches]=useState<string[]>([]);
  const [priority,setPriority]=useState("all"),[status,setStatus]=useState("all"),[projectFilter,setProjectFilter]=useState("all"),[sort,setSort]=useState("newest");
  const [theme,setTheme]=useState<"dark"|"light">("dark"),[collapsed,setCollapsed]=useState(false),[mobileOpen,setMobileOpen]=useState(false);
  const [modal,setModal]=useState<"new"|"edit"|null>(null),[selected,setSelected]=useState<Task|undefined>(),[deleting,setDeleting]=useState<Task|undefined>();
  const [toast,setToast]=useState("");
  const searchRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{try{const t=localStorage.getItem("tideline.tasks"),p=localStorage.getItem("tideline.projects"),th=localStorage.getItem("tideline.theme"),r=localStorage.getItem("tideline.searches");setTasks(t?JSON.parse(t):initialTasks);setProjects(p?JSON.parse(p):initialProjects);setTheme(th==="light"?"light":"dark");setRecentSearches(r?JSON.parse(r):[])}catch{setTasks(initialTasks);setProjects(initialProjects)}setLoaded(true)},[]);
  useEffect(()=>{if(loaded){localStorage.setItem("tideline.tasks",JSON.stringify(tasks));localStorage.setItem("tideline.projects",JSON.stringify(projects));localStorage.setItem("tideline.theme",theme)}document.documentElement.dataset.theme=theme},[tasks,projects,theme,loaded]);
  useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(""),2600);return()=>clearTimeout(id)},[toast]);
  useEffect(()=>{
    const shortcut=(e:KeyboardEvent)=>{if(((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k")||e.key==="/"){if((e.target as HTMLElement).tagName!=="INPUT"||e.key!="/"){e.preventDefault();setSearchOpen(true);requestAnimationFrame(()=>searchRef.current?.focus())}}if(e.key==="Escape"&&searchOpen){setSearchOpen(false);searchRef.current?.blur()}};
    document.addEventListener("keydown",shortcut);return()=>document.removeEventListener("keydown",shortcut);
  },[searchOpen]);
  useEffect(()=>{
    if(!query.trim()){setAiIntent({});setSearchSource(null);setInterpreting(false);return}
    setAiIntent(parseSearchIntent(query,projects));setSearchSource("local");
    if(query.trim().length<3)return;
    const controller=new AbortController(),timer=setTimeout(async()=>{
      setInterpreting(true);
      try{const response=await fetch("/api/search-intent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,projects:projects.map(({id,name})=>({id,name}))}),signal:controller.signal});if(!response.ok)throw new Error();const data=await response.json();setAiIntent(data.intent||{});setSearchSource(data.source==="ai"?"ai":"local")}catch{if(!controller.signal.aborted)setSearchSource("local")}finally{if(!controller.signal.aborted)setInterpreting(false)}
    },450);
    return()=>{clearTimeout(timer);controller.abort()};
  },[query,projects]);

  const notify=(m:string)=>setToast(m);
  const project=(id?:string)=>projects.find(p=>p.id===id);
  const overdue=tasks.filter(t=>!t.completed&&t.dueDate&&t.dueDate<today()).length;
  const completed=tasks.filter(t=>t.completed).length;
  const filtered=useMemo(()=>{
    const list=tasks.filter(t=>{
      const hay=`${t.title} ${t.description||""} ${(t.tags||[]).join(" ")} ${projects.find(p=>p.id===t.projectId)?.name||""}`.toLowerCase();
      if(aiIntent.text&&!hay.includes(aiIntent.text.toLowerCase()))return false;
      if(aiIntent.status==="pending"&&t.completed)return false;if(aiIntent.status==="completed"&&!t.completed)return false;
      if(aiIntent.priorities?.length&&!aiIntent.priorities.includes(t.priority))return false;
      if(aiIntent.projectIds?.length&&!aiIntent.projectIds.includes(t.projectId||""))return false;
      if(aiIntent.tags?.length&&!aiIntent.tags.some(tag=>t.tags?.some(value=>value.toLowerCase().includes(tag.toLowerCase()))))return false;
      if(aiIntent.overdue&&(!t.dueDate||t.completed||t.dueDate>=today()))return false;
      if(aiIntent.dueFrom&&(!t.dueDate||t.dueDate<aiIntent.dueFrom))return false;
      if(aiIntent.dueTo&&(!t.dueDate||t.dueDate>aiIntent.dueTo))return false;
      if(view==="today"&&t.dueDate!==today())return false;
      if(view==="upcoming"&&(!t.dueDate||t.dueDate<=today()||t.completed))return false;
      if(view==="completed"&&!t.completed)return false;
      if(status==="pending"&&t.completed)return false;if(status==="completed"&&!t.completed)return false;
      if(priority!=="all"&&t.priority!==priority)return false;
      if(projectFilter!=="all"&&t.projectId!==projectFilter)return false;
      return true;
    });
    return list.sort((a,b)=>sort==="oldest"?a.createdAt.localeCompare(b.createdAt):sort==="due"?(a.dueDate||"9999").localeCompare(b.dueDate||"9999"):sort==="priority"?({high:0,medium:1,low:2}[a.priority]-{high:0,medium:1,low:2}[b.priority]):sort==="alpha"?a.title.localeCompare(b.title):b.createdAt.localeCompare(a.createdAt));
  },[tasks,projects,aiIntent,view,status,priority,projectFilter,sort]);
  const intentChips=[
    aiIntent.status&&aiIntent.status!=="all"?{key:"status",label:`Status: ${aiIntent.status}`}:null,
    ...(aiIntent.priorities||[]).map(v=>({key:"priorities",label:`Priority: ${v}`})),
    ...(aiIntent.projectIds||[]).map(id=>({key:"projectIds",label:`Project: ${project(id)?.name||id}`})),
    aiIntent.overdue?{key:"overdue",label:"Due: overdue"}:null,
    aiIntent.dueFrom||aiIntent.dueTo?{key:"dates",label:`Due: ${aiIntent.dueFrom===aiIntent.dueTo?fmt(aiIntent.dueFrom):`${fmt(aiIntent.dueFrom)}–${fmt(aiIntent.dueTo)}`}`}:null,
    aiIntent.text?{key:"text",label:`Matches: ${aiIntent.text}`}:null
  ].filter(Boolean) as {key:string;label:string}[];
  const removeIntent=(key:string)=>setAiIntent(current=>key==="dates"?{...current,dueFrom:undefined,dueTo:undefined}:{...current,[key]:undefined});
  const commitSearch=(value=query)=>{if(!value.trim())return;const next=[value.trim(),...recentSearches.filter(item=>item!==value.trim())].slice(0,5);setRecentSearches(next);localStorage.setItem("tideline.searches",JSON.stringify(next));setSearchOpen(false)};
  const save=(d:TaskDraft)=>{const now=new Date().toISOString(), tags=d.tags.split(",").map(x=>x.trim()).filter(Boolean);if(modal==="edit"&&selected){setTasks(v=>v.map(t=>t.id===selected.id?{...t,...d,tags,updatedAt:now}:t));notify("Task updated")}else{setTasks(v=>[{...d,id:uid(),completed:false,tags,createdAt:now,updatedAt:now},...v]);notify("Task created")}setModal(null);setSelected(undefined)};
  const toggle=(task:Task)=>{setTasks(v=>v.map(t=>t.id===task.id?{...t,completed:!t.completed,completedAt:!t.completed?new Date().toISOString():undefined,updatedAt:new Date().toISOString()}:t));notify(task.completed?"Task restored":"Task completed")};
  const addProject=()=>{const name=prompt("Project name");if(!name?.trim())return;setProjects(p=>[...p,{id:uid(),name:name.trim(),color:["#3ecf8e","#60a5fa","#a78bfa","#f59e0b"][p.length%4],createdAt:new Date().toISOString()}]);notify("Project created")};
  const titles:Record<View,[string,string]>={all:["All tasks","Your command center for focused work"],today:["Today",new Intl.DateTimeFormat("en",{weekday:"long",month:"long",day:"numeric"}).format(new Date())],upcoming:["Upcoming","Plan what’s ahead"],completed:["Completed","A record of progress"],projects:["Projects","Organize work into clear spaces"],settings:["Settings","Tune your workspace"]};
  const nav=[{id:"all",label:"All tasks",icon:<Inbox/>},{id:"today",label:"Today",icon:<CalendarDays/>},{id:"upcoming",label:"Upcoming",icon:<Clock3/>},{id:"completed",label:"Completed",icon:<CheckCircle2/>}] as const;
  const go=(v:View)=>{setView(v);setMobileOpen(false)};

  if(!loaded)return <div className="loading"><div className="brand-mark"><Check/></div><div className="skeleton wide"/><div className="skeleton"/></div>;
  return <div className={`app-shell ${collapsed?"is-collapsed":""}`}>
    {mobileOpen&&<button className="drawer-scrim" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}/>}
    <aside className={`sidebar ${mobileOpen?"mobile-open":""}`}>
      <div className="brand"><div className="brand-mark"><Check/></div>{!collapsed&&<div><strong>Tideline</strong><span>FOCUS WORKSPACE</span></div>}<button className="mobile-close icon-btn" onClick={()=>setMobileOpen(false)}><X/></button></div>
      <nav aria-label="Main navigation">
        <span className="nav-label">{!collapsed&&"WORKSPACE"}</span>
        {nav.map(n=><button key={n.id} title={n.label} className={view===n.id?"active":""} onClick={()=>go(n.id)}>{n.icon}{!collapsed&&<><span>{n.label}</span>{n.id==="all"&&<b>{tasks.length}</b>}</>}</button>)}
        <span className="nav-label">{!collapsed&&"MANAGE"}</span>
        <button className={view==="projects"?"active":""} onClick={()=>go("projects")}><Folder/>{!collapsed&&<span>Projects</span>}</button>
        {!collapsed&&<div className="project-nav">{projects.map(p=><button key={p.id} onClick={()=>{go("all");setProjectFilter(p.id)}}><i style={{background:p.color}}/><span>{p.name}</span><b>{tasks.filter(t=>t.projectId===p.id&&!t.completed).length}</b></button>)}<button onClick={addProject}><Plus/><span>New project</span></button></div>}
      </nav>
      <div className="sidebar-bottom"><button className={view==="settings"?"active":""} onClick={()=>go("settings")}><Settings/>{!collapsed&&<span>Settings</span>}</button><div className="profile"><div className="avatar">LV</div>{!collapsed&&<div><strong>Laurin Vasquez</strong><span>alex@tideline.io</span></div>}</div></div>
      <button className="collapse-btn" onClick={()=>setCollapsed(!collapsed)}>{collapsed?<PanelLeftOpen/>:<PanelLeftClose/>}</button>
    </aside>
    <main>
      <header><button className="menu-btn icon-btn" onClick={()=>setMobileOpen(true)}><Menu/></button><div className="page-title"><span>WORKSPACE / TASKS</span><h1>{titles[view][0]}</h1><p>{titles[view][1]}</p></div><div className="header-actions"><div className={`search-wrap ${searchOpen?"expanded":""}`}><form className="search" onSubmit={e=>{e.preventDefault();commitSearch()}}><Sparkles className="ai-spark"/><input ref={searchRef} aria-label="Search tasks with natural language" value={query} onFocus={()=>setSearchOpen(true)} onChange={e=>setQuery(e.target.value)} placeholder="Ask Tideline…"/>{interpreting?<Loader2 className="spin"/>:<kbd>⌘ K</kbd>}{query&&<button type="button" aria-label="Clear search" onClick={()=>setQuery("")}><X/></button>}</form>{searchOpen&&<div className="search-popover"><div className="search-status"><span><Sparkles/> SMART SEARCH</span>{interpreting?<em><Loader2 className="spin"/> Interpreting query</em>:query&&<em>{searchSource==="ai"?"AI interpreted":"Local interpretation"}</em>}</div>{intentChips.length>0&&<div className="intent-area"><small>APPLIED INTENT</small><div className="intent-chips">{intentChips.map((chip,i)=><button type="button" key={`${chip.key}-${i}`} onClick={()=>removeIntent(chip.key)}>{chip.label}<X/></button>)}</div></div>}{!query&&<><small className="popover-label">{recentSearches.length?"RECENT SEARCHES":"TRY ASKING"}</small>{(recentSearches.length?recentSearches:["show tasks due next week","find unfinished product work","what have I ignored?"]).map(item=><button type="button" className="suggestion" key={item} onClick={()=>{setQuery(item);commitSearch(item)}}><Search/><span>{item}</span><kbd>↵</kbd></button>)}</>}{query&&<div className="result-preview"><strong>{filtered.length} matching {filtered.length===1?"task":"tasks"}</strong><span>Press Enter to keep this search</span></div>}</div>}</div><button className="icon-btn" onClick={()=>setTheme(theme==="dark"?"light":"dark")} aria-label="Toggle theme">{theme==="dark"?<Sun/>:<Moon/>}</button><button className="icon-btn notification" aria-label="Notifications"><Bell/><i/></button><button className="btn primary new-task" onClick={()=>{setSelected(undefined);setModal("new")}}><Plus/>New task</button></div></header>
      <div className="content">
        {view==="settings"?<SettingsView theme={theme} setTheme={setTheme} clearCompleted={()=>{setTasks(t=>t.filter(x=>!x.completed));notify("Completed tasks cleared")}} reset={()=>{setTasks(initialTasks);setProjects(initialProjects);notify("Workspace reset")}}/>:
        view==="projects"?<ProjectsView projects={projects} tasks={tasks} add={addProject} remove={p=>{if(confirm(`Delete ${p.name}? Tasks will become unassigned.`)){setProjects(v=>v.filter(x=>x.id!==p.id));setTasks(v=>v.map(t=>t.projectId===p.id?{...t,projectId:undefined}:t));notify("Project deleted")}}}/>:
        <>
          <section className="stats">
            <StatCard label="TOTAL TASKS" value={tasks.length} helper={`${tasks.filter(t=>!t.completed).length} waiting for you`} icon={<LayoutGrid/>}/>
            <StatCard label="COMPLETED" value={completed} helper={`${tasks.length?Math.round(completed/tasks.length*100):0}% completion rate`} icon={<CheckCircle2/>}/>
            <StatCard label="DUE TODAY" value={tasks.filter(t=>t.dueDate===today()&&!t.completed).length} helper="Keep the momentum" icon={<CalendarDays/>}/>
            <StatCard label="OVERDUE" value={overdue} helper={overdue?"Needs your attention":"You’re all caught up"} icon={<Clock3/>}/>
          </section>
          <section className="progress-card"><div><span className="eyebrow">WEEKLY PROGRESS</span><h3>{completed} tasks completed</h3><p>Small steps compound into meaningful progress.</p></div><div className="progress-ring" style={{"--progress":`${tasks.length?completed/tasks.length*100:0}%`} as React.CSSProperties}><strong>{tasks.length?Math.round(completed/tasks.length*100):0}%</strong></div></section>
          <section className="task-section">
            <div className="section-head"><div><h2>{view==="all"?"Task overview":titles[view][0]}</h2><p>{filtered.length} {filtered.length===1?"task":"tasks"} in this view</p></div><button className="btn primary compact" onClick={()=>setModal("new")}><Plus/>Add task</button></div>
            <div className="toolbar"><div className="filter-group"><select aria-label="Filter status" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="completed">Completed</option></select><select aria-label="Filter priority" value={priority} onChange={e=>setPriority(e.target.value)}><option value="all">All priorities</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select><select aria-label="Filter project" value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}><option value="all">All projects</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>{(status!=="all"||priority!=="all"||projectFilter!=="all")&&<button className="clear" onClick={()=>{setStatus("all");setPriority("all");setProjectFilter("all")}}>Clear filters <X/></button>}</div><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort tasks"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="due">Due date</option><option value="priority">Priority</option><option value="alpha">A–Z</option></select></div>
            {query&&intentChips.length>0&&<div className="inline-intent"><Sparkles/><span>Interpreted</span>{intentChips.map((chip,i)=><button key={`${chip.key}-inline-${i}`} onClick={()=>removeIntent(chip.key)}>{chip.label}<X/></button>)}<button onClick={()=>setQuery("")}>Clear all</button></div>}
            {filtered.length?<div className="task-list"><div className="table-head"><span>Task</span><span>Project</span><span>Priority</span><span>Due date</span><span/></div>{filtered.map(task=><div className={`task-row ${task.completed?"done":""}`} key={task.id}>
              <div className="task-main"><button className="check-btn" onClick={()=>toggle(task)} aria-label={`${task.completed?"Restore":"Complete"} ${task.title}`}>{task.completed?<Check/>:<Circle/>}</button><button className="task-copy" onClick={()=>{setSelected(task);setModal("edit")}}><strong>{task.title}</strong><span>{task.description||"No additional notes"}{task.tags?.map(tag=><em key={tag}>#{tag}</em>)}</span></button></div>
              <div className="project-cell">{project(task.projectId)?<><i style={{background:project(task.projectId)?.color}}/>{project(task.projectId)?.name}</>:<span>—</span>}</div>
              <div><span className={`badge ${task.priority}`}><i/>{task.priority}</span></div>
              <div className={`due ${!task.completed&&task.dueDate&&task.dueDate<today()?"overdue":""}`}><CalendarDays/>{fmt(task.dueDate)}</div>
              <div className="row-actions"><button aria-label="Edit task" onClick={()=>{setSelected(task);setModal("edit")}}><Pencil/></button><button aria-label="Delete task" onClick={()=>setDeleting(task)}><Trash2/></button><button aria-label="More actions"><MoreHorizontal/></button></div>
            </div>)}</div>:<div className="empty"><div><Archive/></div><h3>{query?"No matching tasks":view==="today"?"A clear day ahead":"Nothing here yet"}</h3><p>{query?"Try adjusting your search or filters.":"Create a task and turn an intention into progress."}</p><button className="btn primary" onClick={()=>setModal("new")}><Plus/>Create a task</button></div>}
          </section>
        </>}
      </div>
    </main>
    {modal&&<TaskModal task={modal==="edit"?selected:undefined} projects={projects} onClose={()=>{setModal(null);setSelected(undefined)}} onSave={save}/>}
    {deleting&&<ConfirmDialog title="Delete this task?" body={`“${deleting.title}” will be permanently removed. This action can’t be undone.`} onCancel={()=>setDeleting(undefined)} onConfirm={()=>{setTasks(t=>t.filter(x=>x.id!==deleting.id));setDeleting(undefined);notify("Task deleted")}}/>}
    {toast&&<div className="toast" role="status"><CheckCircle2/><span>{toast}</span></div>}
  </div>;
}

function ProjectsView({projects,tasks,add,remove}:{projects:Project[];tasks:Task[];add:()=>void;remove:(p:Project)=>void}) {
 return <section className="manage-view"><div className="manage-title"><div><h2>Your projects</h2><p>Give every task a home.</p></div><button className="btn primary" onClick={add}><Plus/>New project</button></div><div className="project-grid">{projects.map(p=><article className="project-card" key={p.id}><div className="folder-icon" style={{color:p.color,background:`${p.color}18`}}><Folder/></div><button className="icon-btn" onClick={()=>remove(p)} aria-label={`Delete ${p.name}`}><Trash2/></button><h3>{p.name}</h3><p>{tasks.filter(t=>t.projectId===p.id&&!t.completed).length} open · {tasks.filter(t=>t.projectId===p.id&&t.completed).length} completed</p><div className="mini-progress"><i style={{width:`${tasks.filter(t=>t.projectId===p.id&&t.completed).length/Math.max(1,tasks.filter(t=>t.projectId===p.id).length)*100}%`,background:p.color}}/></div></article>)}</div></section>
}
function SettingsView({theme,setTheme,clearCompleted,reset}:{theme:string;setTheme:(t:"dark"|"light")=>void;clearCompleted:()=>void;reset:()=>void}) {
 return <section className="settings-view"><h2>Preferences</h2><div className="settings-card"><div><strong>Appearance</strong><p>Choose how Tideline looks on this device.</p></div><div className="segmented"><button className={theme==="dark"?"active":""} onClick={()=>setTheme("dark")}><Moon/>Dark</button><button className={theme==="light"?"active":""} onClick={()=>setTheme("light")}><Sun/>Light</button></div></div><div className="settings-card"><div><strong>Task density</strong><p>Control how much information fits on screen.</p></div><select><option>Comfortable</option><option>Compact</option></select></div><div className="settings-card"><div><strong>Notifications</strong><p>Daily planning reminders and upcoming deadlines.</p></div><label className="switch"><input type="checkbox" defaultChecked/><span/></label></div><h2 className="danger-zone">Data management</h2><div className="settings-card"><div><strong>Clear completed tasks</strong><p>Remove all tasks marked as completed.</p></div><button className="btn secondary" onClick={clearCompleted}>Clear completed</button></div><div className="settings-card"><div><strong>Reset workspace</strong><p>Restore the original sample data and preferences.</p></div><button className="btn danger-outline" onClick={()=>confirm("Reset all local data?")&&reset()}><RotateCcw/>Reset data</button></div></section>
}
