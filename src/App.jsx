import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Plus, Trophy, BarChart2, Users, Calendar, Swords, Settings, Zap } from 'lucide-react'
import { PingPongIcon, TennisIcon } from './components/Icons'
import { supabase } from './supabaseClient'
import { recalculatePlayerStats } from './utils'
import {
  ADMIN_SESSION_STORAGE_KEY,
  createAdminSession,
  revokeAdminSession,
  validateAdminSession,
} from './adminSession'
import AppShell, { PageHeader, Button } from './components/layout/AppShell'
import PlayersView from './components/PlayersView'
import Leaderboard from './components/Leaderboard'
import PlayerStats from './components/PlayerStats'
import Matches from './components/Matches'
import AddUserModal from './components/modals/AddUserModal'
import EditUserModal from './components/modals/EditUserModal'
import EditMatchModal from './components/modals/EditMatchModal'
import PlayerSelectionModal from './components/modals/PlayerSelectionModal'
import MatchModal from './components/modals/MatchModal'
import MatchGeneratorModal from './components/modals/MatchGeneratorModal'
import LiveMatchModal from './components/modals/LiveMatchModal'
import LoginModal from './components/modals/LoginModal'
import DebuffSettings from './components/DebuffSettings'
import DiscordSettings from './components/DiscordSettings'

// Padel imports
import PadelLeaderboard from './components/PadelLeaderboard'
import PadelPlayerStats from './components/PadelPlayerStats'
import PadelMatches from './components/PadelMatches'
import PadelPlayerSelectionModal from './components/modals/PadelPlayerSelectionModal'
import PadelMatchModal from './components/modals/PadelMatchModal'
import PadelEditMatchModal from './components/modals/PadelEditMatchModal'
import PadelLiveMatchModal from './components/modals/PadelLiveMatchModal'
import TennisLeaderboard from './components/TennisLeaderboard'
import TennisPlayerStats from './components/TennisPlayerStats'
import TennisMatches from './components/TennisMatches'
import TennisMatchModal from './components/modals/TennisMatchModal'
import TennisEditMatchModal from './components/modals/TennisEditMatchModal'
import TennisLiveMatchModal from './components/modals/TennisLiveMatchModal'
import Tournament from './components/tournament/Tournament'
import { useToast } from './contexts/useToast'

const SPORTS = [
  { id: 'pingpong', label: 'Ping Pong', shortLabel: 'Ping Pong', Icon: PingPongIcon, tagline: 'Track your garage glory.' },
  { id: 'padel', label: 'Padel', shortLabel: 'Padel', Icon: TennisIcon, tagline: 'Track your doubles domination.' },
  { id: 'tennis', label: 'Tennis', shortLabel: 'Tennis', Icon: TennisIcon, tagline: 'Track your court command.' },
]

const NAV_ITEMS = [
  { id: 'grid', label: 'Players', Icon: Users },
  { id: 'leaderboard', label: 'Leaderboard', shortLabel: 'Ranks', Icon: Trophy },
  { id: 'stats', label: 'Stats', Icon: BarChart2 },
  { id: 'matches', label: 'Matches', Icon: Calendar },
  { id: 'tournament', label: 'Tournament', shortLabel: 'Cup', Icon: Swords, sports: ['pingpong'] },
  { id: 'settings', label: 'Settings', Icon: Settings, adminOnly: true },
]

// --- Main App ---

