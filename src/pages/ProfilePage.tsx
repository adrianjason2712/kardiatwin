import React, { useState, useEffect } from 'react';
import API from '../utils/axios';
import { User, Save, CheckCircle2, AlertCircle, Shield, UserCircle, HelpCircle, ClipboardList } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface UserProfile {
    profile_name?: string;
    age?: number;
    sex?: string;
    smoking_status?: string;
    diabetes_history?: string;
    alcohol_consumption?: string;
    activity_level?: string;
    pad_history?: string;
    // Context Fields
    height?: number;
    weight?: number;
    family_history?: string;
    allergies?: string;
}

export function ProfilePage() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<UserProfile>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await API.get('/api/profile');
            setProfile(response.data);
        } catch (error) {
            console.error('Error fetching profile:', error);
            setMessage({ text: 'Failed to load passport data.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        let { name, value } = e.target;

        if (name === 'age' && value) {
            const num = parseInt(value);
            if (num > 105) value = "105";
        }

        setProfile((prev) => ({
            ...prev,
            [name]: (name === 'age' || name === 'height' || name === 'weight') ? (value ? parseFloat(value) : undefined) : value,
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            await API.post('/api/profile', profile);
            setMessage({ text: 'Medical Passport updated successfully!', type: 'success' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error saving profile:', error);
            setMessage({ text: 'Failed to update passport. Please try again.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 min-h-[60vh]">
                <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                    <p className="text-gray-500 font-medium">Accessing Medical Passport...</p>
                </div>
            </div>
        );
    }

    const renderInput = (label: string, name: string, type: string, placeholder?: string, tooltip?: string) => {
        const isAge = name === 'age';
        return (
            <div className="group">
                <div className="flex items-center space-x-2 mb-1.5">
                    <label className="block text-sm font-semibold text-gray-700 transition-colors group-focus-within:text-indigo-600">{label}</label>
                    {tooltip && (
                        <div className="relative group/tooltip">
                            <HelpCircle className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                {tooltip}
                            </div>
                        </div>
                    )}
                </div>
                <input
                    type={type}
                    name={name}
                    value={(profile as any)[name] || ''}
                    onChange={handleChange}
                    {...(isAge ? { min: 18, max: 105 } : {})}
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-gray-800 placeholder-gray-400 disabled:opacity-50"
                    placeholder={placeholder}
                />
            </div>
        );
    };

    const renderSelect = (label: string, name: string, options: { value: string; label: string }[], tooltip?: string) => (
        <div className="group">
            <div className="flex items-center space-x-2 mb-1.5">
                <label className="block text-sm font-semibold text-gray-700 transition-colors group-focus-within:text-indigo-600">{label}</label>
                {tooltip && (
                    <div className="relative group/tooltip">
                        <HelpCircle className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                            {tooltip}
                        </div>
                    </div>
                )}
            </div>
            <div className="relative">
                <select
                    name={name}
                    value={(profile as any)[name] || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-gray-800 appearance-none pointer-cursor"
                >
                    <option value="" disabled className="text-gray-400">Select option...</option>
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
            </div>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12 px-4 sm:px-0">

            {/* Header Banner */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="h-32 bg-gradient-to-r from-teal-600 via-emerald-500 to-emerald-400"></div>
                <div className="px-8 pb-8 relative">
                    <div className="flex flex-col sm:flex-row items-center sm:items-end sm:space-x-6 -mt-12 sm:-mt-16 mb-4 sm:mb-0">
                        <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full border-4 border-white bg-emerald-600 flex items-center justify-center text-white text-4xl font-bold shadow-md z-10">
                            {user?.username ? user.username.charAt(0).toUpperCase() : <User size={40} />}
                        </div>
                        <div className="text-center sm:text-left mt-4 sm:mt-0 pb-2 flex-1">
                            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                                {user?.profile_name || user?.username || 'Medical Passport'}
                            </h1>
                            <p className="text-gray-500 font-medium flex items-center justify-center sm:justify-start space-x-2 mt-1">
                                <Shield className="h-4 w-4 text-emerald-500" />
                                <span>HIPAA Compliant • User Baseline Profile</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-xl flex items-center space-x-3 shadow-sm transform transition-all animate-slide-up ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {message.type === 'success' ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <AlertCircle className="h-6 w-6 text-red-600" />}
                    <span className="font-semibold text-sm">{message.text}</span>
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Baseline Identity Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-3">
                                <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                                    <UserCircle className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Baseline Identity</h3>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('Age', 'age', 'number', 'Enter your age', 'Age helps in standardizing cardiac response predictions')}
                                {renderSelect('Biological Sex', 'sex', [
                                    { value: '1', label: 'Male' },
                                    { value: '0', label: 'Female' }
                                ], "Fixed physiological parameter.")}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('Height (cm)', 'height', 'number', 'e.g. 175')}
                                {renderInput('Weight (kg)', 'weight', 'number', 'e.g. 70')}
                            </div>

                            <div className="pt-6 border-t border-gray-100">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Baseline Lifestyle</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {renderSelect('Activity Level', 'activity_level', [
                                        { value: 'sedentary', label: 'Sedentary (No regular exercise)' },
                                        { value: 'active', label: 'Active (Regular activity)' },
                                        { value: 'athlete', label: 'Athlete (Intense training)' }
                                    ], "Your typical activity level.")}

                                    {renderSelect('Smoking Status', 'smoking_status', [
                                        { value: 'non_smoker', label: 'Never Smoked' },
                                        { value: 'ex_smoker', label: 'Former Smoker' },
                                        { value: 'smoker', label: 'Active Smoker' }
                                    ], "Long-term tobacco usage history.")}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Medical Context Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-3">
                                <div className="p-2.5 bg-blue-50 rounded-xl text-blue-500">
                                    <ClipboardList className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Medical History</h3>
                            </div>
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider rounded-md border border-blue-100">RAG Context</span>
                        </div>

                        <p className="text-sm text-gray-500 mb-6 bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                            Transient data (Chest Pain, ECG) is entered during simulations. These fields provide deep clinical context for the chatbot.
                        </p>

                        <div className="space-y-5">
                            {renderSelect('Alcohol Consumption', 'alcohol_consumption', [
                                { value: 'none', label: 'None / Rare' },
                                { value: 'moderate', label: 'Moderate (1-2 drinks/day)' },
                                { value: 'heavy', label: 'Frequent (>2 drinks/day)' }
                            ])}

                            {renderSelect('Diabetes History', 'diabetes_history', [
                                { value: 'none', label: 'None' },
                                { value: 'type_1', label: 'Type 1 Diabetes' },
                                { value: 'type_2', label: 'Type 2 Diabetes' }
                            ])}

                            {renderSelect('Peripheral Artery Disease', 'pad_history', [
                                { value: 'no_pad', label: 'No PAD' },
                                { value: 'pad', label: 'PAD Diagnosed' }
                            ], "Baseline vascular status.")}

                            <div className="group">
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Family Cardiac History</label>
                                <textarea
                                    name="family_history"
                                    value={profile.family_history || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-gray-800 placeholder-gray-400 min-h-[100px]"
                                    placeholder="Any hereditary heart conditions..."
                                />
                            </div>

                            <div className="group">
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Allergies & Medical Notes</label>
                                <textarea
                                    name="allergies"
                                    value={profile.allergies || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-gray-800 placeholder-gray-400 min-h-[100px]"
                                    placeholder="Drug allergies, chronic illnesses, etc..."
                                />
                            </div>
                        </div>
                    </div>

                </div>

                {/* Sticky Action Footer */}
                <div className="sticky bottom-4 z-20 mt-8 mb-4">
                    <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200 p-4 flex justify-between items-center sm:px-8">
                        <div className="hidden sm:block">
                            <p className="text-sm font-semibold text-gray-800">Passport baseline synchronization ready.</p>
                            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Physics data is session-specific</p>
                        </div>
                        <button
                            type="submit"
                            disabled={saving}
                            className={`w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-3.5 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95
                                ${saving
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-500/40'
                                }`}
                        >
                            {saving ? (
                                <>
                                    <div className="animate-spin h-5 w-5 border-2 border-white/80 border-t-transparent rounded-full" />
                                    <span>Syncing...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="h-5 w-5" />
                                    <span>Update Medical Passport</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </form>
        </div>
    );
}
