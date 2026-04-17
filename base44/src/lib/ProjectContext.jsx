import React, { createContext, useContext, useState, useCallback } from "react";
import * as api from "@/api/convergenceClient";

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshProjects = useCallback(async () => {
    try {
      const data = await api.listProjects();
      setProjects(data);
    } catch {
      // backend may not be running yet — keep using local state
    }
  }, []);

  const createProject = useCallback(async (name, description) => {
    setLoading(true);
    setError(null);
    try {
      const proj = await api.createProject(name, description);
      setCurrentProjectId(proj.id);
      await refreshProjects();
      return proj;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [refreshProjects]);

  const selectProject = useCallback((id) => {
    setCurrentProjectId(id);
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        currentProjectId,
        projects,
        loading,
        error,
        createProject,
        selectProject,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be inside ProjectProvider");
  return ctx;
}