function App() {
  const { showToast } = useToast()

  const [users, setUsers] = useState([])
  const [matches, setMatches] = useState([])
  const [padelMatches, setPadelMatches] = useState([])
  const [padelStats, setPadelStats] = useState([])
  const [tennisMatches, setTennisMatches] = useState([])
  const [tennisStats, setTennisStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [migrating, setMigrating] = useState(false)
  const migrationAttempted = useRef(false)

  // Sport Switcher State
  const [activeSport, setActiveSport] = useState(() => {
    return localStorage.getItem('activeSport') || 'pingpong'
  })

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  // Admin State
  const [adminToken, setAdminToken] = useState(null)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const isAdmin = Boolean(adminToken)

  const handleAdminLogin = async (pin) => {
    const session = await createAdminSession(supabase, pin)
    setAdminToken(session.token)
    localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session))
  }

  const handleAdminLogout = async () => {
    const tokenToRevoke = adminToken
    setAdminToken(null)
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
    localStorage.removeItem('isAdmin')

    try {
      await revokeAdminSession(supabase, tokenToRevoke)
    } catch (error) {
      console.error('Failed to revoke admin session:', error)
    }
  }

  // Navigation State
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'grid'
  }) // 'grid', 'leaderboard', 'stats', 'matches', 'tournament'
  const [statsPlayerId, setStatsPlayerId] = useState(null)

  // Modal States — Ping Pong
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isPlayerSelectionOpen, setIsPlayerSelectionOpen] = useState(false)
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false)
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false)
  const [selectedPlayers, setSelectedPlayers] = useState([null, null])
  const [isLiveMatchOpen, setIsLiveMatchOpen] = useState(false)
  const [liveMatchPlayers, setLiveMatchPlayers] = useState([null, null])
  const [isLiveMatchFromGenerator, setIsLiveMatchFromGenerator] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editingMatch, setEditingMatch] = useState(null)

  // Modal States — Padel
  const [isPadelSelectionOpen, setIsPadelSelectionOpen] = useState(false)
  const [padelSelectionMode, setPadelSelectionMode] = useState('record')
  const [isPadelMatchModalOpen, setIsPadelMatchModalOpen] = useState(false)
  const [padelTeams, setPadelTeams] = useState({ team1: null, team2: null })
  const [editingPadelMatch, setEditingPadelMatch] = useState(null)
  const [isPadelLiveMatchOpen, setIsPadelLiveMatchOpen] = useState(false)
  const [padelLiveMatchTeams, setPadelLiveMatchTeams] = useState({ team1: null, team2: null })

  // Modal States — Tennis
  const [isTennisSelectionOpen, setIsTennisSelectionOpen] = useState(false)
  const [isTennisMatchModalOpen, setIsTennisMatchModalOpen] = useState(false)
  const [isTennisLiveMatchOpen, setIsTennisLiveMatchOpen] = useState(false)
  const [tennisPlayers, setTennisPlayers] = useState([null, null])
  const [tennisLivePlayers, setTennisLivePlayers] = useState([null, null])
  const [editingTennisMatch, setEditingTennisMatch] = useState(null)

  // Persist sport selection and expose it to CSS for the accent colour
  useEffect(() => {
    localStorage.setItem('activeSport', activeSport)
    document.documentElement.dataset.sport = activeSport
  }, [activeSport])

  // Persist active tab
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab)
  }, [activeTab])

  useEffect(() => {
    let cancelled = false
    const restoreAdminSession = async () => {
      const storedSession = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY)
      localStorage.removeItem('isAdmin')
      if (!storedSession) return

      try {
        const session = JSON.parse(storedSession)
        const isValid = await validateAdminSession(supabase, session?.token)
        if (cancelled) return

        if (isValid) {
          setAdminToken(session.token)
        } else {
          localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
        }
      } catch (error) {
        console.error('Failed to restore admin session:', error)
        localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
      }
    }

    restoreAdminSession()
    return () => {
      cancelled = true
    }
  }, [])

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

    // Fetch all data in parallel for ~3x faster load
    const [
      { data: userData, error: userError },
      { data: matchData, error: matchError },
      { data: padelMatchData, error: padelMatchError },
      { data: padelStatsData, error: padelStatsError },
      { data: tennisMatchData, error: tennisMatchError },
      { data: tennisStatsData, error: tennisStatsError },
    ] = await Promise.all([
      supabase.from('users').select('*').order('total_wins', { ascending: false }),
      supabase.from('matches').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('padel_matches').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('padel_stats').select('*'),
      supabase.from('tennis_matches').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('tennis_stats').select('*'),
    ])

    if (userError) console.error('Error fetching users:', userError)
    else setUsers(userData || [])

    if (matchError) console.error('Error fetching matches:', matchError)
    else setMatches(matchData || [])

    if (padelMatchError) console.error('Error fetching padel matches:', padelMatchError)
    else setPadelMatches(padelMatchData || [])

    if (padelStatsError) console.error('Error fetching padel stats:', padelStatsError)
    else setPadelStats(padelStatsData || [])

    if (tennisMatchError) console.error('Error fetching tennis matches:', tennisMatchError)
    else setTennisMatches(tennisMatchData || [])

    if (tennisStatsError) console.error('Error fetching tennis stats:', tennisStatsError)
    else setTennisStats(tennisStatsData || [])

    setLoading(false)
  }, [])

  useEffect(() => {
    const initialFetchTimer = setTimeout(fetchData, 0)

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tennis_matches' }, (payload) => {
        console.log('Tennis match change received!', payload)
        debouncedFetch()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tennis_stats' }, (payload) => {
        console.log('Tennis stats change received!', payload)
        debouncedFetch()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
      clearTimeout(initialFetchTimer)
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
        queueMicrotask(() => {
          setMigrating(true)
          recalculatePlayerStats()
            .then(() => {
              console.log('Recalculation complete.')
              fetchData()
            })
            .catch(err => {
              console.error('Migration failed:', err)
              if (err.message && err.message.includes('column')) {
                showToast('Automatic update failed: Missing database columns. Please run the SQL migration.', 'error')
              }
            })
            .finally(() => setMigrating(false))
          })
      }
    }
  }, [loading, matches.length, users, fetchData, showToast])

  const handleUserClick = (user) => {
    setStatsPlayerId(user.id)
    setActiveTab('stats')
  }

  const handlePlayersSelected = (player1, player2) => {
    setSelectedPlayers([player1, player2])
    setIsPlayerSelectionOpen(false)
    setIsMatchModalOpen(true)
  }

  const handleMatchGenerated = (player1, player2) => {
    setIsLiveMatchFromGenerator(true)
    setLiveMatchPlayers([player1, player2])
    setIsGeneratorOpen(false)
    setIsLiveMatchOpen(true)
  }

  const handleLiveMatchFromSelection = (player1, player2) => {
    setIsLiveMatchFromGenerator(false)
    setLiveMatchPlayers([player1, player2])
    setIsPlayerSelectionOpen(false)
    setIsLiveMatchOpen(true)
  }

  const handleMatchSaved = () => {
    setIsMatchModalOpen(false)
    setSelectedPlayers([null, null])
    fetchData()
  }

  const handleLiveMatchSaved = () => {
    setIsLiveMatchOpen(false)
    setLiveMatchPlayers([null, null])
    fetchData()
    if (isLiveMatchFromGenerator) {
      setIsLiveMatchFromGenerator(false)
      setIsGeneratorOpen(true)
    }
  }

  // Padel handlers
  const handlePadelTeamsSelected = (team1, team2) => {
    setPadelTeams({ team1, team2 })
    setIsPadelSelectionOpen(false)
    setIsPadelMatchModalOpen(true)
  }

  const handlePadelLiveTeamsSelected = (team1, team2) => {
    setPadelLiveMatchTeams({ team1, team2 })
    setIsPadelSelectionOpen(false)
    setIsPadelLiveMatchOpen(true)
  }

  const handlePadelMatchSaved = () => {
    setIsPadelMatchModalOpen(false)
    setPadelTeams({ team1: null, team2: null })
    fetchData()
  }

  const handlePadelLiveMatchSaved = () => {
    setIsPadelLiveMatchOpen(false)
    setPadelLiveMatchTeams({ team1: null, team2: null })
    fetchData()
  }

  // Tennis handlers
  const handleTennisPlayersSelected = (player1, player2) => {
    setTennisPlayers([player1, player2])
    setIsTennisSelectionOpen(false)
    setIsTennisMatchModalOpen(true)
  }

  const handleTennisLiveMatchSelected = (player1, player2) => {
    setTennisLivePlayers([player1, player2])
    setIsTennisSelectionOpen(false)
    setIsTennisLiveMatchOpen(true)
  }

  const handleTennisMatchSaved = () => {
    setIsTennisMatchModalOpen(false)
    setTennisPlayers([null, null])
    fetchData()
  }

  const handleTennisLiveMatchSaved = () => {
    setIsTennisLiveMatchOpen(false)
    setTennisLivePlayers([null, null])
    fetchData()
  }

  const isPingPong = activeSport === 'pingpong'
  const isPadel = activeSport === 'padel'
  const sport = SPORTS.find(s => s.id === activeSport) || SPORTS[0]

  const navItems = NAV_ITEMS.filter(item =>
    (!item.sports || item.sports.includes(activeSport)) && (!item.adminOnly || isAdmin)
  )
  // Fall back to Players when the stored tab isn't available (e.g. Tournament outside ping pong).
  const currentTab = navItems.some(item => item.id === activeTab) ? activeTab : 'grid'
  const currentNav = navItems.find(item => item.id === currentTab)

  useEffect(() => {
    document.title = `${sport.label} · Sport Tracker`
  }, [sport.label])

  // Build a padel stats lookup map for UserCards
  const padelStatsMap = useMemo(() => {
    const map = {}
      ; (padelStats || []).forEach(s => { map[s.user_id] = s })
    return map
  }, [padelStats])

  const tennisStatsMap = useMemo(() => {
    const map = {}
      ; (tennisStats || []).forEach(s => { map[s.user_id] = s })
    return map
  }, [tennisStats])

  const openLiveMatch = () => {
    if (isPingPong) {
      setIsGeneratorOpen(true)
    } else if (isPadel) {
      setPadelSelectionMode('live')
      setIsPadelSelectionOpen(true)
    } else {
      setIsTennisSelectionOpen(true)
    }
  }

  const openRecordMatch = () => {
    if (isPingPong) {
      setIsPlayerSelectionOpen(true)
    } else if (isPadel) {
      setPadelSelectionMode('record')
      setIsPadelSelectionOpen(true)
    } else {
      setIsTennisSelectionOpen(true)
    }
  }

  const pageActions = currentTab === 'grid' && users.length > 0 ? (
    <Button icon={Plus} onClick={() => setIsAddModalOpen(true)}>Add Player</Button>
  ) : currentTab === 'matches' && isAdmin ? (
    <>
      <Button variant="live" icon={Zap} onClick={openLiveMatch}>Live Match</Button>
      <Button variant="primary" icon={Plus} onClick={openRecordMatch}>Record Match</Button>
    </>
  ) : null

  return (
    <AppShell
      sports={SPORTS}
      activeSport={activeSport}
      onSportChange={setActiveSport}
      navItems={navItems}
      activeTab={currentTab}
      onTabChange={setActiveTab}
      darkMode={darkMode}
      onToggleDarkMode={() => setDarkMode(!darkMode)}
      isAdmin={isAdmin}
      onAdminClick={() => isAdmin ? handleAdminLogout() : setIsLoginModalOpen(true)}
    >
      <PageHeader
        title={currentNav.label}
        subtitle={
          <>
            {sport.label} · {sport.tagline}
            {migrating && (
              <span className="ml-2 inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                <Settings size={14} className="animate-spin" /> Updating historical stats…
              </span>
            )}
          </>
        }
      >
        {pageActions}
      </PageHeader>

      {currentTab === 'grid' && (
        <PlayersView
          users={users}
          loading={loading}
          sport={activeSport}
          padelStatsMap={padelStatsMap}
          tennisStatsMap={tennisStatsMap}
          isAdmin={isAdmin}
          onUserClick={handleUserClick}
          onEditUser={setEditingUser}
          onAddPlayer={() => setIsAddModalOpen(true)}
        />
      )}

      {currentTab === 'leaderboard' && (
        isPingPong ? (
          <Leaderboard users={users} matches={matches} isAdmin={isAdmin} />
        ) : isPadel ? (
          <PadelLeaderboard users={users} matches={padelMatches} padelStats={padelStats} isAdmin={isAdmin} />
        ) : (
          <TennisLeaderboard users={users} matches={tennisMatches} tennisStats={tennisStats} isAdmin={isAdmin} />
        )
      )}

      {currentTab === 'stats' && (
        isPingPong ? (
          <PlayerStats users={users} matches={matches} initialPlayerId={statsPlayerId} />
        ) : isPadel ? (
          <PadelPlayerStats users={users} matches={padelMatches} padelStats={padelStats} initialPlayerId={statsPlayerId} />
        ) : (
          <TennisPlayerStats users={users} matches={tennisMatches} tennisStats={tennisStats} initialPlayerId={statsPlayerId} />
        )
      )}

      {currentTab === 'matches' && (
        isPingPong ? (
          <Matches
            matches={matches}
            users={users}
            onEditMatch={setEditingMatch}
            onMatchDeleted={fetchData}
            onGenerateMatch={() => setIsGeneratorOpen(true)}
            isAdmin={isAdmin}
            adminToken={adminToken}
          />
        ) : isPadel ? (
          <PadelMatches
            matches={padelMatches}
            users={users}
            padelStats={padelStats}
            onEditMatch={setEditingPadelMatch}
            onMatchDeleted={fetchData}
            isAdmin={isAdmin}
            adminToken={adminToken}
          />
        ) : (
          <TennisMatches
            matches={tennisMatches}
            users={users}
            tennisStats={tennisStats}
            onEditMatch={setEditingTennisMatch}
            onMatchDeleted={fetchData}
            isAdmin={isAdmin}
            adminToken={adminToken}
          />
        )
      )}

      {currentTab === 'tournament' && (
        <Tournament
          users={users}
          matches={matches}
          fetchData={fetchData}
          isAdmin={isAdmin}
          adminToken={adminToken}
        />
      )}

      {currentTab === 'settings' && (
        <div className="space-y-6">
          <DebuffSettings isAdmin={isAdmin} />
          <DiscordSettings />
        </div>
      )}

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
        adminToken={adminToken}
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
        onLiveMatchSelected={handleLiveMatchFromSelection}
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
          adminToken={adminToken}
        />
      )}

      {liveMatchPlayers[0] && liveMatchPlayers[1] && (
        <LiveMatchModal
          isOpen={isLiveMatchOpen}
          onClose={() => {
            setIsLiveMatchOpen(false)
            setLiveMatchPlayers([null, null])
          }}
          player1={liveMatchPlayers[0]}
          player2={liveMatchPlayers[1]}
          onMatchSaved={handleLiveMatchSaved}
          matches={matches}
          adminToken={adminToken}
        />
      )}

      {/* Padel Modals */}
      <PadelPlayerSelectionModal
        isOpen={isPadelSelectionOpen}
        onClose={() => setIsPadelSelectionOpen(false)}
        users={users}
        mode={padelSelectionMode}
        onTeamsSelected={handlePadelTeamsSelected}
        onLiveTeamsSelected={handlePadelLiveTeamsSelected}
        padelStats={padelStats}
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
          adminToken={adminToken}
        />
      )}

      {padelLiveMatchTeams.team1 && padelLiveMatchTeams.team2 && (
        <PadelLiveMatchModal
          isOpen={isPadelLiveMatchOpen}
          onClose={() => {
            setIsPadelLiveMatchOpen(false)
            setPadelLiveMatchTeams({ team1: null, team2: null })
          }}
          team1={padelLiveMatchTeams.team1}
          team2={padelLiveMatchTeams.team2}
          onMatchSaved={handlePadelLiveMatchSaved}
          padelStats={padelStats}
          adminToken={adminToken}
        />
      )}

      {/* Tennis Modals */}
      <PlayerSelectionModal
        isOpen={isTennisSelectionOpen}
        onClose={() => setIsTennisSelectionOpen(false)}
        users={users}
        onPlayersSelected={handleTennisPlayersSelected}
        onLiveMatchSelected={handleTennisLiveMatchSelected}
        sport="tennis"
        sportStatsMap={tennisStatsMap}
        title="Select Players for Tennis Match"
        accent="emerald"
      />

      <TennisEditMatchModal
        isOpen={!!editingTennisMatch}
        match={editingTennisMatch}
        onClose={() => setEditingTennisMatch(null)}
        onMatchUpdated={fetchData}
        users={users}
      />

      {tennisPlayers[0] && tennisPlayers[1] && (
        <TennisMatchModal
          isOpen={isTennisMatchModalOpen}
          onClose={() => {
            setIsTennisMatchModalOpen(false)
            setTennisPlayers([null, null])
          }}
          player1={tennisPlayers[0]}
          player2={tennisPlayers[1]}
          onMatchSaved={handleTennisMatchSaved}
          adminToken={adminToken}
        />
      )}

      {tennisLivePlayers[0] && tennisLivePlayers[1] && (
        <TennisLiveMatchModal
          isOpen={isTennisLiveMatchOpen}
          onClose={() => {
            setIsTennisLiveMatchOpen(false)
            setTennisLivePlayers([null, null])
          }}
          player1={tennisLivePlayers[0]}
          player2={tennisLivePlayers[1]}
          onMatchSaved={handleTennisLiveMatchSaved}
          adminToken={adminToken}
        />
      )}
    </AppShell>
  )
}

export default App
