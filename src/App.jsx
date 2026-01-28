import { useState, useEffect, useCallback } from 'react'
import { Plus, Users, X, History, Trophy, BarChart2, LayoutGrid, Moon, Sun } from 'lucide-react'
import { supabase } from './supabaseClient'
import UserCard from './components/UserCard'
import Leaderboard from './components/Leaderboard'
import PlayerStats from './components/PlayerStats'
import AddUserModal from './components/modals/AddUserModal'
import EditUserModal from './components/modals/EditUserModal'
import EditMatchModal from './components/modals/EditMatchModal'
import MatchHistoryModal from './components/modals/MatchHistoryModal'
import MatchModal from './components/modals/MatchModal'

// --- Main App ---

export default function App() {
  const [users, setUsers] = useState([])
  const [matches, setMatches] = useState([]) // New: Store matches globally
  const [loading, setLoading] = useState(true)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState([])

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(() => {
    if (localStorage.getItem('theme') === 'dark') return true
    return false
  })

  // Navigation State
  const [activeTab, setActiveTab] = useState('grid') // 'grid', 'leaderboard', 'stats'
  const [statsPlayerId, setStatsPlayerId] = useState(null)

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  const [editingUser, setEditingUser] = useState(null)
  const [editingMatch, setEditingMatch] = useState(null)

  // Apply Dark Mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  const fetchData = useCallback(async () => {
    setLoading(true)

    // 1. Fetch Users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .order('total_wins', { ascending: false })

    if (userError) console.error('Error fetching users:', userError)
    else setUsers(userData || [])

    // 2. Fetch Matches (Needed for Leaderboard/Stats)
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .order('created_at', { ascending: false })

    if (matchError) console.error('Error fetching matches:', matchError)
    else setMatches(matchData || [])

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleUserClick = (user) => {
    if (selectionMode) {
      const isSelected = selectedUsers.some(u => u.id === user.id)
      let newSelected = []

      if (isSelected) {
        newSelected = selectedUsers.filter(u => u.id !== user.id)
      } else {
        if (selectedUsers.length >= 2) return
        newSelected = [...selectedUsers, user]
      }

      setSelectedUsers(newSelected)

      if (newSelected.length === 2) {
        setTimeout(() => {
          setIsMatchModalOpen(true)
        }, 300)
      }
    } else {
      // If not in selection mode, maybe go to their stats?
      // Or edit? We have an edit pencil for editing.
      // Let's make click go to stats page for that user.
      setStatsPlayerId(user.id)
      setActiveTab('stats')
    }
  }

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode)
    setSelectedUsers([])
  }

  const handleMatchSaved = () => {
    setIsMatchModalOpen(false)
    setSelectionMode(false)
    setSelectedUsers([])
    fetchData()
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8 transition-colors duration-200`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white flex items-center">
              <span className="bg-blue-600 text-white p-2 rounded-lg mr-3 shadow-lg">🏓</span>
              Ping Pong Tracker
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 ml-1">Track your garage glory.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-yellow-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm transition-all"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Navigation Tabs */}
            <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mr-2">
              <button
                onClick={() => setActiveTab('grid')}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${activeTab === 'grid' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                <LayoutGrid size={18} className="mr-2" /> Players
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${activeTab === 'leaderboard' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                <Trophy size={18} className="mr-2" /> Leaderboard
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${activeTab === 'stats' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                <BarChart2 size={18} className="mr-2" /> Stats
              </button>
            </div>

            <button
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium shadow-sm transition-all hover:shadow-md"
            >
              <History size={20} className="mr-2" />
              History
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium shadow-sm transition-all hover:shadow-md"
            >
              <Plus size={20} className="mr-2" />
              Add Player
            </button>
            <button
              onClick={toggleSelectionMode}
              className={`flex items-center px-6 py-2 rounded-lg font-bold shadow-sm transition-all hover:shadow-md ${selectionMode
                ? 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-800 dark:hover:bg-red-800'
                : 'bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500'
                }`}
            >
              {selectionMode ? (
                <>
                  <X size={20} className="mr-2" /> Cancel Match
                </>
              ) : (
                <>
                  <Users size={20} className="mr-2" /> New Match
                </>
              )}
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main>
          {activeTab === 'grid' && (
            <>
              {/* Selection Instruction */}
              {selectionMode && (
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 px-6 py-4 rounded-xl mb-8 flex items-center justify-between animate-fadeIn">
                  <span className="font-medium">
                    Select 2 players to start a match ({selectedUsers.length}/2)
                  </span>
                  <div className="flex -space-x-2">
                    {selectedUsers.map(u => (
                      <img key={u.id} src={u.avatar_url || 'https://via.placeholder.com/150'} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 object-cover" alt={u.name} />
                    ))}
                  </div>
                </div>
              )}

              {/* Grid */}
              {loading ? (
                <div className="text-center py-20 text-gray-400 dark:text-gray-500">Loading players...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="text-6xl mb-4">👻</div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">No players found</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">Add some colleagues to get started!</p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus size={20} className="mr-2" />
                    Add Player
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {users.map(user => (
                    <UserCard
                      key={user.id}
                      user={user}
                      selectionMode={selectionMode}
                      isSelected={selectedUsers.some(u => u.id === user.id)}
                      onClick={() => handleUserClick(user)}
                      onEdit={setEditingUser}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'leaderboard' && (
            <Leaderboard users={users} matches={matches} />
          )}

          {activeTab === 'stats' && (
            <PlayerStats users={users} matches={matches} initialPlayerId={statsPlayerId} />
          )}
        </main>

        {/* Modals */}
        <AddUserModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onUserAdded={fetchData}
        />

        <EditUserModal
          isOpen={!!editingUser}
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUserUpdated={fetchData}
        />

        <MatchHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          onEditMatch={setEditingMatch}
          onMatchDeleted={fetchData}
        />

        <EditMatchModal
          isOpen={!!editingMatch}
          match={editingMatch}
          onClose={() => setEditingMatch(null)}
          onMatchUpdated={() => {
            fetchData()
            setIsHistoryOpen(false) // Close history to force refresh when reopened or simply close it.
          }}
        />

        {selectedUsers.length === 2 && (
          <MatchModal
            isOpen={isMatchModalOpen}
            onClose={() => {
              setIsMatchModalOpen(false)
              // Keep selection? No, let's clear it if they close the modal without saving to avoid stuck state.
              // Actually, existing logic was: close modal -> keep selection.
              // I'll keep it consistent with previous logic.
            }}
            player1={selectedUsers[0]}
            player2={selectedUsers[1]}
            onMatchSaved={handleMatchSaved}
          />
        )}
      </div>
    </div>
  )
}
