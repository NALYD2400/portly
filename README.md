# Portly

Superviseur de processus de développement local haute performance — moteur natif Rust (Tauri 2), interface React 19 + Tailwind 4.

## Fonctionnalités

- **Gestion de projets & serveurs** : démarrez/arrêtez vos serveurs de dev (`npm run dev`, `cargo run`, `python main.py`...) avec détection automatique du stack, branche git et éditeur `.env` intégré.
- **Logs temps réel** : streaming stdout/stderr multi-consoles (vue divisée), filtrage, tolérant aux encodages Windows non-UTF-8, batché pour rester fluide même sur un serveur bavard.
- **Télémétrie CPU/RAM** : consommation par serveur (process racine + enfants), rafraîchie toutes les 2 s.
- **Inspecteur de ports TCP** : scan natif via l'API Windows (`GetExtendedTcpTable`) — indépendant de la langue du système — avec identification des serveurs Portly.
- **Auto-Restart Anti-Crash** : relance automatique d'un serveur qui plante (max 3 relances / 2 min).
- **Auto-Guard RAM** : redémarrage automatique d'un serveur qui dépasse sa limite de mémoire configurée (cooldown 30 s).
- **Tunnels publics** : partage d'un port local via localtunnel en un clic, process tracké et nettoyé à la fermeture.
- **Palette de commandes** (`Ctrl+K`) : navigation, projets, VS Code, terminaux — entièrement navigable au clavier.
- **Thème dynamique** : couleur d'accent personnalisable (#HEX) synchronisée sur toute l'interface, vagues canvas réactives.
- **Auto-update** : téléchargement des releases GitHub avec validation du domaine source et dossier de staging aléatoire.

## Stack

| Couche | Technologies |
|---|---|
| Backend | Rust, Tauri 2, tokio, sysinfo, netstat2 |
| Frontend | React 19, Vite 8, Tailwind CSS 4 |
| Outils | oxlint, parking_lot |

## Développement

```bash
npm install
npm run tauri dev    # lance l'app en mode développement
```

## Build de production

```bash
npm run tauri build  # produit l'installateur NSIS (dist/ + src-tauri/target)
```

## Structure

```
src/
  components/
    layout/      # TitleBar, Sidebar
    views/       # Dashboard, Projects, Ports, Terminal, Settings
    modals/      # Modal de base + ConfirmDialog + formulaires
    ui/          # Modal, ConfirmDialog, Toasts, ContextMenu, Toggle...
  hooks/
    useTauriIPC.js  # état projets, logs batchés, métriques, auto-restart
src-tauri/src/
  lib.rs             # commandes IPC, tray, update, tunnels
  process_manager.rs # spawn/kill des process + streaming logs
  system_metrics.rs  # télémétrie CPU/RAM + Auto-Guard RAM
  port_inspector.rs  # scan des ports TCP (API native)
  config_store.rs    # persistance atomique (tmp + rename, quarantaine)
  project_scanner.rs # détection de stack + branche git
```

## Config utilisateur

`%APPDATA%\portly\projects.json` — écriture atomique (`.tmp` + rename) ; un fichier corrompu est mis en quarantaine (`projects.corrupt-*.json`) plutôt qu'écrasé.
