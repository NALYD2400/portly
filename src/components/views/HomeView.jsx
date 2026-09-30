import React, { useMemo, useState } from 'react';
import {
  Play,
  Square,
  ExternalLink,
  FolderPlus,
  MousePointerClick,
  Rocket,
  Globe,
  Cpu,
  MemoryStick,
  CheckCircle2,
  MoonStar,
  AlertTriangle,
  Lightbulb,
  X,
  ArrowRight,
  Search,
  Keyboard,
} from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { startProject, stopProject, stopAll, openUrl, projectUrl } from '../../services/serverActions';

const RAM_WARN_MB = 2048;

function level(value, low, high) {
  if (value < low) return { label: 'Faible', tone: 'text-emerald-400' };
  if (value < high) return { label: 'Modérée', tone: 'text-amber-400' };
  return { label: 'Élevée', tone: 'text-rose-400' };
}

function fmtRam(mb) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} Go` : `${Math.round(mb)} Mo`;
}

function Welcome({ onAddProject }) {
  const steps = [
    {
      icon: FolderPlus,
      title: 'Ajoutez un dossier',
      text: 'Choisissez le dossier d’un site ou d’une application. Sprint reconnaît tout seul comment le démarrer.',
    },
    {
      icon: Play,
      title: 'Cliquez sur Lancer',
      text: 'Un seul bouton pour tout démarrer, sans taper de commande. Un autre pour tout arrêter.',
    },
    {
      icon: Globe,
      title: 'Ouvrez le résultat',
      text: 'Voyez votre projet dans le navigateur ou en version mobile, et gardez un œil sur ce qu’il consomme.',
    },
  ];

  return (
    <div className="page animate-fadeIn">
      <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface-2)] p-8 sm:p-12 text-center">
        <div className="w-14 h-14 rounded-2xl theme-accent-badge flex items-center justify-center mx-auto">
          <Rocket className="w-7 h-7" />
        </div>
        <h1 className="mt-6 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-50">Bienvenue dans Sprint</h1>
        <p className="mt-3 text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Lancez, surveillez et arrêtez vos projets en un clic. Que vous codiez tous les jours ou que vous débutiez,
          tout est expliqué et rien ne se passe dans votre dos.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3 flex-wrap">
          <button type="button" onClick={onAddProject} className="btn btn-lg theme-accent-btn">
            <FolderPlus className="w-5 h-5" />
            Ajouter mon premier projet
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">Vos fichiers ne sont jamais modifiés ni envoyés ailleurs.</p>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.title} className="rounded-2xl border border-[var(--line)] p-5 bg-[var(--surface-2)]">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full theme-accent-badge text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <Icon className="w-4 h-4 text-zinc-500" />
              </div>
              <h2 className="mt-3 text-[15px] font-semibold text-zinc-50">{s.title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">{s.text}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Meter({ icon: Icon, label, valueText, pct, lvl }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] text-zinc-400">
          <Icon className="w-4 h-4 text-zinc-500" />
          {label}
        </span>
        <span className={`text-xs font-medium ${lvl.tone}`}>{lvl.label}</span>
      </div>
      <div className="mt-2 stat-value text-2xl font-semibold text-zinc-50">{valueText}</div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="meter mt-3"
      >
        <span style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

export default function HomeView({ metrics, projects, onSelectTab, onAddProject, onOpenBrowser, onOpenHelp, onOpenPalette }) {
  const [busy, setBusy] = useState({});
  const [tipsHidden, setTipsHidden] = useState(() => {
    try {
      return localStorage.getItem('sprint_tips_hidden') === '1';
    } catch {
      return false;
    }
  });

  const running = useMemo(
    () => projects.filter((p) => (p.servers || []).some((s) => s.state === 'running')),
    [projects]
  );
  const runningServers = running.reduce((n, p) => n + p.servers.filter((s) => s.state === 'running').length, 0);
  const cpu = metrics.managed_cpu_pct || 0;
  const ram = metrics.managed_ram_mb || 0;
  const heavy = ram > RAM_WARN_MB;

  if (projects.length === 0) return <Welcome onAddProject={onAddProject} />;

  const withBusy = async (id, fn) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await fn();
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const status = heavy
    ? {
        icon: AlertTriangle,
        tone: 'border-amber-500/30 bg-amber-500/[0.07]',
        iconTone: 'text-amber-400',
        title: 'Vos applications utilisent beaucoup de mémoire',
        text: 'Si votre ordinateur ralentit, arrêtez celles dont vous n’avez pas besoin.',
      }
    : runningServers > 0
      ? {
          icon: CheckCircle2,
          tone: 'border-emerald-500/25 bg-emerald-500/[0.06]',
          iconTone: 'text-emerald-400',
          title: `${runningServers} ${runningServers > 1 ? 'applications tournent' : 'application tourne'}, tout va bien`,
          text: 'Elles sont en marche et consomment peu de ressources.',
        }
      : {
          icon: MoonStar,
          tone: 'border-[var(--line)] bg-[var(--surface-2)]',
          iconTone: 'text-zinc-500',
          title: 'Rien ne tourne pour le moment',
          text: 'Choisissez un projet ci-dessous et cliquez sur Lancer.',
        };
  const StatusIcon = status.icon;

  const hideTips = () => {
    setTipsHidden(true);
    try {
      localStorage.setItem('sprint_tips_hidden', '1');
    } catch {
      // ignoré : le message réapparaîtra simplement au prochain lancement
    }
  };

  return (
    <div className="page animate-fadeIn">
      <PageHeader
        title="Accueil"
        lead="Vos projets, leur état et ce qu’ils consomment, en un coup d’œil."
        actions={
          <>
            <button type="button" onClick={onOpenPalette} className="btn">
              <Search className="w-4 h-4" />
              Rechercher
              <kbd className="key">Ctrl K</kbd>
            </button>
            <button type="button" onClick={onAddProject} className="btn theme-accent-btn">
              <FolderPlus className="w-4 h-4" />
              Ajouter un projet
            </button>
          </>
        }
      />

      {/* Bilan en une phrase */}
      <section
        aria-live="polite"
        className={`rounded-2xl border p-5 flex items-center justify-between gap-4 flex-wrap ${status.tone}`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <StatusIcon className={`w-8 h-8 shrink-0 ${status.iconTone}`} strokeWidth={1.75} />
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-zinc-50">{status.title}</h2>
            <p className="text-[13px] text-zinc-400 mt-0.5">{status.text}</p>
          </div>
        </div>
        {runningServers > 0 && (
          <button
            type="button"
            onClick={() => withBusy('all', () => stopAll(projects))}
            disabled={busy.all}
            className="btn text-rose-400 hover:!bg-rose-500/10 border-rose-500/30 disabled:opacity-50"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Tout arrêter
          </button>
        )}
      </section>

      {/* Ressources : mots simples, chiffres en soutien */}
      {runningServers > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4" aria-label="Ressources utilisées">
          <Meter
            icon={Cpu}
            label="Processeur"
            valueText={`${cpu.toFixed(0)} %`}
            pct={Math.min(100, cpu)}
            lvl={level(cpu, 30, 70)}
          />
          <Meter
            icon={MemoryStick}
            label="Mémoire"
            valueText={fmtRam(ram)}
            pct={Math.min(100, (ram / RAM_WARN_MB) * 100)}
            lvl={level(ram, 1024, RAM_WARN_MB)}
          />
        </section>
      )}

      {/* Projets */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-50">Mes projets</h2>
          <button
            type="button"
            onClick={() => onSelectTab('projects')}
            className="text-[13px] text-zinc-400 hover:text-zinc-100 flex items-center gap-1 cursor-pointer"
          >
            Tout gérer <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {projects.map((p) => {
            const servers = p.servers || [];
            const runCount = servers.filter((s) => s.state === 'running').length;
            const isRunning = runCount > 0;
            const url = isRunning ? projectUrl(p) : null;
            const color = p.color || 'var(--accent-color)';
            const pm = servers.reduce(
              (acc, s) => {
                const m = (metrics.server_metrics || {})[s.id];
                if (m && s.state === 'running') {
                  acc.cpu += m.cpu_usage || 0;
                  acc.ram += m.ram_mb || 0;
                }
                return acc;
              },
              { cpu: 0, ram: 0 }
            );
            const meta = [p.framework, p.branch].filter(Boolean).join(' · ');

            return (
              <li
                key={p.id}
                className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4 flex flex-col gap-4 hover:border-[var(--line-strong)] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectTab('projects')}
                    className="min-w-0 text-left cursor-pointer"
                    title="Voir les détails du projet"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <h3 className="text-[15px] font-semibold text-zinc-50 truncate">{p.name}</h3>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 truncate">{meta || p.root}</p>
                  </button>
                  <span
                    className={`chip shrink-0 ${isRunning ? '!bg-emerald-500/12 !text-emerald-400' : ''}`}
                    role="status"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 live-dot' : 'bg-zinc-500'}`} />
                    {isRunning ? 'En marche' : servers.length === 0 ? 'Aucune commande' : 'Arrêté'}
                  </span>
                </div>

                {isRunning && (
                  <p className="text-xs text-zinc-500 stat-value">
                    {pm.cpu.toFixed(0)} % processeur · {fmtRam(pm.ram)} mémoire
                  </p>
                )}

                <div className="flex items-center gap-2 flex-wrap mt-auto">
                  {servers.length === 0 ? (
                    <button type="button" onClick={() => onSelectTab('projects')} className="btn">
                      <MousePointerClick className="w-4 h-4" />
                      Ajouter une commande
                    </button>
                  ) : isRunning ? (
                    <button
                      type="button"
                      disabled={busy[p.id]}
                      onClick={() => withBusy(p.id, () => stopProject(p))}
                      className="btn text-rose-400 border-rose-500/30 hover:!bg-rose-500/10 disabled:opacity-50"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      Arrêter
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy[p.id]}
                      onClick={() => withBusy(p.id, () => startProject(p))}
                      className="btn theme-accent-btn disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Lancer
                    </button>
                  )}
                  {url && (
                    <>
                      <button type="button" onClick={() => onOpenBrowser(servers[0]?.id, url)} className="btn">
                        <Globe className="w-4 h-4" />
                        Aperçu
                      </button>
                      <button
                        type="button"
                        onClick={() => openUrl(url)}
                        className="btn !px-2.5"
                        title="Ouvrir dans mon navigateur"
                        aria-label="Ouvrir dans mon navigateur"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Astuces : disparaissent une fois comprises */}
      {!tipsHidden && (
        <aside className="mt-8 rounded-2xl border border-[var(--line)] p-5 relative">
          <button
            type="button"
            onClick={hideTips}
            aria-label="Masquer les astuces"
            className="absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.06] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-semibold text-zinc-50 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            Bon à savoir
          </h2>
          <ul className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-[13px] text-zinc-400 leading-relaxed">
            <li>
              <kbd className="key">Ctrl K</kbd> ouvre la recherche : trouvez un projet ou une page en tapant quelques lettres.
            </li>
            <li>
              <kbd className="key">Ctrl 1</kbd> à <kbd className="key">Ctrl 5</kbd> changent de page sans toucher la souris.
            </li>
            <li>
              <button type="button" onClick={onOpenHelp} className="inline-flex items-center gap-1.5 theme-accent-text hover:underline cursor-pointer">
                <Keyboard className="w-3.5 h-3.5" /> Voir tous les raccourcis
              </button>{' '}
              ou appuyez sur <kbd className="key">?</kbd>.
            </li>
          </ul>
        </aside>
      )}
    </div>
  );
}
