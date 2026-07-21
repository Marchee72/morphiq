import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { useStore } from '../../presentation/state/store';
import { AppBar } from '../../ui/primitives/AppBar';
import { MetricHeroCard } from './MetricHeroCard';
import { CompRingsCard } from './CompRingsCard';
import { FoodTodayCard } from './FoodTodayCard';
import { TrendCard } from './TrendCard';
import { SyncCard } from './SyncCard';
import { AddFoodSheet } from './AddFoodSheet';
import { LogWeightSheet } from './LogWeightSheet';
import { CapacitorHealthProvider } from '../../data/health/CapacitorHealthProvider';
import { WebHealthProvider } from '../../data/health/WebHealthProvider';

function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export const HomeScreen: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => {
  const { activeProfile, measurements, foodLogs, addFoodLog, deleteFoodLog, addManualMeasurement, importMeasurements } = useStore();
  const [foodOpen, setFoodOpen] = useState(false);
  const [wtOpen, setWtOpen] = useState(false);
  const [syncSt, setSyncSt] = useState<'idle'|'syncing'|'success'|'error'>('idle');
  const [syncMsg, setSyncMsg] = useState<string>();

  const latest = measurements.length>0 ? measurements[measurements.length-1] : null;
  const prev = measurements.length>1 ? measurements[measurements.length-2] : null;
  const delta = latest&&prev ? Number((latest.weight-prev.weight).toFixed(1)) : null;
  const trend = measurements.slice(-7).map(m => ({ label: new Date(m.timestamp).toLocaleDateString(undefined,{weekday:'short'}), weight: m.weight }));

  const sync = async () => {
    setSyncSt('syncing'); setSyncMsg(undefined);
    try {
      const prov = new CapacitorHealthProvider();
      const fb = new WebHealthProvider();
      const hp = prov.isAvailable()?prov:fb;
      const ok = await hp.requestPermissions();
      if (!ok) { setSyncSt('error'); setSyncMsg('Permission denied.'); return; }
      const since = new Date(); since.setDate(since.getDate()-30);
      if (hp.importBodyComposition && activeProfile) {
        const recs = await hp.importBodyComposition(since, activeProfile);
        if (recs.length>0) { await importMeasurements(recs); setSyncSt('success'); setSyncMsg(`Synced ${recs.length} records.`); }
        else { setSyncSt('success'); setSyncMsg('No new scans found.'); }
      } else { setSyncSt('error'); setSyncMsg('Not supported.'); }
    } catch (e) { setSyncSt('error'); setSyncMsg(e instanceof Error?e.message:'Sync failed'); }
  };

  return (
    <>
      <AppBar title="Today" overline={activeProfile?`${greet()}, ${activeProfile.name}`:undefined}
        actions={<button className="ui-icon-btn" aria-label="Settings" onClick={onOpenSettings}><Settings size={22}/></button>}/>
      <div style={{display:'flex',flexDirection:'column',gap:12,padding:'0 16px 120px'}}>
        <MetricHeroCard latestWeightKg={latest?.weight??null} deltaKg={delta} onLogWeight={()=>setWtOpen(true)}/>
        <CompRingsCard bodyFatPct={latest?.bodyFat??0} muscleMassKg={latest?.muscleMass??0}/>
        <FoodTodayCard logs={foodLogs} onDelete={id=>deleteFoodLog(id)} onAdd={()=>setFoodOpen(true)}/>
        <TrendCard points={trend}/>
        <SyncCard state={syncSt} message={syncMsg} onSync={sync}/>
      </div>
      <AddFoodSheet open={foodOpen} onClose={()=>setFoodOpen(false)} onSubmit={e=>addFoodLog(e)}/>
      <LogWeightSheet open={wtOpen} onClose={()=>setWtOpen(false)} onSubmit={w=>addManualMeasurement(w)}/>
    </>
  );
};
