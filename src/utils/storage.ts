import { Project } from '@/types';

const PROJECTS_KEY = 'pool-design-projects';
const PROJECTS_LIST_KEY = 'pool-design-projects-list';

export const saveProject = (project: Project): void => {
  try {
    localStorage.setItem(`project_${project.id}`, JSON.stringify(project));
    updateProjectsList(project);
  } catch (error) {
    console.error('Failed to save project:', error);
    throw new Error('Storage limit reached. Please delete old projects.');
  }
};

export const loadProject = (id: string): Project | null => {
  try {
    const data = localStorage.getItem(`project_${id}`);
    if (!data) return null;
    const project = JSON.parse(data);
    // Convert date strings back to Date objects
    project.createdAt = new Date(project.createdAt);
    project.updatedAt = new Date(project.updatedAt);
    return project;
  } catch (error) {
    console.error('Failed to load project:', error);
    return null;
  }
};

export const deleteProject = (id: string): void => {
  localStorage.removeItem(`project_${id}`);
  removeFromProjectsList(id);
};

export const getAllProjects = (): Project[] => {
  try {
    const listData = localStorage.getItem(PROJECTS_LIST_KEY);
    if (!listData) return [];
    const ids: string[] = JSON.parse(listData);
    return ids
      .map(id => loadProject(id))
      .filter((p): p is Project => p !== null)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } catch (error) {
    console.error('Failed to load projects list:', error);
    return [];
  }
};

const updateProjectsList = (project: Project): void => {
  try {
    const listData = localStorage.getItem(PROJECTS_LIST_KEY);
    const ids: string[] = listData ? JSON.parse(listData) : [];
    if (!ids.includes(project.id)) {
      ids.push(project.id);
      localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(ids));
    }
  } catch (error) {
    console.error('Failed to update projects list:', error);
  }
};

const removeFromProjectsList = (id: string): void => {
  try {
    const listData = localStorage.getItem(PROJECTS_LIST_KEY);
    if (!listData) return;
    const ids: string[] = JSON.parse(listData);
    const filtered = ids.filter(pid => pid !== id);
    localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove from projects list:', error);
  }
};
