import { create } from 'zustand';
import { Component, Project, Summary } from '@/types';
import { calculateMeasurements } from '@/utils/measurements';
import { saveProject, loadProject } from '@/utils/storage';
import { v4 as uuidv4 } from 'uuid';

interface DesignStore {
  // Project
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  
  // Canvas
  components: Component[];
  selectedComponentId: string | null;
  selectedFenceSegment: { componentId: string; run: number; seg: number } | null;
  
  // View
  zoom: number;
  pan: { x: number; y: number };
  gridVisible: boolean;
  snapEnabled: boolean;
  zoomLocked: boolean;
  
  // History
  history: Component[][];
  historyIndex: number;
  
  // Tile selection (paver/coping) for footer UI
  tileSelection: null | {
    scope: 'paver';
    componentId: string;
    count: number;
    widthMm: number;
    heightMm: number;
    tileWidthMm: number;
    tileHeightMm: number;
  };
  
  // Actions
  addComponent: (component: Omit<Component, 'id'>) => void;
  updateComponent: (id: string, updates: Partial<Component>) => void;
  deleteComponent: (id: string) => void;
  selectComponent: (id: string | null) => void;
  selectFenceSegment: (sel: { componentId: string; run: number; seg: number } | null) => void;
  duplicateComponent: (id: string) => void;
  rotateComponent: (id: string, degrees: number) => void;
  
  undo: () => void;
  redo: () => void;
  
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  toggleZoomLock: () => void;
  
  getMeasurements: () => Summary;
  saveCurrentProject: () => void;
  updateCurrentProject: (updates: Partial<Project>) => void;
  loadProjectById: (id: string) => void;
  clearAll: () => void;
  setTileSelection: (info: DesignStore['tileSelection']) => void;
}

export const useDesignStore = create<DesignStore>((set, get) => ({
  currentProject: null,
  components: [],
  selectedComponentId: null,
  selectedFenceSegment: null,
  
  zoom: 1,
  pan: { x: 0, y: 0 },
  gridVisible: true,
  snapEnabled: true,
  zoomLocked: false,
  
  history: [[]],
  historyIndex: 0,
  
  tileSelection: null,
  
  setCurrentProject: (project) => {
    set({ 
      currentProject: project,
      components: project?.components || [],
      selectedComponentId: null,
      history: [project?.components || []],
      historyIndex: 0,
    });
  },
  
  addComponent: (component) => {
    const newComponent: Component = {
      ...component,
      id: uuidv4(),
    };
    
    set((state) => {
      const newComponents = [...state.components, newComponent];
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newComponents);
      
      return {
        components: newComponents,
        history: newHistory.slice(-50), // Keep last 50 states
        historyIndex: Math.min(newHistory.length - 1, 49),
        selectedComponentId: newComponent.id,
      };
    });
  },
  
  updateComponent: (id, updates) => {
    set((state) => {
      const newComponents = state.components.map(c =>
        c.id === id ? { ...c, ...updates } : c
      );
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newComponents);
      
      return {
        components: newComponents,
        history: newHistory.slice(-50),
        historyIndex: Math.min(newHistory.length - 1, 49),
      };
    });
  },
  
  deleteComponent: (id) => {
    set((state) => {
      const newComponents = state.components.filter(c => c.id !== id);
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newComponents);
      
      return {
        components: newComponents,
        history: newHistory.slice(-50),
        historyIndex: Math.min(newHistory.length - 1, 49),
        selectedComponentId: state.selectedComponentId === id ? null : state.selectedComponentId,
      };
    });
  },
  
  selectComponent: (id) => set({ selectedComponentId: id }),
  selectFenceSegment: (sel) => set({ selectedFenceSegment: sel }),
  
  duplicateComponent: (id) => {
    const component = get().components.find(c => c.id === id);
    if (!component) return;
    
    get().addComponent({
      ...component,
      position: {
        x: component.position.x + 100,
        y: component.position.y + 100,
      },
    });
  },
  
  rotateComponent: (id, degrees) => {
    const component = get().components.find(c => c.id === id);
    if (!component) return;
    
    get().updateComponent(id, {
      rotation: (component.rotation + degrees) % 360,
    });
  },
  
  undo: () => {
    set((state) => {
      if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        return {
          components: state.history[newIndex],
          historyIndex: newIndex,
        };
      }
      return state;
    });
  },
  
  redo: () => {
    set((state) => {
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        return {
          components: state.history[newIndex],
          historyIndex: newIndex,
        };
      }
      return state;
    });
  },
  
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
  toggleZoomLock: () => set((state) => ({ zoomLocked: !state.zoomLocked })),
  
  getMeasurements: () => {
    const { components } = get();
    return calculateMeasurements(components);
  },
  
  setTileSelection: (info) => set((state) => {
    const prev = state.tileSelection;
    const same = (
      (prev === null && info === null) ||
      (prev !== null && info !== null &&
        prev.scope === info.scope &&
        prev.componentId === info.componentId &&
        prev.count === info.count &&
        prev.widthMm === info.widthMm &&
        prev.heightMm === info.heightMm &&
        prev.tileWidthMm === info.tileWidthMm &&
        prev.tileHeightMm === info.tileHeightMm)
    );
    if (same) return state;
    return { tileSelection: info };
  }),
  
  saveCurrentProject: () => {
    const { currentProject, components } = get();
    if (!currentProject) return;
    
    const updatedProject: Project = {
      ...currentProject,
      components,
      updatedAt: new Date(),
    };
    
    saveProject(updatedProject);
    set({ currentProject: updatedProject });
  },

  updateCurrentProject: (updates) => {
    const { currentProject } = get();
    if (!currentProject) return;
    
    const updatedProject: Project = {
      ...currentProject,
      ...updates,
      updatedAt: new Date(),
    };
    
    saveProject(updatedProject);
    set({ currentProject: updatedProject });
  },
  
  loadProjectById: (id) => {
    const project = loadProject(id);
    if (project) {
      get().setCurrentProject(project);
    }
  },
  
  clearAll: () => {
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push([]);
      
      return {
        components: [],
        history: newHistory.slice(-50),
        historyIndex: Math.min(newHistory.length - 1, 49),
        selectedComponentId: null,
      };
    });
  },
}));
