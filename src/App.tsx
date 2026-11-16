import { useEffect, useState } from 'react';
import { PERIOD, POOL, USERS, UserId } from './domain/data';
import { PROFILES, ProfileId } from './domain/posting';
import { BreakScenario, useApp } from './state';
import { useRecon } from './derived';
import Overview from './screens/Overview';
import Intake from './screens/Intake';
import Allocation from './screens/Allocation';
import Approval from './screens/Approval';
import JournalScreen from './screens/Journal';
import Distribution from './screens/Distribution';
import Reconciliation from './screens/Reconciliation';
import Statements from './screens/Statements';
import Audit from './screens/Audit';

export type ScreenId =
  | 'overview'
  | 'intake'
  | 'allocation'
  | 'approval'
  | 'journal'
  | 'distribution'
  | 'recon'
  | 'statements'
  | 'audit';

const SCREENS: Array<{ id: ScreenId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'intake', label: 'Intake & readiness' },
  { id: 'allocation', label: 'Allocation' },
  { id: 'approval', label: 'Approval' },
  { id: 'journal', label: 'ERP journal' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'recon', label: 'Reconciliation' },
  { id: 'statements', label: 'Participant statements' },
  { id: 'audit', label: 'Audit & replay' },
];

function readHash(): ScreenId {
  const h = window.location.hash.replace('#', '') as ScreenId;
  return SCREENS.some((x) => x.id === h) ? h : 'overview';
}

export default function App() {
  const { s, dispatch } = useApp();
  const [screen, setScreen] = useState<ScreenId>(readHash);
  const recon = useRecon(s);

  useEffect(() => {
    const on = () => setScreen(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    if (!s.toast) return;
    const t = setTimeout(() => dispatch({ type: 'dismissToast' }), 5000);
    return () => clearTimeout(t);
  }, [s.toast, dispatch]);

  const go = (id: ScreenId) => {
    window.location.hash = id;
    setScreen(id);
    window.scrollTo(0, 0);
  };

  const done: Record<ScreenId, boolean> = {
    overview: true,
    intake: true,
    allocation: s.run.status !== 'draft',
    approval: s.run.status === 'approved',
    journal: !!s.allocationAck && !!s.distributionAck,
    distribution: s.bankImported,
    recon: s.periodClosed,
    statements: s.periodClosed,
    audit: false,
  };

  const Screen = {
    overview: Overview,
    intake: Intake,
    allocation: Allocation,
    approval: Approval,
    journal: JournalScreen,
    distribution: Distribution,
    recon: Reconciliation,
    statements: Statements,
    audit: Audit,
  }[screen];

  return (
    <>
      <header className="topbar">
        <div className="brand">
          Treasury NVEST<small>{POOL.id} · {PERIOD.label}</small>
        </div>
        <div className="spacer" />
        <div>
          <label htmlFor="user">Acting as</label>
          <select id="user" value={s.user} onChange={(e) => dispatch({ type: 'setUser', user: e.target.value as UserId })}>
            {USERS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.role}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="erp">Customer ERP</label>
          <select id="erp" value={s.profile} onChange={(e) => dispatch({ type: 'setProfile', profile: e.target.value as ProfileId })}>
            {Object.values(PROFILES).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="scn">Scenario</label>
          <select id="scn" value={s.scenario} onChange={(e) => dispatch({ type: 'setScenario', scenario: e.target.value as BreakScenario })}>
            <option value="none">Clean month</option>
            <option value="cash">Bank break (returned payment)</option>
            <option value="source">Source break (late trade)</option>
          </select>
        </div>
        <button
          onClick={() => {
            if (window.confirm('Reset the demo to the start of the month?')) {
              dispatch({ type: 'reset' });
              go('overview');
            }
          }}
        >
          Reset demo
        </button>
      </header>
      <div className="layout">
        <nav className="nav" aria-label="Steps">
          {SCREENS.map((x, i) => (
            <button key={x.id} className={screen === x.id ? 'active' : ''} onClick={() => go(x.id)}>
              <span className={`dot ${done[x.id] && i > 0 ? 'done' : ''}`}>{done[x.id] && i > 0 ? '✓' : i}</span>
              {x.label}
              {x.id === 'recon' && recon.open.length > 0 && <span className="badge warn">{recon.open.length}</span>}
            </button>
          ))}
          <div className="note">
            Synthetic data only. Pool, participants and securities are fictional. ERP and bank are simulated in the browser.
          </div>
        </nav>
        <main>
          <Screen go={go} />
        </main>
      </div>
      {s.toast && (
        <div className={`toast ${s.toast.kind}`} role="status" onClick={() => dispatch({ type: 'dismissToast' })}>
          {s.toast.text}
        </div>
      )}
    </>
  );
}
