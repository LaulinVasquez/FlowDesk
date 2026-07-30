import { Project, Task } from "./types";
const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const initialProjects: Project[] = [
  { id: "product", name: "Product", color: "#3ecf8e", createdAt: new Date().toISOString() },
  { id: "personal", name: "Personal", color: "#a78bfa", createdAt: new Date().toISOString() },
  { id: "marketing", name: "Marketing", color: "#f59e0b", createdAt: new Date().toISOString() }
];
export const initialTasks: Task[] = [
  { id:"1", title:"Finalize Q3 product roadmap", description:"Review priorities with the product team and prepare the final roadmap.", completed:false, priority:"high", dueDate:day(0), projectId:"product", tags:["planning"], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() },
  { id:"2", title:"Review new onboarding flow", description:"Check the latest prototype and leave actionable feedback.", completed:false, priority:"medium", dueDate:day(1), projectId:"product", tags:["design"], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() },
  { id:"3", title:"Book annual health checkup", completed:false, priority:"low", dueDate:day(4), projectId:"personal", tags:["health"], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() },
  { id:"4", title:"Publish customer story", completed:true, priority:"medium", dueDate:day(-1), projectId:"marketing", tags:["content"], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), completedAt:new Date().toISOString() },
  { id:"5", title:"Update launch analytics dashboard", completed:false, priority:"high", dueDate:day(-2), projectId:"marketing", tags:["metrics"], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }
];
