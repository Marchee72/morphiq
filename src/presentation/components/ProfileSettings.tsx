import React, { useState } from 'react';
import { useStore } from '../state/store';
import { User, Users, Trash2, Key, Save, Plus } from 'lucide-react';

export const ProfileSettings: React.FC = () => {
  const {
    profiles,
    activeProfile,
    setActiveProfile,
    createProfile,
    deleteProfile,
    apiKey,
    setApiKey,
  } = useStore();

  const [showCreate, setShowCreate] = useState(profiles.length === 0);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [targetBodyFat, setTargetBodyFat] = useState('');

  const [keyInput, setKeyInput] = useState(apiKey);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !age || !height) return;

    await createProfile({
      name: name.trim(),
      gender,
      age: Number(age),
      height: Number(height),
      targetWeight: targetWeight ? Number(targetWeight) : undefined,
      targetBodyFat: targetBodyFat ? Number(targetBodyFat) : undefined,
    });

    // Reset fields
    setName('');
    setAge('');
    setHeight('');
    setTargetWeight('');
    setTargetBodyFat('');
    setShowCreate(false);
  };

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    setApiKey(keyInput.trim());
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      {/* Left side: Profiles selector and creation */}
      <div className="flex flex-col gap-4">
        {/* Profile Selector */}
        <div className="glass-panel p-5">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            <span>Profile Management</span>
          </h2>

          <div className="flex flex-col gap-4">
            {profiles.length > 0 ? (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Switch Profile</label>
                <div className="flex gap-2">
                  <select
                    value={activeProfile?.id || ''}
                    onChange={(e) => setActiveProfile(e.target.value)}
                    className="flex-1 bg-black/40 text-sm"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.gender}, {p.age} yrs)
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => activeProfile?.id && deleteProfile(activeProfile.id)}
                    className="p-2.5 hover:bg-white/5 border border-white/5 text-gray-500 hover:text-red-400 rounded-lg transition"
                    title="Delete current profile and all data"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-2">No profiles exist. Create one below to begin.</p>
            )}

            {!showCreate && (
              <button
                onClick={() => setShowCreate(true)}
                className="glow-btn flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-black" />
                <span>Create New Profile</span>
              </button>
            )}
          </div>
        </div>

        {/* Profile Creator Form */}
        {showCreate && (
          <div className="glass-panel p-5">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-teal-400" />
              <span>Create New Profile</span>
            </h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="User Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-black/40 text-sm"
                required
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="bg-black/40 text-sm col-span-1"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <input
                  type="number"
                  placeholder="Age (yrs)"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="bg-black/40 text-sm"
                  min="1"
                  max="120"
                  required
                />
                <input
                  type="number"
                  placeholder="Height (cm)"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="bg-black/40 text-sm"
                  min="50"
                  max="250"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Target Weight (kg)"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  className="bg-black/40 text-sm"
                  min="10"
                />
                <input
                  type="number"
                  placeholder="Target Body Fat (%)"
                  value={targetBodyFat}
                  onChange={(e) => setTargetBodyFat(e.target.value)}
                  className="bg-black/40 text-sm"
                  min="3"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <button type="submit" className="glow-btn flex-1 text-center font-bold">
                  Create Profile
                </button>
                {profiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="bg-white/5 border border-white/5 hover:bg-white/10 px-4 rounded-lg text-sm transition"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Right side: Configuration and API Keys */}
      <div className="flex flex-col gap-4">
        {/* LLM Key setup */}
        <div className="glass-panel p-5">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-purple-400" />
            <span>AI Key Configuration</span>
          </h2>
          <form onSubmit={handleSaveKey} className="flex flex-col gap-3">
            <p className="text-xs text-gray-400 leading-relaxed">
              Google Gemini API key is required to activate the personal Nutritionist & Gym Coach chatbot. 
              Get your key from the Google AI Studio for free. Your key never leaves your device.
            </p>
            <input
              type="password"
              placeholder="Enter Gemini API Key (AIzaSy...)"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="bg-black/40 text-sm"
            />
            <button
              type="submit"
              className="glow-btn flex items-center justify-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, var(--accent-purple), #a855f7)' }}
            >
              <Save className="w-4 h-4 text-black" />
              <span>Save Configurations</span>
            </button>
          </form>
        </div>
      </div>

    </div>
  );
};
