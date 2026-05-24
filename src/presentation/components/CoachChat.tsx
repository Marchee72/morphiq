import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../state/store';
import { Send, Sparkles, Trash2, Key, Info } from 'lucide-react';

export const CoachChat: React.FC = () => {
  const { chatHistory, sendChatMessage, clearChat, isAiLoading, apiKey, setApiKey } = useStore();
  const [input, setInput] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(!apiKey);
  const [keyInput, setKeyInput] = useState(apiKey);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isAiLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isAiLoading) return;
    const msg = input.trim();
    setInput('');
    await sendChatMessage(msg);
  };

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    setApiKey(keyInput.trim());
    setShowKeyInput(false);
  };

  // Simple Markdown parser for bold (**text**), bullet points (* item), and newlines
  const renderMessageContent = (text: string) => {
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Bold text: **bold** -> <strong>bold</strong>
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Bullet points: * item -> <li class="ml-4 list-disc my-1">$1</li>
      .replace(/^\s*\*\s+(.*?)$/gm, '<li class="ml-4 list-disc my-1">$1</li>')
      // Convert groups of list items into <ul> blocks (rudimentary wrapping)
      .replace(/(<li.*<\/li>)/s, '<ul class="my-2">$1</ul>')
      // Newlines to breaks
      .replace(/\n/g, '<br />');

    return <div dangerouslySetInnerHTML={{ __html: html }} className="text-sm leading-relaxed" />;
  };

  return (
    <div className="glass-panel flex flex-col h-full overflow-hidden" style={{ minHeight: '500px' }}>
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/5 p-4 bg-white/2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <div>
            <h2 className="text-lg font-bold">AI Nutritionist & Gym Coach</h2>
            <p className="text-xs text-gray-400">Powered by Gemini. Fed by your body composition.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className={`p-2 rounded-full hover:bg-white/5 transition ${apiKey ? 'text-teal-400' : 'text-yellow-400'}`}
            title="Configure Gemini API Key"
          >
            <Key className="w-4 h-4" />
          </button>
          <button
            onClick={clearChat}
            className="p-2 rounded-full hover:bg-white/5 text-gray-400 hover:text-red-400 transition"
            title="Clear Conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* API Key Modal/Input Panel */}
      {showKeyInput && (
        <form onSubmit={handleSaveKey} className="bg-purple-950/10 border-b border-purple-500/20 p-4 flex flex-col gap-2">
          <div className="flex items-start gap-2 text-xs text-purple-300 mb-1">
            <Info className="w-4 h-4 flex-shrink-0" />
            <p>
              To enable AI coaching, enter your <strong>Google Gemini API Key</strong>. It is saved 100% locally in your browser. Get one for free at the Google AI Studio.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="AIzaSy..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="flex-1 text-sm bg-black/40 border-white/10"
              required
            />
            <button type="submit" className="bg-purple-500 hover:bg-purple-600 text-black px-4 rounded-lg font-semibold text-sm transition">
              Save
            </button>
          </div>
        </form>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {chatHistory.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 max-w-sm mx-auto text-gray-400">
            <Sparkles className="w-8 h-8 text-purple-500/40 mb-3 animate-pulse" />
            <h3 className="text-sm font-semibold mb-1 text-gray-300">Start Your Conversational Log</h3>
            <p className="text-xs leading-relaxed">
              Ask your AI coach how to adjust your calories, suggest a gym routine for hypertrophy, or review your body fat progress.
            </p>
          </div>
        ) : (
          chatHistory.map((m, i) => (
            <div
              key={i}
              className={`flex flex-col max-w-[85%] rounded-2xl px-4 py-3 ${
                m.sender === 'user'
                  ? 'self-end bg-purple-500/10 border border-purple-500/25 text-purple-100 rounded-tr-none'
                  : 'self-start bg-white/5 border border-white/5 text-gray-100 rounded-tl-none'
              }`}
            >
              <span className="text-[10px] text-gray-500 mb-1 font-semibold uppercase tracking-wider">
                {m.sender === 'user' ? 'You' : 'Coach'}
              </span>
              {renderMessageContent(m.content)}
            </div>
          ))
        )}

        {isAiLoading && (
          <div className="self-start bg-white/5 border border-white/5 text-gray-100 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2 max-w-[85%]">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-gray-400">Coach is analyzing your metrics...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t border-white/5 p-4 bg-white/1 flex gap-2">
        <input
          type="text"
          placeholder={apiKey ? "Ask a nutritionist / coach question..." : "Enter your API Key above to begin chat..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!apiKey || isAiLoading}
          className="flex-1 bg-black/40 border-white/10 rounded-xl px-4"
        />
        <button
          type="submit"
          disabled={!apiKey || !input.trim() || isAiLoading}
          className="p-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-40 disabled:hover:bg-purple-500 text-black rounded-xl transition flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
