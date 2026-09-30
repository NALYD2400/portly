import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ColorBendsBackground from './components/ui/ColorBendsBackground';
import TitleBar from './components/layout/TitleBar';
import Sidebar from './components/layout/Sidebar';
import DashboardView from './components/views/DashboardView';
import ProjectsView from './components/views/ProjectsView';
import PortsView from './components/views/PortsView';
import TerminalView from './components/views/TerminalView';
import BrowserView from './components/views/BrowserView';
import SettingsView from './components/views/SettingsView';
import ContextMenu from './components/ui/ContextMenu';
import AddProjectModal from './components/modals/AddProjectModal';
import CommandPaletteModal from './components/modals/CommandPaletteModal';
import EnvEditorModal from './components/modals/EnvEditorModal';
import EditProjectModal from './components/modals/EditProjectModal';
import ServerFormModal from './components/modals/ServerFormModal';
import AutoUpdateModal from './components/modals/AutoUpdateModal';
import IframePreviewModal from './components/modals/IframePreviewModal';
import ToastContainer from './components/ui/ToastContainer';
import { useProjects, useSystemMetrics } from './hooks/useTauriIPC';

import pkg from '../package.json';

const CURRENT_APP_VERSION = pkg.version;
const GITHUB_REPO = 'NALYD2400/portly';

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
  const [serverForm, setServerForm] = useState(null); // { mode: 'add'|'edit', project, server }
  const [selectedTerminal, setSelectedTerminal] = useState({ id: null, name: null });
  const [browserTarget, setBrowserTarget] = useState({ serverId: null, url: null });
  const [iframeModalTarget, setIframeModalTarget] = useState(null); // { url, title }

  const { projects, saveProjects, reload: reloadProjects, loading } = useProjects();
  const metrics = useSystemMetrics();

  // Check for updates on GitHub Releases silently at app launch
  useEffect(() => {
    const checkUpdateOnLaunch = async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
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
    const shortcutTimer = setTimeout(() => {
      invoke('register_global_shortcut_cmd', { shortcut: savedShortcut }).catch((e) => {
        console.warn('Non-critical: Global shortcut registration fallback:', e);
      });
    }, 500);
    return () => clearTimeout(shortcutTimer);
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

  const handleOpenBrowser = (serverId, url) => {
    setBrowserTarget({ serverId, url });
    setActiveTab('browser');
  };

  const handleAddProject = (newProject) => {
    const updated = [...projects, newProject];
    saveProjects(updated);
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden relative font-sans text-zinc-100 bg-[var(--bg-base)]">
      {/* Arrière-plan animé optionnel, volontairement discret */}
      {showCanvasBg && (
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <ColorBendsBackground />
        </div>
      )}

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
          onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
          updateAvailable={updateAvailable}
          onOpenCommandPalette={() => setIsPaletteOpen(true)}
        />

        {/* View Container */}
        <main className="flex-1 min-w-0 px-10 py-8 overflow-y-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-zinc-500">
              Chargement des projets…
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  metrics={metrics}
                  projects={projects}
                  onSelectTab={setActiveTab}
                  onOpenBrowser={handleOpenBrowser}
                  onAddProject={() => setIsAddModalOpen(true)}
                />
              )}

              {activeTab === 'projects' && (
                <ProjectsView
                  projects={projects}
                  saveProjects={saveProjects}
                  onOpenTerminal={handleOpenTerminal}
                  onOpenBrowser={handleOpenBrowser}
                  onOpenEnvModal={(root) => setEnvModalRoot(root)}
                  onAddProject={() => setIsAddModalOpen(true)}
                  onEditProject={(project) => setEditProjectTarget(project)}
                  onEditServer={({ project, server }) =>
                    setServerForm({ mode: 'edit', project, server })
                  }
                  onAddServer={(project) => setServerForm({ mode: 'add', project })}
                  onOpenIframeModal={(target) => setIframeModalTarget(target)}
                />
              )}

              {activeTab === 'browser' && (
                <BrowserView
                  projects={projects}
                  initialServerId={browserTarget.serverId}
                  initialUrl={browserTarget.url}
                  onSelectTab={setActiveTab}
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
                  reloadProjects={reloadProjects}
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

      <ServerFormModal
        mode={serverForm?.mode || 'add'}
        isOpen={!!serverForm}
        project={serverForm?.project}
        server={serverForm?.server}
        projects={projects}
        saveProjects={saveProjects}
        onClose={() => setServerForm(null)}
      />

      <AutoUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        currentVersion={CURRENT_APP_VERSION}
      />

      {iframeModalTarget && (
        <IframePreviewModal
          isOpen={!!iframeModalTarget}
          onClose={() => setIframeModalTarget(null)}
          url={iframeModalTarget.url}
          title={iframeModalTarget.title}
        />
      )}

      <ToastContainer />
    </div>
  );
}
