import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trophy, BarChart2, LayoutGrid, Moon, Sun, Calendar, Swords, Settings } from 'lucide-react'
import { supabase } from './supabaseClient'
import { recalculatePlayerStats } from './utils'
import UserCard from './components/UserCard'
import Leaderboard from './components/Leaderboard'
import PlayerStats from './components/PlayerStats'
import Matches from './components/Matches'
import AddUserModal from './components/modals/AddUserModal'
import EditUserModal from './components/modals/EditUserModal'
import EditMatchModal from './components/modals/EditMatchModal'
import PlayerSelectionModal from './components/modals/PlayerSelectionModal'
import MatchModal from './components/modals/MatchModal'
import MatchGeneratorModal from './components/modals/MatchGeneratorModal'
import LoginModal from './components/modals/LoginModal'
import AdminButton from './components/AdminButton'
import DebuffSettings from './components/DebuffSettings'
import DiscordSettings from './components/DiscordSettings'

// Padel imports
import PadelLeaderboard from './components/PadelLeaderboard'
import PadelPlayerStats from './components/PadelPlayerStats'
import PadelMatches from './components/PadelMatches'
import PadelPlayerSelectionModal from './components/modals/PadelPlayerSelectionModal'
import PadelMatchModal from './components/modals/PadelMatchModal'
import PadelEditMatchModal from './components/modals/PadelEditMatchModal'
import PadelMatchGeneratorModal from './components/modals/PadelMatchGeneratorModal'
import Tournament from './components/tournament/Tournament'

// --- Main App ---

