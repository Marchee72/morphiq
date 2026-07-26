import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Send, Terminal, Trophy, Flame,
  Zap, Dumbbell, Apple, PenLine,
} from 'lucide-react';
import type { ThemeId } from '../types';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

interface Props {
  themeId: ThemeId;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'm1',
    sender: 'ai',
    text: "Hey Marche! Your volume lifted this week is up 12% to 12,450 kg. Your chest recovery score is at 88%. Ready for today's session?",
    timestamp: '09:41 AM'
  },
  {
    id: 'm2',
    sender: 'user',
    text: 'Should I increase weight on Barbell Bench Press today?',
    timestamp: '09:42 AM'
  },
  {
    id: 'm3',
    sender: 'ai',
    text: "Yes! Based on your last 3 sessions (80kg x 10 reps felt clean), try 85kg for 8 reps on your second set today. Maintain 90s rest between sets.",
    timestamp: '09:42 AM'
  }
];

export const CoachScreen: React.FC<Props> = ({ themeId }) => {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);

  /* ---- gamified / bento extra state ---- */
  const [activeBentoThread, setActiveBentoThread] = useState(0);

  const aiReplyText = "I have logged your request. Keep focus on progressive overload and maintain proper shoulder retracting form!";

  const pushMessage = useCallback((sender: 'ai' | 'user', text: string, ts: string = 'Just now') => {
    setMessages(prev => [...prev, { id: Date.now().toString(), sender, text, timestamp: ts }]);
  }, []);

  /* shared send handler */
  const handleSend = () => {
    if (!input.trim()) return;
    pushMessage('user', input.trim());
    setInput('');
    if (themeId === 'gamified') {
      setShowConfetti(true);
      setConfettiKey(k => k + 1);
    }
    setTimeout(() => {
      pushMessage('ai', aiReplyText);
      if (themeId === 'gamified') setShowConfetti(false);
    }, 800);
  };

  /* quick-reply handler — fires a user message + triggers AI reply */
  const handleQuickReply = (text: string) => {
    pushMessage('user', text);
    if (themeId === 'gamified') {
      setShowConfetti(true);
      setConfettiKey(k => k + 1);
    }
    setTimeout(() => {
      pushMessage('ai', aiReplyText);
      if (themeId === 'gamified') setShowConfetti(false);
    }, 800);
  };

  /* gamified confetti auto-dismiss */
  useEffect(() => {
    if (showConfetti) {
      const t = setTimeout(() => setShowConfetti(false), 1200);
      return () => clearTimeout(t);
    }
  }, [showConfetti, confettiKey]);

  const quickReplyOptions = [
    { label: "Today's session", icon: Dumbbell },
    { label: 'Recovery status', icon: Zap },
    { label: 'Log nutrition', icon: Apple },
    { label: 'Training plan', icon: TargetIcon },
  ];

  /* ================================================================
     PROPOSAL 1: CLAY INDIGO — STICKY NOTES
     Coach = peach sticky cards w/ rotation & indigo text
     User  = indigo sticky cards w/ peach text
     Quick-replies = recessed chips
     ================================================================ */
  if (themeId === 'clay-indigo') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '10px' }}>
        {/* Header: extruded avatar bubble */}
        <div className="clay-ticket-stub" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '24px' }}>
          <div className="clay-avatar-bubble" style={{ width: '44px', height: '44px', background: '#2b2754', color: '#fce1b4' }}>
            <Sparkles size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 900, margin: 0, color: '#2b2754' }}>MorphIQ Clay Coach</h3>
            <span style={{ fontSize: '11px', color: '#634b28', fontWeight: 800 }}>Sticky-note consultation</span>
          </div>
        </div>

        {/* Messages — sticky note paradigm */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', padding: '4px 0' }}>
          {messages.map((m, i) => {
            const isCoach = m.sender === 'ai';
            const rotation = isCoach ? (i % 2 === 0 ? '-1.5deg' : '1.2deg') : (i % 2 === 0 ? '1deg' : '-0.8deg');
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: isCoach ? 'flex-start' : 'flex-end', paddingRight: isCoach ? '8px' : '0', paddingLeft: isCoach ? '0' : '8px' }}>
                <div style={{
                  maxWidth: '82%',
                  padding: '14px 16px',
                  borderRadius: '6px',
                  background: isCoach ? '#fce1b4' : '#393369',
                  color: isCoach ? '#2b2754' : '#fce1b4',
                  fontWeight: 700,
                  fontSize: '13px',
                  lineHeight: '1.45',
                  transform: `rotate(${rotation})`,
                  boxShadow: '2px 3px 8px rgba(0,0,0,0.25)',
                  position: 'relative',
                  border: isCoach ? '1px solid #e8ce9a' : '1px solid #4a417a',
                }}>
                  {m.text}
                  {/* tiny timestamp pin */}
                  <div style={{ fontSize: '9px', fontWeight: 600, opacity: 0.5, marginTop: '6px', textAlign: 'right' }}>{m.timestamp}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick-reply chips — recessed */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '0 0 6px 0' }}>
          {quickReplyOptions.slice(0, 4).map(qr => (
            <button
              key={qr.label}
              onClick={() => handleQuickReply(qr.label)}
              className="clay-recessed-pill"
              style={{
                padding: '6px 14px',
                borderRadius: '18px',
                border: 'none',
                color: '#e1d8f5',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <qr.icon size={13} />
              {qr.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="clay-recessed-pill" style={{ display: 'flex', gap: '6px', padding: '10px 14px', borderRadius: '24px' }}>
          <input
            type="text"
            placeholder="Jot a note..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', fontSize: '13px', outline: 'none' }}
          />
          <button onClick={handleSend} style={{ background: '#fce1b4', color: '#2b2754', border: 'none', padding: '7px 16px', borderRadius: '16px', fontWeight: 900, cursor: 'pointer', fontSize: '11px' }}>
            SEND
          </button>
        </div>
      </div>
    );
  }

  /* ================================================================
     PROPOSAL 2: WARM LATTE — LETTER COLUMN
     Coach = serif body type with drop-cap on first message
     User  = right-aligned sans-serif text block
     Quick-replies = "this issue's topics" list
     ================================================================ */
  if (themeId === 'warm-latte') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '10px' }}>
        {/* Header */}
        <div>
          <span style={{ fontSize: '10px', color: '#f7f1e3', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>AI Advisor</span>
          <h2 className="latte-hero-serif" style={{ fontSize: '22px', margin: '2px 0 0 0', color: '#f7f1e3' }}>Training Consultation</h2>
        </div>

        {/* Messages — letter column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', padding: '4px 0' }}>
          {messages.map((m, i) => {
            const isCoach = m.sender === 'ai';
            const isFirstCoach = isCoach && messages.findIndex(x => x.sender === 'ai') === i;
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: isCoach ? 'flex-start' : 'flex-end' }}>
                <div
                  className={isFirstCoach ? 'coach-drop-cap' : ''}
                  style={{
                    maxWidth: isCoach ? '88%' : '75%',
                    padding: isCoach ? '0 8px 0 0' : '6px 0 6px 16px',
                    borderLeft: isCoach ? 'none' : '3px solid #d4c5b0',
                    fontFamily: isCoach ? "'EB Garamond', 'Playfair Display', serif" : "'Space Grotesk', sans-serif",
                    fontSize: isCoach ? '16px' : '13px',
                    fontWeight: isCoach ? 600 : 700,
                    color: isCoach ? '#f7f1e3' : '#e8dfce',
                    lineHeight: isCoach ? 1.55 : 1.4,
                    fontStyle: isCoach ? 'normal' : 'normal',
                    textAlign: isCoach ? 'left' : 'right',
                  }}
                >
                  {m.text}
                  <div style={{ fontSize: '10px', marginTop: isCoach ? '8px' : '4px', opacity: 0.5, textAlign: isCoach ? 'left' : 'right', fontFamily: "'Space Grotesk', sans-serif", fontStyle: 'normal' }}>
                    {m.timestamp} &mdash; {isCoach ? 'Coach' : 'You'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick-replies — typeset as "This issue's topics" */}
        <div style={{ borderTop: '1px solid rgba(215,200,180,0.3)', paddingTop: '8px' }}>
          <span style={{ fontSize: '9px', color: '#c4b8a2', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>This issue&rsquo;s topics</span>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
            {quickReplyOptions.slice(0, 3).map(qr => (
              <button
                key={qr.label}
                onClick={() => handleQuickReply(qr.label)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#d4c5b0',
                  fontSize: '12px',
                  fontFamily: "'EB Garamond', serif",
                  fontStyle: 'italic',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                  padding: '0',
                }}
              >
                {qr.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Compose reply..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={{ flex: 1, padding: '12px 16px', borderRadius: '20px', background: '#e8dfce', color: '#3e2a1b', border: 'none', fontWeight: 600, outline: 'none', fontSize: '13px', fontFamily: "'Space Grotesk', sans-serif" }}
          />
          <button onClick={handleSend} className="latte-attached-pill-btn" style={{ padding: '12px 18px', fontSize: '12px' }}>
            SEND
          </button>
        </div>
      </div>
    );
  }

  /* ================================================================
     PROPOSAL 3: DARK STEALTH — TERMINAL LOG
     Monospace. Coach = dim > prefix. User = bright. Timestamps.
     Quick-replies = inline `> _` prompts. No bubbles, no avatars.
     ================================================================ */
  if (themeId === 'dark-stealth') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', padding: '16px', gap: '10px' }}>
        {/* Terminal header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid #1c1c24' }}>
          <Terminal size={16} color="#4a4a5a" />
          <span style={{ fontFamily: "'Courier New', 'Fira Code', monospace", fontSize: '11px', color: '#4a4a5a', fontWeight: 700 }}>morphiq-coach — bash — 80×24</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28c840' }} />
          </div>
        </div>

        {/* Messages — terminal log */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', fontFamily: "'Courier New', 'Fira Code', monospace", fontSize: '12px', padding: '4px 0' }}>
          {messages.map(m => {
            const isCoach = m.sender === 'ai';
            return (
              <div key={m.id} style={{ lineHeight: 1.6, padding: '1px 0' }}>
                <span style={{ color: '#4a4a5a', marginRight: '8px' }}>[{m.timestamp}]</span>
                {isCoach ? (
                  <>
                    <span style={{ color: '#ff7b00' }}>coach</span>
                    <span style={{ color: '#4a4a5a' }}>@morphiq</span>
                    <span style={{ color: '#555566' }}>:{'>'} </span>
                    <span style={{ color: '#8a8a9a' }}>{m.text}</span>
                  </>
                ) : (
                  <>
                    <span style={{ color: '#28c840' }}>you</span>
                    <span style={{ color: '#4a4a5a' }}>@morphiq</span>
                    <span style={{ color: '#555566' }}>:{'>'} </span>
                    <span style={{ color: '#f0f0f0', fontWeight: 700 }}>{m.text}</span>
                  </>
                )}
              </div>
            );
          })}
          {/* Cursor line */}
          <div style={{ lineHeight: 1.6 }}>
            <span style={{ color: '#4a4a5a', marginRight: '8px' }}>[--:--:--]</span>
            <span style={{ color: '#555566' }}>{'>'} </span>
            <span style={{ color: '#ff7b00', animation: 'amber-status-pulse 1.5s infinite ease-in-out' }}>&#9608;</span>
            <span style={{ color: '#4a4a5a', marginLeft: '6px' }}>awaiting input...</span>
          </div>
        </div>

        {/* Quick-replies — inline prompts */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', padding: '4px 0' }}>
          {quickReplyOptions.map(qr => (
            <button
              key={qr.label}
              onClick={() => handleQuickReply(qr.label)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#5a5a6a',
                fontFamily: "'Courier New', 'Fira Code', monospace",
                fontSize: '11px',
                cursor: 'pointer',
                padding: '2px 0',
              }}
            >
              {`> _ ${qr.label}`}
            </button>
          ))}
        </div>

        {/* Input — terminal prompt */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0a0a0e', padding: '10px 14px', borderRadius: '6px', border: '1px solid #1c1c24' }}>
          <span style={{ color: '#28c840', fontFamily: `'Courier New', 'Fira Code', monospace`, fontSize: '12px', fontWeight: 700 }}>$</span>
          <input
            type="text"
            placeholder="enter instruction..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#e0e0e0', fontFamily: "'Courier New', 'Fira Code', monospace", fontSize: '12px', outline: 'none' }}
          />
          <button onClick={handleSend} style={{ background: 'transparent', border: 'none', color: '#4a4a5a', cursor: 'pointer', padding: '0 4px' }}>
            <Send size={14} />
          </button>
        </div>
      </div>
    );
  }

  /* ================================================================
     PROPOSAL 4: TACTICAL AMBER — MISSION BRIEFING
     Coach = frosted-glass panels w/ "BRIEFING" header
     User  = amber-outlined "REPORT" panels
     Quick-replies = amber pill buttons. Glowing amber orb.
     ================================================================ */
  if (themeId === 'tactile-amber') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '10px' }}>
        {/* Header — frosted glass with glowing orb */}
        <div style={{
          background: 'rgba(30,33,40,0.85)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,96,0,0.3)', borderRadius: '20px',
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '50%',
            background: 'radial-gradient(circle, #ff8c42, #ff6000)',
            boxShadow: '0 0 18px rgba(255,96,0,0.7)',
            animation: 'amber-status-pulse 2s infinite ease-in-out',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#ff6000', letterSpacing: '2px', textTransform: 'uppercase' }}>Tactical AI Agent</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#8090a0' }}>Ready for instructions</div>
          </div>
          <div style={{ marginLeft: 'auto', width: '8px', height: '8px', borderRadius: '50%', background: '#ff6000', boxShadow: '0 0 8px rgba(255,96,0,0.8)', animation: 'amber-status-pulse 1.5s infinite ease-in-out' }} />
        </div>

        {/* Messages */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', padding: '4px 0' }}>
          {messages.map(m => {
            const isCoach = m.sender === 'ai';
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: isCoach ? 'flex-start' : 'flex-end' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '14px 16px',
                  borderRadius: '16px',
                  background: isCoach ? 'rgba(30,33,40,0.85)' : 'transparent',
                  backdropFilter: isCoach ? 'blur(12px)' : 'none',
                  border: isCoach ? '1px solid rgba(255,255,255,0.08)' : '1.5px solid rgba(255,96,0,0.55)',
                  color: isCoach ? '#d0d5e0' : '#ffaa66',
                  fontWeight: 600,
                  fontSize: '13px',
                  lineHeight: 1.45,
                }}>
                  {isCoach && (
                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#ff6000', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
                      &#x25B6; BRIEFING
                    </div>
                  )}
                  {!isCoach && (
                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#ff6000', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
                      &#x25A0; REPORT
                    </div>
                  )}
                  {m.text}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick-replies — amber pill buttons */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '0 0 4px 0' }}>
          {quickReplyOptions.map(qr => (
            <button
              key={qr.label}
              onClick={() => handleQuickReply(qr.label)}
              className="amber-action-pill"
              style={{
                padding: '7px 16px',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <qr.icon size={13} />
              {qr.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Command Tactical AI..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={{ flex: 1, padding: '12px 16px', borderRadius: '20px', background: 'rgba(30,33,40,0.85)', color: 'white', border: '1px solid rgba(255,96,0,0.3)', fontWeight: 600, fontSize: '13px', outline: 'none' }}
          />
          <button onClick={handleSend} className="amber-action-pill" style={{ padding: '12px 20px', fontSize: '12px' }}>
            SEND
          </button>
        </div>
      </div>
    );
  }

  /* ================================================================
     PROPOSAL 5: SWISS BRUTALIST — Q&A BROADSHEET
     Full-width blocks w/ thick top border, A: / Q: labels.
     ALL CAPS Helvetica. No bubbles, no shadows, no rounded corners.
     ================================================================ */
  if (themeId === 'swiss-brutalist') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '0' }}>
        {/* Header */}
        <div style={{ borderBottom: '4px solid #111', paddingBottom: '10px', marginBottom: '0' }}>
          <h1 className="swiss-header-huge" style={{ fontSize: '28px', margin: 0, fontFamily: "'Helvetica', 'Inter', sans-serif" }}>Coach Q&amp;A</h1>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '4px' }}>Session transcript</div>
        </div>

        {/* Messages — Q&A broadsheet */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0', overflowY: 'auto' }}>
          {messages.map(m => {
            const isCoach = m.sender === 'ai';
            const label = isCoach ? 'A' : 'Q';
            const accentColor = isCoach ? '#111' : '#ff3b00';
            return (
              <div key={m.id} style={{
                borderTop: '2px solid #111',
                padding: '14px 0',
                display: 'flex',
                gap: '12px',
                fontFamily: "'Helvetica', 'Inter', sans-serif",
                textTransform: 'uppercase',
              }}>
                <div style={{
                  fontSize: '22px',
                  fontWeight: 900,
                  color: accentColor,
                  minWidth: '28px',
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}>
                  {label}:
                </div>
                <div style={{
                  flex: 1,
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#111',
                  lineHeight: 1.5,
                  letterSpacing: '0.3px',
                }}>
                  {m.text}
                  <div style={{ fontSize: '9px', fontWeight: 600, color: '#888', marginTop: '4px', letterSpacing: '1px' }}>
                    {m.timestamp}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick-replies — square-bordered chips */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '10px 0 8px 0', borderTop: '2px solid #111' }}>
          {quickReplyOptions.map(qr => (
            <button
              key={qr.label}
              onClick={() => handleQuickReply(qr.label)}
              style={{
                background: 'transparent',
                border: '2px solid #111',
                borderRadius: '0px',
                padding: '6px 12px',
                fontSize: '10px',
                fontWeight: 800,
                textTransform: 'uppercase',
                fontFamily: "'Helvetica', 'Inter', sans-serif",
                letterSpacing: '0.5px',
                color: '#111',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <qr.icon size={12} />
              {qr.label}
            </button>
          ))}
        </div>

        {/* Input — square-bordered, uppercase */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Input instruction..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={{ flex: 1, padding: '14px 12px', border: '2px solid #111', borderRadius: '0px', background: '#ffffff', color: '#111', fontWeight: 800, fontSize: '12px', outline: 'none', textTransform: 'uppercase', fontFamily: "'Helvetica', 'Inter', sans-serif" }}
          />
          <button onClick={handleSend} style={{ background: '#111', color: 'white', border: '2px solid #111', borderRadius: '0px', padding: '14px 20px', fontWeight: 900, fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', fontFamily: "'Helvetica', 'Inter', sans-serif" }}>
            Send &rarr;
          </button>
        </div>
      </div>
    );
  }

  /* ================================================================
     PROPOSAL 6: NEUMORPHIC SLATE — CONTROL PANEL (DEFAULT)
     Coach = recessed wells w/ amber status light
     User  = extruded panels
     Quick-replies = extruded push-buttons
     Large recessed "speaker" well as avatar with amber pulse
     ================================================================ */

  /* ================================================================
     PROPOSAL 7: LIST-FIRST — TRANSCRIPT
     Plain text lines w/ "Coach:" / "You:" label + timestamp.
     No bubbles. Comma-separated inline quick-replies.
     Thin-underline input.
     ================================================================ */
  if (themeId === 'list-first') {
    return (
      <div style={{ padding: '20px 20px 12px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '8px', background: '#FAFAFA', color: '#111' }}>
        {/* Minimal header */}
        <div style={{ borderBottom: '1px solid #EEE', paddingBottom: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Coach Transcript</span>
        </div>

        {/* Messages — plain transcript lines */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', padding: '4px 0' }}>
          {messages.map(m => {
            const isCoach = m.sender === 'ai';
            return (
              <div key={m.id} style={{ lineHeight: 1.6 }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#999', marginRight: '6px' }}>{m.timestamp}</span>
                <span style={{
                  fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                  color: isCoach ? '#3B82F6' : '#111', marginRight: '4px',
                }}>
                  {isCoach ? 'Coach' : 'You'}
                </span>
                <span style={{ fontSize: '14px', color: '#333', lineHeight: 1.5 }}>{m.text}</span>
              </div>
            );
          })}
        </div>

        {/* Quick-replies — comma-separated inline */}
        <div style={{ borderTop: '1px solid #EEE', paddingTop: '8px', paddingBottom: '2px' }}>
          <span style={{ fontSize: '13px', color: '#555', lineHeight: 1.6 }}>
            Ask about{' '}
            {quickReplyOptions.map((qr, i) => (
              <React.Fragment key={qr.label}>
                <button
                  onClick={() => handleQuickReply(qr.label)}
                  style={{
                    background: 'transparent', border: 'none', borderBottom: '1px solid #3B82F6',
                    color: '#3B82F6', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '0 1px',
                  }}
                >
                  {qr.label.toLowerCase()}
                </button>
                {i < quickReplyOptions.length - 2 ? ', ' : i < quickReplyOptions.length - 1 ? ', or ' : '.'}
              </React.Fragment>
            ))}
          </span>
        </div>

        {/* Input — thin underline */}
        <div style={{ padding: '8px 0 4px' }}>
          <input
            type="text"
            placeholder="Type your message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            className="list-first-input"
            style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #DDD', borderRadius: '0', padding: '10px 0', fontSize: '15px', color: '#111', outline: 'none', width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button onClick={handleSend} style={{ background: 'transparent', border: 'none', color: '#3B82F6', fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: '4px 8px' }}>
              Send &uarr;
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================
     PROPOSAL 8: GAMIFIED — CHEERLEADER
     Rounded bubbles w/ floating emoji reactions. Bright colors.
     Large rounded-pill quick-replies with icons.
     Cartoon mascot avatar that bounces on typing.
     Confetti effect on send.
     ================================================================ */
  if (themeId === 'gamified') {
    const emojis = ['🎉', '💯', '🔥', '💪', '⭐', '🏆'];
    return (
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '8px', position: 'relative', overflow: 'hidden' }}>
        {/* Confetti overlay */}
        {showConfetti && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }} key={confettiKey}>
            {Array.from({ length: 20 }).map((_, i) => (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: `${(i * 7 + confettiKey * 13) % 90 + 5}%`,
                  top: `${(i * 11 + confettiKey * 7) % 60 + 10}%`,
                  fontSize: `${(i * 3 + confettiKey) % 16 + 14}px`,
                  animation: `confetti-pop 1s ease-out ${(i * 0.13) % 0.3}s forwards`,
                }}
              >
                {['🎉', '✨', '🌟', '💫', '🎊', '🔥'][i % 6]}
              </span>
            ))}
          </div>
        )}

        {/* Header — mascot + streak */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Bouncing mascot */}
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px',
            border: '3px solid rgba(255,255,255,0.3)',
            boxShadow: '0 6px 20px rgba(239,68,68,0.4)',
            animation: input.length > 0 ? 'mascot-bounce 0.4s ease-in-out infinite' : 'none',
          }}>
            🦊
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 900, color: 'white' }}>Coach Champ</div>
            <div className="game-streak-banner" style={{ padding: '6px 12px', fontSize: '11px', marginTop: '4px', display: 'inline-flex' }}>
              <Flame size={14} /> 14-Day Streak!
            </div>
          </div>
          <Trophy size={24} color="#F59E0B" style={{ filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.6))' }} />
        </div>

        {/* Messages — rounded bubbles with emoji float */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', padding: '4px 0' }}>
          {messages.map((m, i) => {
            const isCoach = m.sender === 'ai';
            const bubbleColors = ['#7C3AED', '#2563EB', '#059669', '#D97706'];
            const userColor = bubbleColors[i % bubbleColors.length];
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: isCoach ? 'flex-start' : 'flex-end', position: 'relative' }}>
                <div style={{
                  maxWidth: '80%',
                  padding: '12px 16px',
                  borderRadius: '22px',
                  background: isCoach ? '#312E81' : userColor,
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '13px',
                  lineHeight: 1.4,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                  position: 'relative',
                }}>
                  {m.text}
                  {/* Floating emoji reactions */}
                  <span style={{
                    position: 'absolute',
                    top: '-10px',
                    right: isCoach ? 'auto' : '-8px',
                    left: isCoach ? '-8px' : 'auto',
                    fontSize: '18px',
                    animation: 'emoji-float 2s ease-out infinite',
                    animationDelay: `${(i * 0.5) % 2}s`,
                    pointerEvents: 'none',
                  }}>
                    {emojis[i % emojis.length]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick-replies — large rounded pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '4px 0' }}>
          {quickReplyOptions.map(qr => (
            <button
              key={qr.label}
              onClick={() => handleQuickReply(qr.label)}
              className="game-pill-btn"
              style={{
                padding: '10px 18px',
                fontSize: '12px',
                fontWeight: 800,
                borderRadius: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <qr.icon size={15} />
              {qr.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Chat with Coach Champ..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={{ flex: 1, padding: '14px 18px', borderRadius: '28px', background: '#312E81', color: 'white', border: '2px solid rgba(168,85,247,0.4)', fontSize: '13px', fontWeight: 600, outline: 'none' }}
          />
          <button
            onClick={handleSend}
            style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
              border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: '20px', boxShadow: '0 4px 14px rgba(239,68,68,0.5)',
            }}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    );
  }

  /* ================================================================
     PROPOSAL 9: RETRO — NOTEBOOK PAGE
     Cream lined-paper background. Coach = Caveat blue ink.
     User = Caveat black ink. Quick-replies = sticky notes on edge.
     Doodled star avatar.
     ================================================================ */
  if (themeId === 'retro') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '10px' }}>
        {/* Header — doodled star + handwritten title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px' }}>
          <div style={{
            width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
          }}>
            &#9733;
          </div>
          <h2 style={{ margin: 0, fontFamily: "'Caveat', cursive", fontSize: '26px', color: '#F5F5DC', fontWeight: 700 }}>
            Coach&rsquo;s Notebook
          </h2>
        </div>

        {/* Messages — on notebook lined-paper */}
        <div
          className="retro-notebook-page"
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto',
            padding: '14px 15px', margin: '0 4px',
          }}
        >
          {messages.map((m, _i) => {
            const isCoach = m.sender === 'ai';
            return (
              <div key={m.id} style={{
                lineHeight: '28px',
                padding: '2px 4px',
                fontFamily: "'Caveat', cursive",
                fontSize: '16px',
                color: isCoach ? '#1E40AF' : '#1A1A1A',
                fontWeight: isCoach ? 600 : 400,
                position: 'relative',
              }}>
                {/* Small label */}
                <span style={{ fontSize: '11px', fontFamily: "'Caveat', cursive", color: '#888', marginRight: '4px' }}>
                  {isCoach ? 'Coach' : 'Me'}:
                </span>
                {m.text}
                {/* Doodle underline for coach */}
                {isCoach && (
                  <div style={{
                    width: '30px', height: '2px',
                    background: '#1E40AF', opacity: 0.3, marginTop: '2px',
                    borderRadius: '1px',
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Quick-replies — sticky notes stuck to page edge */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '8px 0 2px 0' }}>
          {quickReplyOptions.map((qr, i) => (
            <button
              key={qr.label}
              onClick={() => handleQuickReply(qr.label)}
              className="retro-tape-card"
              style={{
                padding: '8px 12px',
                minWidth: '90px',
                fontSize: '13px',
                fontFamily: "'Caveat', cursive",
                fontWeight: 600,
                color: '#1A1A1A',
                border: 'none',
                cursor: 'pointer',
                transform: `rotate(${(i % 2 === 0 ? -2 : 3)}deg)`,
                whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <qr.icon size={14} />
              {qr.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <PenLine size={18} color="rgba(245,245,220,0.5)" />
          <input
            type="text"
            placeholder="Write a note..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: '8px',
              background: 'rgba(255,248,231,0.15)', color: '#F5F5DC',
              border: '1px dashed rgba(245,245,220,0.3)',
              fontFamily: "'Caveat', cursive", fontSize: '16px', outline: 'none',
            }}
          />
          <button onClick={handleSend} style={{
            background: 'rgba(245,245,220,0.2)', color: '#F5F5DC',
            border: '1px dashed rgba(245,245,220,0.4)', borderRadius: '8px',
            padding: '10px 14px', cursor: 'pointer',
            fontFamily: "'Caveat', cursive", fontSize: '16px', fontWeight: 700,
          }}>
            Send
          </button>
        </div>
      </div>
    );
  }

  /* ================================================================
     PROPOSAL 10: BENTO GRID — THREAD GRID
     Grid of varied-size tiles, each a conversation topic.
     Active thread = large tile. Quick-replies = pill-tile row.
     ================================================================ */
  if (themeId === 'bento-grid') {
    interface BentoThread {
      id: number;
      topic: string;
      icon: React.FC<{ size?: number; color?: string }>;
      preview: string;
      messageCount: number;
    }
    const bentoThreads: BentoThread[] = [
      { id: 0, topic: 'Form Check', icon: Dumbbell, preview: 'Your bench form looks solid — try retracting...', messageCount: 4 },
      { id: 1, topic: 'Nutrition', icon: Apple, preview: 'Protein intake at 162g today. Let\'s target...', messageCount: 7 },
      { id: 2, topic: 'Recovery', icon: Zap, preview: 'Chest recovery at 88%. Recommend active rest...', messageCount: 3 },
      { id: 3, topic: 'Program', icon: TargetIcon, preview: 'Week 4 of hypertrophy block. Time to increase...', messageCount: 12 },
      { id: 4, topic: 'Technique', icon: Sparkles, preview: 'Squat depth improving. Next session focus on...', messageCount: 5 },
    ];
    const activeThread = bentoThreads[activeBentoThread];
    const smallThreads = bentoThreads.filter(t => t.id !== activeBentoThread);

    return (
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '8px', background: '#F4F4F6' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#1F2937' }}>Coach Threads</span>
          <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600 }}>{bentoThreads.length} active</span>
        </div>

        {/* Thread grid — 4-col bento */}
        <div className="bento-grid" style={{ flex: 1, gridAutoRows: '80px', alignContent: 'start', overflow: 'hidden' }}>
          {/* Active thread — large tile */}
          <div
            className="bento-tile bento-tile-lg"
            style={{
              cursor: 'default',
              background: '#FFFFFF',
              border: '2px solid #4F46E5',
              boxShadow: '0 4px 16px rgba(79,70,229,0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <activeThread.icon size={18} color="#4F46E5" />
              <span className="bento-tile-title" style={{ fontSize: '14px' }}>{activeThread.topic}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#4B5563', lineHeight: 1.45, flex: 1, overflow: 'hidden' }}>
              {activeThread.preview}
            </div>
            <div style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600, marginTop: 'auto' }}>
              {activeThread.messageCount} messages &middot; tap to expand
            </div>
          </div>

          {/* Other threads — smaller tiles */}
          {smallThreads.slice(0, 3).map(t => (
            <div
              key={t.id}
              className="bento-tile bento-tile-sm"
              onClick={() => setActiveBentoThread(t.id)}
              style={{ cursor: 'pointer', background: '#FFFFFF' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                <t.icon size={13} color="#6B7280" />
                <span className="bento-tile-label">{t.topic}</span>
              </div>
              <div style={{ fontSize: '10px', color: '#6B7280', lineHeight: 1.35, flex: 1, overflow: 'hidden' }}>
                {t.preview.substring(0, 50)}...
              </div>
              <span className="bento-tile-subtle">{t.messageCount} msgs</span>
            </div>
          ))}

          {/* Thread #4 if slots available */}
          {smallThreads.length > 3 && (
            <div
              className="bento-tile bento-tile-sm"
              onClick={() => setActiveBentoThread(smallThreads[3].id)}
              style={{ cursor: 'pointer', background: '#FFFFFF' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                {React.createElement(smallThreads[3].icon, { size: 13, color: '#6B7280' })}
                <span className="bento-tile-label">{smallThreads[3].topic}</span>
              </div>
              <div style={{ fontSize: '10px', color: '#6B7280', lineHeight: 1.35, flex: 1, overflow: 'hidden' }}>
                {smallThreads[3].preview.substring(0, 40)}...
              </div>
              <span className="bento-tile-subtle">{smallThreads[3].messageCount} msgs</span>
            </div>
          )}
        </div>

        {/* Quick-replies — pill-tile row */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '4px 0' }}>
          {quickReplyOptions.map(qr => (
            <button
              key={qr.label}
              onClick={() => handleQuickReply(qr.label)}
              style={{
                padding: '7px 14px',
                borderRadius: '16px',
                background: '#FFFFFF',
                border: '1px solid rgba(0,0,0,0.08)',
                fontSize: '11px',
                fontWeight: 700,
                color: '#4F46E5',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <qr.icon size={13} />
              {qr.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder={`Reply to "${activeThread.topic}"...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={{ flex: 1, padding: '12px 14px', borderRadius: '16px', background: '#FFFFFF', color: '#1F2937', border: '1px solid rgba(0,0,0,0.08)', fontSize: '13px', fontWeight: 500, outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          />
          <button onClick={handleSend} style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '12px 18px', borderRadius: '16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    );
  }

  /* ================================================================
     PROPOSAL 6 (DEFAULT): NEUMORPHIC SLATE — CONTROL PANEL
     Coach = recessed wells w/ amber status light
     User  = extruded panels
     Quick-replies = extruded push-buttons
     Large recessed "speaker" well as AI avatar with amber pulse
     ================================================================ */
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '10px' }}>
      {/* Header — extruded card with push-button avatar + amber status */}
      <div className="neu-extruded-card-3d" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '28px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%',
          background: '#1b1e21',
          boxShadow: 'inset 4px 4px 10px #131517, inset -4px -4px 10px #23272b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <Sparkles size={20} color="#ff5c00" />
          {/* Amber status dot */}
          <div style={{
            position: 'absolute', bottom: '2px', right: '2px',
            width: '10px', height: '10px', borderRadius: '50%',
            background: '#ff5c00',
            animation: 'amber-status-pulse 2s infinite ease-in-out',
          }} />
        </div>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#dce3eb' }}>Neumorphic Intelligence</h3>
          <span style={{ fontSize: '10px', color: '#ff5c00', fontWeight: 700 }}>&#x25CF; Active — Control Panel</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', padding: '4px 0' }}>
        {messages.map(m => {
          const isCoach = m.sender === 'ai';
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isCoach ? 'flex-start' : 'flex-end' }}>
              <div
                className={isCoach ? 'neu-recessed-well' : 'neu-extruded-card-3d'}
                style={{
                  maxWidth: '85%',
                  padding: '14px 16px',
                  borderRadius: '20px',
                  color: isCoach ? '#dce3eb' : '#ff5c00',
                  fontWeight: 600,
                  fontSize: '13px',
                  lineHeight: 1.4,
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                }}
              >
                {/* Status light on coach messages */}
                {isCoach && (
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', background: '#ff5c00',
                    marginTop: '4px', flexShrink: 0,
                    animation: 'amber-status-pulse 2s infinite ease-in-out',
                  }} />
                )}
                <div>{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick-replies — extruded push-buttons */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '0 0 4px 0' }}>
        {quickReplyOptions.map(qr => (
          <button
            key={qr.label}
            onClick={() => handleQuickReply(qr.label)}
            className="neu-push-button-3d"
            style={{
              width: 'auto', height: 'auto', borderRadius: '16px',
              padding: '7px 14px', fontSize: '11px', fontWeight: 700,
              color: '#c2cbd6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
            }}
          >
            <qr.icon size={13} />
            {qr.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div className="neu-recessed-well" style={{ flex: 1, padding: '6px 16px', display: 'flex', alignItems: 'center', borderRadius: '20px' }}>
          <input
            type="text"
            placeholder="Ask AI Console..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={{ width: '100%', background: 'transparent', border: 'none', color: '#dce3eb', fontSize: '13px', outline: 'none' }}
          />
        </div>
        <button className="neu-dial-button-ember" onClick={handleSend} style={{ width: '48px', height: '48px' }}>
          <Send size={18} color="white" />
        </button>
      </div>
    </div>
  );
};

/* Helper: Target icon inline (avoids extra lucide import edge cases) */
const TargetIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);
