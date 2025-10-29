import { Project } from '@/types';

const PROJECTS_KEY = 'pool-design-projects';
const PROJECTS_LIST_KEY = 'pool-design-projects-list';
const VIEW_STATE_PREFIX = 'pool-design-view-';

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
      .sort((a, b) => {
        const aTime = typeof a.updatedAt === 'string' ? new Date(a.updatedAt).getTime() : a.updatedAt.getTime();
        const bTime = typeof b.updatedAt === 'string' ? new Date(b.updatedAt).getTime() : b.updatedAt.getTime();
        return bTime - aTime;
      });
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

// Grid visibility preference
const GRID_VISIBLE_KEY = 'pool-design-grid-visible';

export const saveGridVisibility = (visible: boolean): void => {
  try {
    localStorage.setItem(GRID_VISIBLE_KEY, JSON.stringify(visible));
  } catch (error) {
    console.error('Failed to save grid visibility:', error);
  }
};

export const loadGridVisibility = (): boolean => {
  try {
    const data = localStorage.getItem(GRID_VISIBLE_KEY);
    if (data === null) return true; // Default to visible
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load grid visibility:', error);
    return true; // Default to visible on error
  }
};

// Annotations visibility preference
const ANNOTATIONS_VISIBLE_KEY = 'pool-design-annotations-visible';

export const saveAnnotationsVisibility = (visible: boolean): void => {
  try {
    localStorage.setItem(ANNOTATIONS_VISIBLE_KEY, JSON.stringify(visible));
  } catch (error) {
    console.error('Failed to save annotations visibility:', error);
  }
};

export const loadAnnotationsVisibility = (): boolean => {
  try {
    const data = localStorage.getItem(ANNOTATIONS_VISIBLE_KEY);
    if (data === null) return true; // Default to visible
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load annotations visibility:', error);
    return true; // Default to visible on error
  }
};

// Per-project view state (session-only): zoom + pan
export interface ProjectViewState {
  zoom: number;
  pan: { x: number; y: number };
}

const viewStateKey = (projectId: string) => `${VIEW_STATE_PREFIX}${projectId}`;

export const saveProjectViewState = (projectId: string, view: ProjectViewState): void => {
  try {
    // sessionStorage so it resets per-tab session, not persisted permanently
    sessionStorage.setItem(viewStateKey(projectId), JSON.stringify(view));
  } catch (error) {
    console.error('Failed to save project view state:', error);
  }
};

export const loadProjectViewState = (projectId: string): ProjectViewState | null => {
  try {
    const data = sessionStorage.getItem(viewStateKey(projectId));
    if (!data) return null;
    const parsed = JSON.parse(data);
    // Validate shape minimally
    if (
      typeof parsed?.zoom === 'number' &&
      parsed?.pan && typeof parsed.pan.x === 'number' && typeof parsed.pan.y === 'number'
    ) {
      return parsed as ProjectViewState;
    }
    return null;
  } catch (error) {
    console.error('Failed to load project view state:', error);
    return null;
  }
};
