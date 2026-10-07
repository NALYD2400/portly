import { invoke } from '@tauri-apps/api/core';
import { triggerToast } from './toastBus';
import { markManualStop, unmarkManualStop } from '../hooks/useTauriIPC';

/** Lance tous les serveurs arrêtés d'un projet. */
export async function startProject(project) {
  const todo = (project.servers || []).filter((s) => s.state !== 'running');
  if (todo.length === 0) return;
  const results = await Promise.allSettled(
    todo.map((srv) =>
      invoke('start_server_cmd', {
        serverId: srv.id,
        cwd: project.root,
        command: srv.command,
        env: srv.env || {},
      })
    )
  );
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    triggerToast({
      title: 'Le lancement a échoué',
      message: String(failed[0].reason),
      type: 'error',
    });
  } else {
    triggerToast({
      title: `${project.name} est lancé`,
      message: todo.length > 1 ? `${todo.length} serveurs démarrés.` : 'Le serveur démarre…',
      type: 'success',
    });
  }
}

/** Arrête tous les serveurs en marche d'un projet. */
export async function stopProject(project, { silent = false } = {}) {
  const running = (project.servers || []).filter((s) => s.state === 'running');
  let failures = 0;
  for (const srv of running) {
    markManualStop(srv.id);
    try {
      await invoke('stop_server_cmd', { serverId: srv.id });
    } catch (e) {
      unmarkManualStop(srv.id);
      if (!String(e).includes("n'est pas en cours")) {
        failures++;
        triggerToast({ title: `Impossible d'arrêter ${srv.name}`, message: String(e), type: 'error' });
      }
    }
  }
  if (!silent && running.length > 0 && failures === 0) {
    triggerToast({ title: `${project.name} est arrêté`, message: 'Tout a été arrêté proprement.', type: 'info' });
  }
  return failures === 0;
}

export async function stopAll(projects) {
  let complete = true;
  for (const p of projects) { if (!await stopProject(p, { silent: true })) complete = false; }
  if (complete) triggerToast({ title: 'Tout est arrêté', message: 'Vos serveurs Sprint ont été arrêtés.', type: 'info' });
  return complete;
}

export function openUrl(url) {
  return invoke('open_browser', { url }).catch((e) =>
    triggerToast({ title: "Impossible d'ouvrir le navigateur", message: String(e), type: 'error' })
  );
}

/** Première URL locale utilisable d'un projet (serveur en marche de préférence). */
export function projectUrl(project) {
  const servers = project.servers || [];
  const pick = servers.find((s) => s.state === 'running' && (s.url || s.port > 0)) || servers.find((s) => s.url || s.port > 0);
  if (project.url) return project.url;
  if (!pick) return null;
  return pick.url || `http://localhost:${pick.port}`;
}
