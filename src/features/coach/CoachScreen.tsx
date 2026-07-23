import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, User, RefreshCw } from 'lucide-react';
import { useStore } from '../../presentation/state/store';
import { AppBar } from '../../ui/primitives/AppBar';
import { Card } from '../../ui/primitives/Card';
import { Chip } from '../../ui/primitives/Chip';
import { FormattedMarkdown } from '../../ui/primitives/FormattedMarkdown';
import { ConfirmDialog } from '../../ui/primitives/ConfirmDialog';
import { parseRoutineFromMessage } from '../../data/ai/GeminiCoach';
import { RoutineCard } from './RoutineCard';

const QUICK_PROMPTS = [
  'Recomendar rutina para hoy',
  'Analizar mi entrenamiento esta semana',
  'Evaluar mi progreso de peso y grasa',
  'Ajustar mi meta de macronutrientes',
];

export function CoachScreen() {
  const {
    chatHistory,
    isAiLoading,
    sendChatMessage,
    clearChat,
  } = useStore();

  const [input, setInput] = useState('');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isAiLoading]);

  const handleSend = async (textToSend?: string) => {
    const messageText = (textToSend || input).trim();
    if (!messageText || isAiLoading) return;

    setInput('');
    await sendChatMessage(messageText);
  };

  return (
    <div style={{ paddingBottom: 110, minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--ui-bg)' }}>
      <AppBar
        title="Coach AI"
        overline="Inteligencia corporal personalizada"
        actions={
          chatHistory.length > 0 ? (
            <button
              type="button"
              className="ui-icon-btn"
              onClick={() => setConfirmResetOpen(true)}
              aria-label="Reiniciar conversación"
              title="Reiniciar conversación"
            >
              <RefreshCw size={20} />
            </button>
          ) : undefined
        }
      />

      <div style={{ padding: '0 16px 12px 16px' }}>
        <Card variant="tonal" padding="sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} style={{ color: 'var(--ui-primary)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ui-text-secondary)' }}>
            Contexto: Perfil, 30d BIA, 7d Nutrición & Rutinas cargados
          </span>
        </Card>
      </div>

      {/* Quick Prompts Wrapped Layout */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 16px 12px 16px' }}>
        {QUICK_PROMPTS.map((prompt, i) => (
          <Chip key={i} onClick={() => handleSend(prompt)} style={{ cursor: 'pointer', fontSize: 12 }}>
            {prompt}
          </Chip>
        ))}
      </div>

      {/* Message Stream */}
      <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12, overflowX: 'hidden' }}>
        {chatHistory.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ui-text-secondary)' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--ui-surface-variant)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
                color: 'var(--ui-primary)',
              }}
            >
              <Bot size={28} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--ui-text-primary)' }}>
              ¿En qué puedo ayudarte hoy?
            </h3>
            <p style={{ fontSize: 13, margin: 0 }}>
              Selecciona una sugerencia arriba o escribe tu consulta sobre tu entrenamiento, dieta o hábitos.
            </p>
          </div>
        ) : (
          chatHistory.map((msg, index) => {
            const isUser = msg.sender === 'user';
            const parsedRoutine = !isUser ? parseRoutineFromMessage(msg.content) : null;
            const cleanContent = parsedRoutine
              ? msg.content.replace(/```(?:json:routine|json)[\s\S]*?```/gi, '').trim()
              : msg.content;

            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                {!isUser && (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--ui-primary)',
                      color: 'var(--ui-on-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Bot size={16} />
                  </div>
                )}
                <div
                  style={{
                    maxWidth: '82%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {cleanContent.length > 0 && (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isUser ? 'var(--ui-primary)' : 'var(--ui-surface)',
                        color: isUser ? 'var(--ui-on-primary)' : 'var(--ui-text-primary)',
                        fontSize: 14,
                        lineHeight: '1.45',
                        boxShadow: isUser ? 'none' : '0 1px 3px rgba(0,0,0,0.12)',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                      }}
                    >
                      <FormattedMarkdown content={cleanContent} />
                    </div>
                  )}

                  {parsedRoutine && (
                    <RoutineCard routine={parsedRoutine} />
                  )}
                </div>

                {isUser && (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--ui-surface-variant)',
                      color: 'var(--ui-text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <User size={16} />
                  </div>
                )}
              </div>
            );
          })
        )}


        {isAiLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ui-text-secondary)', fontSize: 13 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--ui-primary)',
                color: 'var(--ui-on-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bot size={16} />
            </div>
            <span>Analizando datos y escribiendo...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div
        className="ui-coach-input-bar"
        style={{
          position: 'fixed',
          bottom: 64,
          left: 0,
          right: 0,
          padding: '8px 16px',
          background: 'var(--ui-bg)',
          borderTop: '1px solid var(--ui-border)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          zIndex: 10,
          boxSizing: 'border-box',
          maxWidth: '100vw',
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          placeholder="Escribe una pregunta para el Coach..."
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 'var(--ui-radius-pill)',
            border: '1px solid var(--ui-outline)',
            background: 'var(--ui-surface)',
            color: 'var(--ui-text-primary)',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          type="button"
          className="ui-btn ui-btn-filled"
          onClick={() => handleSend()}
          disabled={!input.trim() || isAiLoading}
          aria-label="Enviar mensaje"
          style={{
            width: 44,
            height: 44,
            minHeight: 44,
            padding: 0,
            borderRadius: 'var(--ui-radius-pill)',
            flexShrink: 0,
          }}
        >
          <Send size={18} />
        </button>
      </div>

      <ConfirmDialog
        open={confirmResetOpen}
        title="Reiniciar conversación"
        message="¿Deseas borrar el historial de mensajes de este chat y comenzar una nueva consulta?"
        confirmText="Reiniciar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={() => {
          clearChat();
          setConfirmResetOpen(false);
        }}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </div>
  );
}
