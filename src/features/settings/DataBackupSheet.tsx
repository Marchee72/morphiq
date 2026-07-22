import { useState, useRef } from 'react';
import { Download, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { Sheet } from '../../ui/primitives/Sheet';
import { Button } from '../../ui/primitives/Button';
import { Card } from '../../ui/primitives/Card';

export interface DataBackupSheetProps {
  open: boolean;
  onClose: () => void;
  onExport: () => Promise<string>;
  onImport: (json: string) => Promise<boolean>;
  onClear: () => Promise<void>;
}

export function DataBackupSheet({ open, onClose, onExport, onImport, onClear }: DataBackupSheetProps) {
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      setIsLoading(true);
      const jsonStr = await onExport();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `morphiq_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMsg({ text: 'Copia de seguridad exportada correctamente.', type: 'success' });
    } catch (err) {
      console.error('Export error:', err);
      setStatusMsg({ text: 'Error al exportar los datos.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const text = await file.text();
      const success = await onImport(text);
      if (success) {
        setStatusMsg({ text: 'Datos importados correctamente.', type: 'success' });
      } else {
        setStatusMsg({ text: 'El archivo JSON no tiene un formato válido de MorphIQ.', type: 'error' });
      }
    } catch (err) {
      console.error('Import error:', err);
      setStatusMsg({ text: 'Error al leer el archivo seleccionado.', type: 'error' });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearData = async () => {
    try {
      setIsLoading(true);
      await onClear();
      setShowConfirmClear(false);
      setStatusMsg({ text: 'Datos eliminados del perfil activo.', type: 'success' });
    } catch (err) {
      console.error('Clear error:', err);
      setStatusMsg({ text: 'Error al restablecer los datos.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Gestión de Datos y Respaldos">
      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {statusMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--ui-radius-card)',
              background: statusMsg.type === 'success' ? 'var(--ui-surface-variant)' : '#5c1d1d',
              color: statusMsg.type === 'success' ? 'var(--ui-primary)' : '#ff8888',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {statusMsg.text}
          </div>
        )}

        <Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Download size={20} style={{ color: 'var(--ui-primary)' }} />
            <div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Exportar Copia de Seguridad</h4>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ui-text-secondary)' }}>
                Descarga un archivo JSON con tu historial de peso, alimentos y rutinas.
              </p>
            </div>
          </div>
          <Button variant="outlined" size="sm" onClick={handleExport} disabled={isLoading}>
            Exportar JSON
          </Button>
        </Card>

        <Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Upload size={20} style={{ color: 'var(--ui-primary)' }} />
            <div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Importar Copia de Seguridad</h4>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ui-text-secondary)' }}>
                Restaura un respaldo JSON previamente guardado.
              </p>
            </div>
          </div>
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <Button variant="outlined" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
            Seleccionar archivo JSON
          </Button>
        </Card>

        {!showConfirmClear ? (
          <Card padding="md" style={{ border: '1px solid var(--ui-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Trash2 size={20} style={{ color: '#ff6666' }} />
              <div>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#ff6666' }}>Restablecer Datos</h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ui-text-secondary)' }}>
                  Borra el historial de mediciones, alimentos y entrenamientos del perfil.
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowConfirmClear(true)} style={{ color: '#ff6666' }}>
              Restablecer base de datos
            </Button>
          </Card>
        ) : (
          <Card padding="md" style={{ background: '#3b1818', border: '1px solid #7c2d2d', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ff8888' }}>
              <AlertTriangle size={20} />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>¿Confirmar eliminación?</h4>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#ffcccc' }}>
              Esta acción eliminará permanentemente todos tus registros del perfil activo y no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" size="sm" style={{ flex: 1, color: '#ffffff' }} onClick={() => setShowConfirmClear(false)}>
                Cancelar
              </Button>
              <Button variant="filled" size="sm" style={{ flex: 1, background: '#d32f2f', color: '#ffffff' }} onClick={handleClearData} disabled={isLoading}>
                Eliminar todo
              </Button>
            </div>
          </Card>
        )}

        <Button variant="ghost" onClick={onClose} style={{ marginTop: 8 }}>
          Cerrar
        </Button>
      </div>
    </Sheet>
  );
}
