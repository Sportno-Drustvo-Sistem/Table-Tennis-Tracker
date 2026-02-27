import React, { useState, useEffect } from 'react'
import { MessageSquare, Save, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { getDiscordWebhook, updateDiscordWebhook, getDailyStats, formatDiscordMessage, sendToDiscord } from '../discordUtils'

const DiscordSettings = () => {
    const [webhookUrl, setWebhookUrl] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [sending, setSending] = useState(false)
    const [status, setStatus] = useState({ type: null, message: '' })

    useEffect(() => {
        const fetchWebhook = async () => {
            const url = await getDiscordWebhook()
            setWebhookUrl(url || '')
            setLoading(false)
        }
        fetchWebhook()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        setStatus({ type: null, message: '' })
        try {
            await updateDiscordWebhook(webhookUrl)
            setStatus({ type: 'success', message: 'Webhook URL saved successfully!' })
        } catch (error) {
            setStatus({ type: 'error', message: 'Failed to save webhook URL.' })
        } finally {
            setSaving(false)
        }
    }

    const handleSendStats = async () => {
        if (!webhookUrl) {
            setStatus({ type: 'error', message: 'Please set a webhook URL first.' })
            return
        }

        setSending(true)
        setStatus({ type: null, message: '' })
        try {
            const today = new Date()
            const stats = await getDailyStats(today)
            const payload = formatDiscordMessage(stats, today)
            await sendToDiscord(webhookUrl, payload)
            setStatus({ type: 'success', message: "Today's stats sent to Discord!" })
        } catch (error) {
            setStatus({ type: 'error', message: `Failed to send stats: ${error.message}` })
        } finally {
            setSending(false)
        }
    }

    if (loading) {
        return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div>
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mt-8">
            <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white flex items-center">
                <MessageSquare className="mr-2 text-indigo-500" size={20} />
                Discord Integration
            </h3>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Discord Webhook URL
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="https://discord.com/api/webhooks/..."
                            value={webhookUrl}
                            onChange={e => setWebhookUrl(e.target.value)}
                        />
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold flex items-center shadow-sm disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
                            Save
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        Go to your Discord Server Settings &gt; Integrations &gt; Webhooks to create one.
                    </p>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h4 className="font-bold text-gray-800 dark:text-white">Social Daily Digest</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Broadcast today's matches and head-to-head records to your community.
                        </p>
                    </div>
                    <button
                        onClick={handleSendStats}
                        disabled={sending || !webhookUrl}
                        className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 font-bold flex items-center shadow-md transition-all hover:shadow-lg disabled:opacity-50"
                    >
                        {sending ? <Loader2 className="animate-spin mr-2" size={18} /> : <Send className="mr-2" size={18} />}
                        Send Today's Stats
                    </button>
                </div>

                {status.type && (
                    <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${status.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {status.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                        <span className="text-sm font-medium">{status.message}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

export default DiscordSettings
