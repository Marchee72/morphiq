import React, { useState } from 'react';
import { useStore } from '../../presentation/state/store';
import { Card } from '../../ui/primitives/Card';
import { Button } from '../../ui/primitives/Button';
import { Chip } from '../../ui/primitives/Chip';

const istyle: React.CSSProperties = { width:'100%',minHeight:48,padding:'10px 14px',borderRadius:16,border:'1.5px solid var(--ui-outline-strong)',background:'var(--ui-surface)',color:'var(--ui-text-primary)',fontSize:16 };
const ls: React.CSSProperties = { display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--ui-text-secondary)' };

export const OnboardingScreen: React.FC = () => {
  const { createProfile } = useStore();
  const [n,setN]=useState(''); const [g,setG]=useState<'male'|'female'|null>(null);
  const [b,setB]=useState(''); const [h,setH]=useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const hn=Number(h);
  const ok=n.trim()&&g&&b&&Number.isFinite(hn)&&hn>=100&&hn<=230;

  const go = async () => {
    if(!ok||!g) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await createProfile({ name:n.trim(), gender:g, birthDate:new Date(b), height:hn });
    } catch (err) {
      console.error('Failed to create profile:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Server connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100dvh',padding:16}}>
      <h1 style={{fontSize:34,fontWeight:800,letterSpacing:-1,marginBottom:4}}>MorphIQ</h1>
      <p style={{color:'var(--ui-text-secondary)',marginBottom:24,fontWeight:600}}>Create your profile</p>
      <Card style={{maxWidth:420,width:'100%'}}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {errorMsg && (
            <div style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--ui-error-bg, rgba(239,68,68,0.15))', color: 'var(--ui-error, #ef4444)', fontSize: 13, fontWeight: 600 }}>
              {errorMsg}
            </div>
          )}
          <label style={ls}>Name<input aria-label="Name" style={istyle} value={n} onChange={e=>setN(e.target.value)} placeholder="Alex"/></label>
          <div style={ls}>Gender<div style={{display:'flex',gap:8}}><Chip selected={g==='male'} onClick={()=>setG('male')}>Male</Chip><Chip selected={g==='female'} onClick={()=>setG('female')}>Female</Chip></div></div>
          <label style={ls}>Birth date<input aria-label="Birth date" type="date" style={istyle} value={b} onChange={e=>setB(e.target.value)}/></label>
          <label style={ls}>Height (cm)<input aria-label="Height" inputMode="numeric" style={istyle} value={h} onChange={e=>setH(e.target.value)} placeholder="180"/></label>
          <Button onClick={go} disabled={!ok || loading}>{loading ? 'Creating...' : 'Create profile'}</Button>
          <p style={{fontSize:12,color:'var(--ui-text-secondary)',lineHeight:1.5}}>MorphIQ uses your height, age, and gender to compute body composition metrics from Samsung Health measurements.</p>
        </div>
      </Card>
    </div>
  );
};
