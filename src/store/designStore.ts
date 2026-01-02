import { create } from 'zustand';
import { Component, Project, Summary } from '@/types';
import { calculateMeasurements } from '@/utils/measurements';
import { saveProject, loadProject, saveGridVisibility, loadGridVisibility, saveAnnotationsVisibility, loadAnnotationsVisibility, saveProjectViewState, loadProjectViewState, saveProjectHistory, loadProjectHistory } from '@/utils/storage';
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
  satelliteVisible: boolean;
  satelliteRotation: number; // Rotation in degrees
  annotationsVisible: boolean;
  blueprintMode: boolean; // Technical/construction style rendering
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
  updateComponentSilent: (id: string, updates: Partial<Component>) => void; // No history entry
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
  toggleSatellite: () => void;
  setSatelliteRotation: (rotation: number) => void;
  toggleAnnotations: () => void;
  toggleBlueprintMode: () => void;
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
  gridVisible: loadGridVisibility(),
  satelliteVisible: false,
  satelliteRotation: 0,
  annotationsVisible: loadAnnotationsVisibility(),
  blueprintMode: false, // Session-only, defaults to off
  snapEnabled: true,
  zoomLocked: false,
  
  history: [[]],
  historyIndex: 0,
  
  tileSelection: null,
  
  setCurrentProject: (project) => {
    set((state) => {
      const switchingProject = state.currentProject?.id !== project?.id;
      // Default view state
      let nextZoom = state.zoom;
      let nextPan = state.pan;
      // Default components and history
      let nextComponents = project?.components || [];
      let nextHistory: Component[][] = [nextComponents];
      let nextHistoryIndex = 0;

      // If switching to a new/different project, try load saved state
      if (switchingProject && project?.id) {
        // Load view state
        const view = loadProjectViewState(project.id);
        if (view) {
          nextZoom = view.zoom;
          nextPan = view.pan;
        } else {
          // Fallback defaults when no saved state for this project
          nextZoom = 1;
          nextPan = { x: 0, y: 0 };
        }

        // Load undo/redo history
        const savedHistory = loadProjectHistory(project.id);
        if (savedHistory && savedHistory.history.length > 0) {
          nextHistory = savedHistory.history;
          nextHistoryIndex = Math.min(savedHistory.historyIndex, savedHistory.history.length - 1);
          // Use the components from the current history position, not the saved project
          nextComponents = nextHistory[nextHistoryIndex] || nextComponents;
        }
      }

      return {
        currentProject: project,
        components: nextComponents,
        selectedComponentId: null,
        history: nextHistory,
        historyIndex: nextHistoryIndex,
        // Apply possibly-restored view state
        zoom: nextZoom,
        pan: nextPan,
      };
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
      const trimmedHistory = newHistory.slice(-50);
      const newHistoryIndex = Math.min(newHistory.length - 1, 49);

      // Persist history to localStorage (async)
      const projectId = state.currentProject?.id;
      if (projectId) {
        setTimeout(() => {
          try {
            saveProjectHistory(projectId, { history: trimmedHistory, historyIndex: newHistoryIndex });
          } catch (e) {
            console.error('Failed to save history:', e);
          }
        }, 0);
      }

      return {
        components: newComponents,
        history: trimmedHistory,
        historyIndex: newHistoryIndex,
        selectedComponentId: newComponent.id,
      };
    });
  },
  
  updateComponent: (id, updates) => {
    set((state) => {
      const newComponents = state.components.map(c => {
        if (c.id !== id) return c;
        // Deep merge properties if both exist
        const mergedProperties = updates.properties
          ? { ...c.properties, ...updates.properties }
          : c.properties;
        return { ...c, ...updates, properties: mergedProperties };
      });
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newComponents);
      const trimmedHistory = newHistory.slice(-50);
      const newHistoryIndex = Math.min(newHistory.length - 1, 49);

      // Persist history to localStorage (async to avoid blocking)
      const projectId = state.currentProject?.id;
      if (projectId) {
        setTimeout(() => {
          try {
            saveProjectHistory(projectId, { history: trimmedHistory, historyIndex: newHistoryIndex });
          } catch (e) {
            console.error('Failed to save history:', e);
          }
        }, 0);
      }

      return {
        components: newComponents,
        history: trimmedHistory,
        historyIndex: newHistoryIndex,
      };
    });
  },

  // Silent update - no history entry, for derived data like statistics
  updateComponentSilent: (id, updates) => {
    set((state) => {
      const newComponents = state.components.map(c => {
        if (c.id !== id) return c;
        // Deep merge properties if both exist
        const mergedProperties = updates.properties
          ? { ...c.properties, ...updates.properties }
          : c.properties;
        return { ...c, ...updates, properties: mergedProperties };
      });
      // Update components but NOT history - preserves undo/redo stack
      return { components: newComponents };
    });
  },

  deleteComponent: (id) => {
    set((state) => {
      const newComponents = state.components.filter(c => c.id !== id);
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newComponents);
      const trimmedHistory = newHistory.slice(-50);
      const newHistoryIndex = Math.min(newHistory.length - 1, 49);

      // Persist history to localStorage (async)
      const projectId = state.currentProject?.id;
      if (projectId) {
        setTimeout(() => {
          try {
            saveProjectHistory(projectId, { history: trimmedHistory, historyIndex: newHistoryIndex });
          } catch (e) {
            console.error('Failed to save history:', e);
          }
        }, 0);
      }

      return {
        components: newComponents,
        history: trimmedHistory,
        historyIndex: newHistoryIndex,
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

        // Persist history index to localStorage (async)
        const projectId = state.currentProject?.id;
        const history = state.history;
        if (projectId) {
          setTimeout(() => {
            try {
              saveProjectHistory(projectId, { history, historyIndex: newIndex });
            } catch (e) {
              console.error('Failed to save history:', e);
            }
          }, 0);
        }

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

        // Persist history index to localStorage (async)
        const projectId = state.currentProject?.id;
        const history = state.history;
        if (projectId) {
          setTimeout(() => {
            try {
              saveProjectHistory(projectId, { history, historyIndex: newIndex });
            } catch (e) {
              console.error('Failed to save history:', e);
            }
          }, 0);
        }

        return {
          components: state.history[newIndex],
          historyIndex: newIndex,
        };
      }
      return state;
    });
  },
  
  setZoom: (zoom) => set((state) => {
    const projectId = state.currentProject?.id;
    if (projectId) {
      saveProjectViewState(projectId, { zoom, pan: state.pan });
    }
    return { zoom };
  }),
  setPan: (pan) => set((state) => {
    const projectId = state.currentProject?.id;
    if (projectId) {
      saveProjectViewState(projectId, { zoom: state.zoom, pan });
    }
    return { pan };
  }),
  toggleGrid: () => set((state) => {
    const newGridVisible = !state.gridVisible;
    saveGridVisibility(newGridVisible);
    return { gridVisible: newGridVisible };
  }),
  toggleSatellite: () => set((state) => ({ satelliteVisible: !state.satelliteVisible })),
  setSatelliteRotation: (rotation: number) => set({ satelliteRotation: rotation }),
  toggleBlueprintMode: () => set((state) => ({ blueprintMode: !state.blueprintMode })),
  toggleAnnotations: () => set((state) => {
    const newAnnotationsVisible = !state.annotationsVisible;
    saveAnnotationsVisibility(newAnnotationsVisible);
    return { annotationsVisible: newAnnotationsVisible };
  }),
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
      const trimmedHistory = newHistory.slice(-50);
      const newHistoryIndex = Math.min(newHistory.length - 1, 49);

      // Persist history to localStorage (async)
      const projectId = state.currentProject?.id;
      if (projectId) {
        setTimeout(() => {
          try {
            saveProjectHistory(projectId, { history: trimmedHistory, historyIndex: newHistoryIndex });
          } catch (e) {
            console.error('Failed to save history:', e);
          }
        }, 0);
      }

      return {
        components: [],
        history: trimmedHistory,
        historyIndex: newHistoryIndex,
        selectedComponentId: null,
      };
    });
  },
}));
