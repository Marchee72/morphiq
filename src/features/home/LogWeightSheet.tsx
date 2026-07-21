import React, { useState } from 'react';
import { Sheet } from '../../ui/primitives/Sheet';
import { Button } from '../../ui/primitives/Button';

export const LogWeightSheet: React.FC<{ open: boolean; onClose: () => void; onSubmit: (w: number) => void }> = ({ open, onClose, onSubmit }) => {
  const [v, setV] = useState('');
  const p = Number(v);
  const ok = Number.isFinite(p) && p>=15 && p<=400;
  const save = () => { if(!ok) return; onSubmit(p); setV(''); onClose(); };
  return (
    <Sheet open={open} onClose={onClose} title="Log weight">
      <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--ui-text-secondary)'}}>Weight (kg)<input aria-label="Weight" inputMode="decimal" placeholder="78.4" value={v} onChange={e=>setV(e.target.value)} style={{width:'100%',minHeight:48,padding:'10px 14px',borderRadius:16,border:'1.5px solid var(--ui-outline-strong)',background:'var(--ui-bg)',color:'var(--ui-text-primary)',fontSize:16}}/></label>
      <div style={{marginTop:16}}><Button onClick={save} disabled={!ok}>Save</Button></div>
    </Sheet>
  );
};