function App() {
  const [users, setUsers] = useState([])
  const [matches, setMatches] = useState([])
  const [padelMatches, setPadelMatches] = useState([])
  const [padelStats, setPadelStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [migrating, setMigrating] = useState(false)
  const migrationAttempted = useRef(false)

  // Sport Switcher State
  const [activeSport, setActiveSport] = useState(() => {
    return localStorage.getItem('activeSport') || 'pingpong'
  })

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(() => {
    if (localStorage.getItem('theme') === 'dark') return true
    return false
  })

  // Admin State
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('isAdmin') === 'true'
  })
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  const handleAdminLogin = () => {
    setIsAdmin(true)
    localStorage.setItem('isAdmin', 'true')
  }

  const handleAdminLogout = () => {
    setIsAdmin(false)
    localStorage.removeItem('isAdmin')
  }

  // Navigation State
  const [activeTab, setActiveTab] = useState('grid') // 'grid', 'leaderboard', 'stats', 'matches', 'tournament'
  const [statsPlayerId, setStatsPlayerId] = useState(null)

  // Modal States — Ping Pong
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isPlayerSelectionOpen, setIsPlayerSelectionOpen] = useState(false)
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false)
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false)
  const [selectedPlayers, setSelectedPlayers] = useState([null, null])
  const [isMatchFromGenerator, setIsMatchFromGenerator] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editingMatch, setEditingMatch] = useState(null)

  // Modal States — Padel
  const [isPadelSelectionOpen, setIsPadelSelectionOpen] = useState(false)
  const [isPadelMatchModalOpen, setIsPadelMatchModalOpen] = useState(false)
  const [isPadelGeneratorOpen, setIsPadelGeneratorOpen] = useState(false)
  const [padelTeams, setPadelTeams] = useState({ team1: null, team2: null })
  const [isPadelMatchFromGenerator, setIsPadelMatchFromGenerator] = useState(false)
  const [editingPadelMatch, setEditingPadelMatch] = useState(null)

  // Persist sport selection
  useEffect(() => {
    localStorage.setItem('activeSport', activeSport)
  }, [activeSport])

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

    // 1. Fetch Users (shared)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .order('total_wins', { ascending: false })

    if (userError) console.error('Error fetching users:', userError)
    else setUsers(userData || [])

    // 2. Fetch Ping Pong Matches
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .order('created_at', { ascending: false })

    if (matchError) console.error('Error fetching matches:', matchError)
    else setMatches(matchData || [])

    // 3. Fetch Padel Matches
    const { data: padelMatchData, error: padelMatchError } = await supabase
      .from('padel_matches')
      .select('*')
      .order('created_at', { ascending: false })

    if (padelMatchError) console.error('Error fetching padel matches:', padelMatchError)
    else setPadelMatches(padelMatchData || [])

    // 4. Fetch Padel Stats
    const { data: padelStatsData, error: padelStatsError } = await supabase
      .from('padel_stats')
      .select('*')

    if (padelStatsError) console.error('Error fetching padel stats:', padelStatsError)
    else setPadelStats(padelStatsData || [])

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()

    // Realtime Subscription with Debounce
    let debounceTimer
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        console.log('Refreshing data from realtime update...')
        fetchData()
      }, 1000)
    }

    const subscription = supabase
      .channel('public:db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
        console.log('Match change received!', payload)
        debouncedFetch()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
        console.log('User change received!', payload)
        debouncedFetch()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'padel_matches' }, (payload) => {
        console.log('Padel match change received!', payload)
        debouncedFetch()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'padel_stats' }, (payload) => {
        console.log('Padel stats change received!', payload)
        debouncedFetch()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [fetchData])

  // Automatic Migration Check: Recalculate stats if matches exist but stats are empty
  useEffect(() => {
    if (!loading && matches.length > 0 && users.length > 0 && !migrationAttempted.current) {
      const totalMatchesPlayed = users.reduce((acc, user) => acc + (user.matches_played || 0), 0)

      if (totalMatchesPlayed === 0) {
        console.log('Detected uninitialized stats. Running recalculation...')
        migrationAttempted.current = true
        setMigrating(true)
        recalculatePlayerStats()
          .then(() => {
            console.log('Recalculation complete.')
            fetchData()
          })
          .catch(err => {
            console.error('Migration failed:', err)
            if (err.message && err.message.includes('column')) {
              alert('Automatic update failed: Missing database columns. Please run the SQL migration to add elo_rating, matches_played, and is_ranked columns.')
            }
          })
          .finally(() => setMigrating(false))
      }
    }
  }, [loading, matches.length, users.length, fetchData])

  const handleUserClick = (user) => {
    setStatsPlayerId(user.id)
    setActiveTab('stats')
  }

  // Ping Pong handlers
  const handlePlayersSelected = (player1, player2) => {
    setSelectedPlayers([player1, player2])
    setIsMatchFromGenerator(false)
    setIsPlayerSelectionOpen(false)
    setIsMatchModalOpen(true)
  }

  const handleMatchGenerated = (player1, player2) => {
    setSelectedPlayers([player1, player2])
    setIsMatchFromGenerator(true)
    setIsGeneratorOpen(false)
    setIsMatchModalOpen(true)
  }

  const handleMatchSaved = () => {
    setIsMatchModalOpen(false)
    setSelectedPlayers([null, null])
    fetchData()

    if (isMatchFromGenerator) {
      setIsMatchFromGenerator(false)
      setIsGeneratorOpen(true)
    }
  }

  // Padel handlers
  const handlePadelTeamsSelected = (team1, team2) => {
    setPadelTeams({ team1, team2 })
    setIsPadelMatchFromGenerator(false)
    setIsPadelSelectionOpen(false)
    setIsPadelMatchModalOpen(true)
  }

  const handlePadelMatchGenerated = (team1, team2) => {
    setPadelTeams({ team1, team2 })
    setIsPadelMatchFromGenerator(true)
    setIsPadelGeneratorOpen(false)
    setIsPadelMatchModalOpen(true)
  }

  const handlePadelMatchSaved = () => {
    setIsPadelMatchModalOpen(false)
    setPadelTeams({ team1: null, team2: null })
    fetchData()

    if (isPadelMatchFromGenerator) {
      setIsPadelMatchFromGenerator(false)
      setIsPadelGeneratorOpen(true)
    }
  }

  const isPingPong = activeSport === 'pingpong'
  const sportEmoji = isPingPong ? '🏓' : '🎾'
  const sportName = isPingPong ? 'Ping Pong' : 'Padel'
  const sportSubtitle = isPingPong ? 'Track your garage glory.' : 'Track your doubles domination.'

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8 transition-colors duration-200`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white flex items-center justify-center md:justify-start gap-3">
              <span className={`${isPingPong ? 'bg-blue-600' : 'bg-green-600'} text-white p-2 rounded-lg shadow-lg flex-shrink-0`}>{sportEmoji}</span>
              <span>{sportName}</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 md:ml-1 w-full">{sportSubtitle}</p>
            {migrating && (
              <div className="mt-2 text-sm font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                ⚙️ Updating historical stats...
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {/* Sport Switcher */}
            <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveSport('pingpong')}
                className={`px-3 md:px-4 py-2 rounded-lg text-sm font-bold flex items-center whitespace-nowrap transition-all ${activeSport === 'pingpong'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
              >
                🏓 <span className="ml-1">Ping Pong</span>
              </button>
              <button
                onClick={() => setActiveSport('padel')}
                className={`px-3 md:px-4 py-2 rounded-lg text-sm font-bold flex items-center whitespace-nowrap transition-all ${activeSport === 'padel'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
              >
                🎾 <span className="ml-1">Padel</span>
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-yellow-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm transition-all"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Admin Button */}
            <AdminButton
              isAdmin={isAdmin}
              onClick={() => isAdmin ? handleAdminLogout() : setIsLoginModalOpen(true)}
            />

            {/* Navigation Tabs */}
            <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar max-w-[calc(100vw-2rem)] md:max-w-none">
              <button
                onClick={() => setActiveTab('grid')}
                className={`px-3 md:px-4 py-2 rounded-lg text-sm font-bold flex items-center whitespace-nowrap transition-all flex-shrink-0 ${activeTab === 'grid'
                  ? (isPingPong ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200')
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
              >
                <LayoutGrid size={18} className="mr-0 md:mr-2" /> <span className="hidden md:inline">Players</span>
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`px-3 md:px-4 py-2 rounded-lg text-sm font-bold flex items-center whitespace-nowrap transition-all flex-shrink-0 ${activeTab === 'leaderboard'
                  ? (isPingPong ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200')
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
              >
                <Trophy size={18} className="mr-0 md:mr-2" /> <span className="hidden md:inline">Leaderboard</span>
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-3 md:px-4 py-2 rounded-lg text-sm font-bold flex items-center whitespace-nowrap transition-all flex-shrink-0 ${activeTab === 'stats'
                  ? (isPingPong ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200')
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
              >
                <BarChart2 size={18} className="mr-0 md:mr-2" /> <span className="hidden md:inline">Stats</span>
              </button>
              <button
                onClick={() => setActiveTab('matches')}
                className={`px-3 md:px-4 py-2 rounded-lg text-sm font-bold flex items-center whitespace-nowrap transition-all flex-shrink-0 ${activeTab === 'matches'
                  ? (isPingPong ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200')
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
              >
                <Calendar size={18} className="mr-0 md:mr-2" /> <span className="hidden md:inline">Matches</span>
              </button>
              {isPingPong && (
                <button
                  onClick={() => setActiveTab('tournament')}
                  className={`px-3 md:px-4 py-2 rounded-lg text-sm font-bold flex items-center whitespace-nowrap transition-all flex-shrink-0 ${activeTab === 'tournament'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                  <Swords size={18} className="mr-0 md:mr-2" /> <span className="hidden md:inline">Tournament</span>
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`px-3 md:px-4 py-2 rounded-lg text-sm font-bold flex items-center whitespace-nowrap transition-all flex-shrink-0 ${activeTab === 'settings'
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                  <Settings size={18} className="mr-0 md:mr-2" /> <span className="hidden md:inline">Settings</span>
                </button>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center px-3 md:px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium shadow-sm transition-all hover:shadow-md"
              >
                <Plus size={20} className="md:mr-2" />
                <span className="hidden md:inline">Add Player</span>
              </button>

              {activeTab === 'matches' && (
                <button
                  onClick={() => isPingPong ? setIsPlayerSelectionOpen(true) : setIsPadelSelectionOpen(true)}
                  className={`flex items-center px-4 md:px-6 py-2 ${isPingPong ? 'bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500' : 'bg-green-600 hover:bg-green-700 dark:hover:bg-green-500'} text-white rounded-lg font-bold shadow-sm transition-all hover:shadow-md`}
                >
                  <Plus size={20} className="md:mr-2" /> <span className="hidden md:inline">New Match</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main>
          {activeTab === 'grid' && (
            <>
              {loading ? (
                <div className="text-center py-20 text-gray-400 dark:text-gray-500">Loading players...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="text-6xl mb-4">👻</div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">No players found</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">Add some colleagues to get started!</p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className={`inline-flex items-center px-4 py-2 ${isPingPong ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-lg`}
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
                      selectionMode={false}
                      isSelected={false}
                      onClick={() => handleUserClick(user)}
                      onEdit={setEditingUser}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'leaderboard' && (
            isPingPong ? (
              <Leaderboard users={users} matches={matches} isAdmin={isAdmin} />
            ) : (
              <PadelLeaderboard users={users} matches={padelMatches} padelStats={padelStats} isAdmin={isAdmin} />
            )
          )}

          {activeTab === 'stats' && (
            isPingPong ? (
              <PlayerStats users={users} matches={matches} initialPlayerId={statsPlayerId} />
            ) : (
              <PadelPlayerStats users={users} matches={padelMatches} padelStats={padelStats} initialPlayerId={statsPlayerId} />
            )
          )}

          {activeTab === 'matches' && (
            isPingPong ? (
              <Matches
                matches={matches}
                users={users}
                onEditMatch={setEditingMatch}
                onMatchDeleted={fetchData}
                onGenerateMatch={() => setIsGeneratorOpen(true)}
                isAdmin={isAdmin}
              />
            ) : (
              <PadelMatches
                matches={padelMatches}
                users={users}
                padelStats={padelStats}
                onEditMatch={setEditingPadelMatch}
                onMatchDeleted={fetchData}
                onGenerateMatch={() => setIsPadelGeneratorOpen(true)}
                isAdmin={isAdmin}
              />
            )
          )
          }

          {activeTab === 'tournament' && (
            <Tournament
              users={users}
              matches={matches}
              fetchData={fetchData}
              isAdmin={isAdmin}
            />
          )}

          {activeTab === 'settings' && isAdmin && (
            <div className="space-y-6">
              <DebuffSettings isAdmin={isAdmin} />
              <DiscordSettings />
            </div>
          )}
        </main>

        {/* Shared Modals */}
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
          isAdmin={isAdmin}
        />

        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLogin={handleAdminLogin}
        />

        {/* Ping Pong Modals */}
        <PlayerSelectionModal
          isOpen={isPlayerSelectionOpen}
          onClose={() => setIsPlayerSelectionOpen(false)}
          users={users}
          onPlayersSelected={handlePlayersSelected}
        />

        <MatchGeneratorModal
          isOpen={isGeneratorOpen}
          onClose={() => setIsGeneratorOpen(false)}
          users={users}
          matches={matches}
          onMatchGenerated={handleMatchGenerated}
        />

        <EditMatchModal
          isOpen={!!editingMatch}
          match={editingMatch}
          onClose={() => setEditingMatch(null)}
          onMatchUpdated={fetchData}
          isAdmin={isAdmin}
        />

        {selectedPlayers[0] && selectedPlayers[1] && (
          <MatchModal
            isOpen={isMatchModalOpen}
            onClose={() => {
              setIsMatchModalOpen(false)
              setSelectedPlayers([null, null])
            }}
            player1={selectedPlayers[0]}
            player2={selectedPlayers[1]}
            onMatchSaved={handleMatchSaved}
            matches={matches}
          />
        )}

        {/* Padel Modals */}
        <PadelPlayerSelectionModal
          isOpen={isPadelSelectionOpen}
          onClose={() => setIsPadelSelectionOpen(false)}
          users={users}
          onTeamsSelected={handlePadelTeamsSelected}
        />

        <PadelMatchGeneratorModal
          isOpen={isPadelGeneratorOpen}
          onClose={() => setIsPadelGeneratorOpen(false)}
          users={users}
          matches={padelMatches}
          padelStats={padelStats}
          onMatchGenerated={handlePadelMatchGenerated}
        />

        <PadelEditMatchModal
          isOpen={!!editingPadelMatch}
          match={editingPadelMatch}
          onClose={() => setEditingPadelMatch(null)}
          onMatchUpdated={fetchData}
          isAdmin={isAdmin}
        />

        {padelTeams.team1 && padelTeams.team2 && (
          <PadelMatchModal
            isOpen={isPadelMatchModalOpen}
            onClose={() => {
              setIsPadelMatchModalOpen(false)
              setPadelTeams({ team1: null, team2: null })
            }}
            team1={padelTeams.team1}
            team2={padelTeams.team2}
            users={users}
            onMatchSaved={handlePadelMatchSaved}
          />
        )}
      </div>
    </div>
  )
}

export default App
