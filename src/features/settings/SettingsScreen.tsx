import React, { useState, useEffect } from 'react';
import { Check, Edit3, Activity, Sun, Moon, Monitor, Database, Sparkles, Trash2, ShieldCheck, RefreshCw, Dumbbell } from 'lucide-react';
import { useStore } from '../../presentation/state/store';
import { AppBar } from '../../ui/primitives/AppBar';
import { Card } from '../../ui/primitives/Card';
import { ListItem } from '../../ui/primitives/ListItem';
import { Button } from '../../ui/primitives/Button';
import { Chip } from '../../ui/primitives/Chip';
import { ProfileEditSheet } from './ProfileEditSheet';
import { DataBackupSheet } from './DataBackupSheet';
import { GymEquipmentSheet } from './GymEquipmentSheet';
import { CapacitorHealthProvider } from '../../data/health/CapacitorHealthProvider';
import { WebHealthProvider } from '../../data/health/WebHealthProvider';

export const SettingsScreen: React.FC = () => {
  const {
    profiles,
    activeProfile,
    setActiveProfile,
    updateProfile,
    theme,
    setTheme,
    exportBackupData,
    importBackupData,
    clearDatabaseData,
    seedMockData,
    clearMockData,
    importWorkouts,
    importMeasurements,
  } = useStore();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isEquipmentOpen, setIsEquipmentOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [demoMsg, setDemoMsg] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleManualHealthSync = async () => {
    if (!activeProfile) return;
    setIsSyncing(true);
    setSyncStatus('Sincronizando con Health Provider...');
    try {
      const capProvider = new CapacitorHealthProvider();
      const webProvider = new WebHealthProvider();
      const provider = capProvider.isAvailable() ? capProvider : webProvider;

      const granted = await provider.requestPermissions();
      if (granted) {
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const workouts = await provider.importWorkouts(since);
        if (provider.importBodyComposition) {
          const measurements = await provider.importBodyComposition(since, activeProfile);
          if (measurements.length > 0) await importMeasurements(measurements);
        }
        await importWorkouts(workouts);
        setSyncStatus(`¡Sincronización exitosa! (${workouts.length} entrenamientos)`);
      } else {
        setSyncStatus('Permisos de salud denegados o no disponibles.');
      }
    } catch (err) {
      console.error('Health sync error:', err);
      setSyncStatus('Error durante la sincronización.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSeedDemo = async () => {
    setDemoMsg('Cargando datos de demostración...');
    try {
      await seedMockData();
      setDemoMsg('¡Datos demo cargados con éxito!');
    } catch {
      setDemoMsg('Error al cargar datos demo.');
    }
  };

  const handleClearDemo = async () => {
    setDemoMsg('Limpiando datos...');
    try {
      await clearMockData();
      setDemoMsg('Datos de demostración eliminados.');
    } catch {
      setDemoMsg('Error al limpiar datos.');
    }
  };

  return (
    <>
      <AppBar title="Configuración" overline="MorphIQ System" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px 140px' }}>

        {/* 1. Active Profile Section */}
        <Card padding="md">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ui-text-secondary)' }}>
              PERFIL ACTIVO
            </span>
            {activeProfile && (
              <Button variant="tonal" size="sm" onClick={() => setIsEditOpen(true)}>
                <Edit3 size={14} /> Editar
              </Button>
            )}
          </div>

          {activeProfile ? (
            <div style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--ui-text-primary)' }}>
                {activeProfile.name}
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--ui-text-secondary)' }}>
                {activeProfile.height} cm · {activeProfile.gender === 'male' ? 'Masculino' : 'Femenino'}
                {activeProfile.targetWeight ? ` · Meta: ${activeProfile.targetWeight} kg` : ''}
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--ui-text-secondary)' }}>Sin perfil seleccionado</p>
          )}

          <div style={{ borderTop: '1px solid var(--ui-border)', paddingTop: 10, marginTop: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ui-text-secondary)', display: 'block', marginBottom: 8 }}>
              Cambiar de Perfil:
            </span>
            {profiles.map((p) => (
              <ListItem
                key={p.id}
                title={p.name}
                subtitle={`${p.height} cm · ${p.gender}`}
                trailing={activeProfile?.id === p.id ? <Check size={18} style={{ color: 'var(--ui-primary)' }} /> : undefined}
                onClick={() => p.id && setActiveProfile(p.id)}
              />
            ))}
          </div>
        </Card>

        {/* 2. Health Sync Status Section */}
        <Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={20} style={{ color: 'var(--ui-primary)' }} />
            <div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Sincronización de Salud</h4>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ui-text-secondary)' }}>
                Conexión con Health Connect & Web Health
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--ui-surface-variant)', padding: '10px 12px', borderRadius: 'var(--ui-radius-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} style={{ color: 'var(--ui-primary)' }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Sincronización automática</span>
            </div>
            <Button variant="filled" size="sm" onClick={handleManualHealthSync} disabled={isSyncing}>
              <RefreshCw size={14} className={isSyncing ? 'spin' : ''} /> {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
          </div>

          {syncStatus && (
            <span style={{ fontSize: 12, color: 'var(--ui-primary)', fontWeight: 600 }}>{syncStatus}</span>
          )}
        </Card>

        {/* 3. Appearance Section */}
        <Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ui-text-secondary)' }}>
            APARIENCIA
          </span>

          <div style={{ display: 'flex', gap: 8 }}>
            <Chip selected={theme === 'system'} onClick={() => setTheme('system')} style={{ flex: 1, justifyContent: 'center' }}>
              <Monitor size={14} /> Sistema
            </Chip>
            <Chip selected={theme === 'dark'} onClick={() => setTheme('dark')} style={{ flex: 1, justifyContent: 'center' }}>
              <Moon size={14} /> Oscuro
            </Chip>
            <Chip selected={theme === 'light'} onClick={() => setTheme('light')} style={{ flex: 1, justifyContent: 'center' }}>
              <Sun size={14} /> Claro
            </Chip>
          </div>
        </Card>

        {/* 4. Gym Equipment Section */}
        <Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ui-text-secondary)' }}>
            EQUIPAMIENTO DE GIMNASIO
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 14,
              background: 'var(--ui-tonal)', color: 'var(--ui-on-tonal)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Dumbbell size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ui-text-primary)' }}>
                Mi Equipamiento
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ui-text-secondary)' }}>
                {activeProfile?.availableEquipment && activeProfile.availableEquipment.length > 0
                  ? `${activeProfile.availableEquipment.length} equipos configurados`
                  : 'Sin configurar (se usan todos)'
                }
              </div>
            </div>
            <Button variant="tonal" size="sm" onClick={() => setIsEquipmentOpen(true)}>
              Configurar
            </Button>
          </div>
        </Card>

        {/* 5. Data Backup & Demo Data Section */}
        <Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ui-text-secondary)' }}>
            DATOS Y RESPALDOS
          </span>

          <Button variant="outlined" onClick={() => setIsBackupOpen(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Database size={16} /> Respaldos JSON (Exportar / Importar)
          </Button>

          <div style={{ borderTop: '1px solid var(--ui-border)', paddingTop: 12, marginTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ui-text-secondary)', display: 'block', marginBottom: 8 }}>
              Datos de prueba / Demo:
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="tonal" size="sm" onClick={handleSeedDemo} style={{ flex: 1 }}>
                <Sparkles size={14} /> Cargar Demo
              </Button>
              <Button variant="outlined" size="sm" onClick={handleClearDemo} style={{ flex: 1 }}>
                <Trash2 size={14} /> Limpiar Demo
              </Button>
            </div>
            {demoMsg && (
              <span style={{ fontSize: 12, color: 'var(--ui-primary)', fontWeight: 600, marginTop: 6, display: 'block' }}>
                {demoMsg}
              </span>
            )}
          </div>
        </Card>

      </div>

      {/* Sheets */}
      <ProfileEditSheet
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        profile={activeProfile}
        onSave={updateProfile}
      />

      <DataBackupSheet
        open={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        onExport={exportBackupData}
        onImport={importBackupData}
        onClear={clearDatabaseData}
      />

      <GymEquipmentSheet
        open={isEquipmentOpen}
        onClose={() => setIsEquipmentOpen(false)}
        selected={activeProfile?.availableEquipment ?? []}
        onSave={async (equipment) => {
          if (activeProfile) {
            await updateProfile({ ...activeProfile, availableEquipment: equipment });
          }
        }}
      />
    </>
  );
};
