
import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, AlertTriangle, Save, X, Settings } from 'lucide-react'
import { supabase } from '../supabaseClient'

const DebuffSettings = ({ isAdmin }) => {
    const [debuffs, setDebuffs] = useState([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState(null)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        severity: 5,
        trigger_type: 'mayhem',
        is_active: true
    })

    useEffect(() => {
        fetchDebuffs()
    }, [])

    const fetchDebuffs = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('debuffs')
            .select('*')
            .order('severity', { ascending: false })
        
        if (error) {
            console.error('Error fetching debuffs:', error)
        } else {
            setDebuffs(data || [])
        }
        setLoading(false)
    }

    const handleSave = async () => {
        if (!formData.title || !formData.description) return

        const debuffData = {
            title: formData.title,
            description: formData.description,
            severity: parseInt(formData.severity),
            trigger_type: formData.trigger_type,
            is_active: formData.is_active
        }

        if (editingId) {
            const { error } = await supabase
                .from('debuffs')
                .update(debuffData)
                .eq('id', editingId)
            
            if (error) alert('Error updating debuff: ' + error.message)
        } else {
            const { error } = await supabase
                .from('debuffs')
                .insert([debuffData])
            
            if (error) alert('Error creating debuff: ' + error.message)
        }

        setEditingId(null)
        setFormData({ title: '', description: '', severity: 5, trigger_type: 'mayhem', is_active: true })
        fetchDebuffs()
    }

    const handleEdit = (debuff) => {
        setEditingId(debuff.id)
        setFormData({
            title: debuff.title,
            description: debuff.description,
            severity: debuff.severity,
            trigger_type: debuff.trigger_type,
            is_active: debuff.is_active
        })
    }

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this debuff?')) return

        const { error } = await supabase
            .from('debuffs')
            .delete()
            .eq('id', id)
        
        if (error) {
            alert('Error deleting debuff: ' + error.message)
        } else {
            fetchDebuffs()
        }
    }

    const handleCancel = () => {
        setEditingId(null)
        setFormData({ title: '', description: '', severity: 5, trigger_type: 'mayhem', is_active: true })
        setEditingId(null)
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Settings size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Admin Access Required</h3>
                <p className="text-gray-500 dark:text-gray-400">Please log in as an administrator to manage debuffs.</p>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                    <AlertTriangle className="mr-3 text-amber-500" />
                    Debuff Configuration
                </h2>
            </div>
            
            {/* Editor Form */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
                <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">
                    {editingId ? 'Edit Debuff' : 'Add New Debuff'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Title</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Broken Paddle"
                            value={formData.title}
                            onChange={e => setFormData({...formData, title: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Trigger Type</label>
                        <select 
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.trigger_type}
                            onChange={e => setFormData({...formData, trigger_type: e.target.value})}
                        >
                            <option value="mayhem">Mayhem Mode (Random)</option>
                            <option value="streak_loss_8">Loss Streak (8+)</option>
                            <option value="streak_loss_16">Loss Streak (16+)</option>
                        </select>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Description</label>
                    <textarea 
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white h-24 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Explain the debuff rules..."
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Severity (1-10)</label>
                        <div className="flex items-center gap-4">
                            <input 
                                type="range" 
                                min="1" 
                                max="10" 
                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                value={formData.severity}
                                onChange={e => setFormData({...formData, severity: e.target.value})}
                            />
                            <span className="font-bold text-gray-900 dark:text-white w-8 text-center bg-gray-100 dark:bg-gray-700 py-1 rounded">{formData.severity}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Higher severity = More punishing. Higher Elo players get higher severity debuffs.</p>
                    </div>
                    <div className="flex items-center">
                        <label className="flex items-center cursor-pointer select-none">
                            <div className="relative">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={formData.is_active}
                                    onChange={e => setFormData({...formData, is_active: e.target.checked})}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                            </div>
                            <span className="ml-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Active</span>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                    {editingId && (
                        <button 
                            onClick={handleCancel}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center transition-colors"
                        >
                            <X size={18} className="mr-1" /> Cancel
                        </button>
                    )}
                    <button 
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold flex items-center shadow-md transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!formData.title || !formData.description}
                    >
                        <Save size={18} className="mr-2" />
                        {editingId ? 'Update Debuff' : 'Create Debuff'}
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Existing Debuffs</h3>
                
                {loading ? (
                    <div className="text-center py-10 text-gray-500">Loading debuffs...</div>
                ) : debuffs.length === 0 ? (
                     <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                        <p className="text-gray-500">No debuffs configured yet.</p>
                     </div>
                ) : (
                    <div className="grid gap-4">
                        {debuffs.map(debuff => (
                            <div key={debuff.id} className={`bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border transition-all hover:shadow-md ${!debuff.is_active ? 'opacity-60 border-gray-200 dark:border-gray-700 grayscale' : 'border-l-4 border-l-amber-500 border-gray-200 dark:border-gray-700'}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 pr-4">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <h4 className="font-bold text-gray-900 dark:text-white text-lg">{debuff.title}</h4>
                                            
                                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold tracking-wide uppercase ${
                                                debuff.trigger_type === 'mayhem' 
                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' 
                                                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                            }`}>
                                                {debuff.trigger_type.replace(/_/g, ' ')}
                                            </span>
                                            
                                            <div className="flex items-center text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 font-mono font-bold">
                                                <AlertTriangle size={10} className="mr-1" />
                                                LVL {debuff.severity}
                                            </div>
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{debuff.description}</p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button 
                                            onClick={() => handleEdit(debuff)}
                                            className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(debuff.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default DebuffSettings
