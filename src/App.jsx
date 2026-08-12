import React, { useState, useEffect } from 'react';
import ColorBendsBackground from './components/ui/ColorBendsBackground';
import TitleBar from './components/layout/TitleBar';
import Sidebar from './components/layout/Sidebar';
import DashboardView from './components/views/DashboardView';
import ProjectsView from './components/views/ProjectsView';
import PortsView from './components/views/PortsView';
import TerminalView from './components/views/TerminalView';
import SettingsView from './components/views/SettingsView';
import ContextMenu from './components/ui/ContextMenu';
import AddProjectModal from './components/modals/AddProjectModal';
import CommandPaletteModal from './components/modals/CommandPaletteModal';
import EnvEditorModal from './components/modals/EnvEditorModal';
import EditProjectModal from './components/modals/EditProjectModal';
import EditServerModal from './components/modals/EditServerModal';
import AddServerModal from './components/modals/AddServerModal';
import AutoUpdateModal from './components/modals/AutoUpdateModal';
import ToastContainer from './components/ui/ToastContainer';
import { useProjects, useSystemMetrics } from './hooks/useTauriIPC';

import pkg from '../package.json';

const CURRENT_APP_VERSION = pkg.version;

function isNewerVersion(latest, current) {
  if (!latest || !current) return false;
  const cleanL = latest.replace(/^v/, '').trim();
  const cleanC = current.replace(/^v/, '').trim();
  const lParts = cleanL.split('.').map((p) => parseInt(p, 10) || 0);
  const cParts = cleanC.split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
    const l = lParts[i] || 0;
    const c = cParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('projects');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [envModalRoot, setEnvModalRoot] = useState(null);
  const [editProjectTarget, setEditProjectTarget] = useState(null);
  const [editServerTarget, setEditServerTarget] = useState(null);
  const [addServerProject, setAddServerProject] = useState(null);
  const [selectedTerminal, setSelectedTerminal] = useState({ id: null, name: null });

  const { projects, setProjects, saveProjects, loading } = useProjects();
  const metrics = useSystemMetrics();

  // Check for updates on GitHub Releases silently at app launch
  useEffect(() => {
    const checkUpdateOnLaunch = async () => {
      try {
        const res = await fetch('https://api.github.com/repos/NALYD2400/portly/releases/latest', {
          headers: { Accept: 'application/vnd.github.v3+json' },
        });
        if (res.ok) {
          const data = await res.json();
          const tag = data.tag_name ? data.tag_name.replace(/^v/, '') : '';
          if (tag && isNewerVersion(tag, CURRENT_APP_VERSION)) {
            setUpdateAvailable(true);
          }
        }
      } catch (e) {
        console.warn('Update check at launch failed:', e);
      }
    };
    checkUpdateOnLaunch();
  }, []);

  // Initialize custom Hex accent color & Register Global OS Shortcut at launch
  useEffect(() => {
    const savedHex = localStorage.getItem('portly_custom_hex');
    if (savedHex && savedHex.startsWith('#')) {
      let c = savedHex.replace('#', '');
      if (c.length === 3) c = c.split('').map((x) => x + x).join('');
      const num = parseInt(c, 16);
      if (!isNaN(num)) {
        const rgb = `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
        document.documentElement.style.setProperty('--accent-color', savedHex);
        document.documentElement.style.setProperty('--accent-color-rgb', rgb);
      }
    }

    const savedShortcut = localStorage.getItem('portly_cfg_shortcut') || 'Ctrl+Alt+P';
    setTimeout(() => {
      invoke('register_global_shortcut_cmd', { shortcut: savedShortcut }).catch((e) => {
        console.warn('Non-critical: Global shortcut registration fallback:', e);
      });
    }, 500);
  }, []);

  // Global Ctrl+K / Cmd+K Command Palette Shortcut Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [showCanvasBg, setShowCanvasBg] = useState(() => localStorage.getItem('portly_cfg_canvas') !== 'false');

  useEffect(() => {
    const handleCanvasToggle = () => {
      setShowCanvasBg(localStorage.getItem('portly_cfg_canvas') !== 'false');
    };
    window.addEventListener('storage', handleCanvasToggle);
    window.addEventListener('portly_canvas_toggle', handleCanvasToggle);
    return () => {
      window.removeEventListener('storage', handleCanvasToggle);
      window.removeEventListener('portly_canvas_toggle', handleCanvasToggle);
    };
  }, []);

  const activeServersCount = projects.reduce(
    (acc, p) => acc + (p.servers || []).filter((s) => s.state === 'running').length,
    0
  );

  const handleOpenTerminal = (serverId, serverName) => {
    setSelectedTerminal({ id: serverId, name: serverName });
    setActiveTab('terminal');
  };

  const handleAddProject = (newProject) => {
    const updated = [...projects, newProject];
    saveProjects(updated);
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden relative font-sans text-gray-100 bg-[#07070c]">
      {/* ReactBits Dynamic Animated ColorBends Canvas Background */}
      {showCanvasBg && <ColorBendsBackground />}

      {/* Global Right-Click App Context Menu */}
      <ContextMenu
        onOpenCommandPalette={() => setIsPaletteOpen(true)}
        onSelectTab={setActiveTab}
      />

      {/* Custom Frameless Windows TitleBar */}
      <TitleBar />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden z-10">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeServersCount={activeServersCount}
          onAddProject={() => setIsAddModalOpen(true)}
          onOpenCommandPalette={() => setIsPaletteOpen(true)}
          onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
          updateAvailable={updateAvailable}
        />

        {/* View Container */}
        <main className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center font-mono text-xs text-gray-400">
              Chargement des projets Portly...
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  metrics={metrics}
                  projects={projects}
                  onSelectTab={setActiveTab}
                />
              )}

              {activeTab === 'projects' && (
                <ProjectsView
                  projects={projects}
                  saveProjects={saveProjects}
                  onOpenTerminal={handleOpenTerminal}
                  onOpenEnvModal={(root) => setEnvModalRoot(root)}
                  onAddProject={() => setIsAddModalOpen(true)}
                  onEditProject={(project) => setEditProjectTarget(project)}
                  onEditServer={(target) => setEditServerTarget(target)}
                  onAddServer={(project) => setAddServerProject(project)}
                />
              )}

              {activeTab === 'ports' && <PortsView projects={projects} />}

              {activeTab === 'terminal' && (
                <TerminalView
                  projects={projects}
                  initialServerId={selectedTerminal.id}
                  onSelectTab={setActiveTab}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  projects={projects}
                  onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      <AddProjectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddProject={handleAddProject}
      />

      <CommandPaletteModal
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        projects={projects}
        onOpenTerminal={handleOpenTerminal}
        onSelectTab={setActiveTab}
        onAddProject={() => setIsAddModalOpen(true)}
      />

      <EnvEditorModal
        isOpen={!!envModalRoot}
        projectRoot={envModalRoot}
        onClose={() => setEnvModalRoot(null)}
      />

      <EditProjectModal
        isOpen={!!editProjectTarget}
        project={editProjectTarget}
        projects={projects}
        saveProjects={saveProjects}
        onClose={() => setEditProjectTarget(null)}
      />

      <EditServerModal
        editTarget={editServerTarget}
        projects={projects}
        saveProjects={saveProjects}
        onClose={() => setEditServerTarget(null)}
      />

      <AddServerModal
        isOpen={!!addServerProject}
        onClose={() => setAddServerProject(null)}
        project={addServerProject}
        projects={projects}
        saveProjects={saveProjects}
      />

      <AutoUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        currentVersion={CURRENT_APP_VERSION}
      />

      <ToastContainer />
    </div>
  );
}
