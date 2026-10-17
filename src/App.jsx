import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { Plus, Trophy, BarChart2, Users, Calendar, Swords, Settings, Zap } from 'lucide-react'
import { PingPongIcon, PadelIcon, TennisIcon } from './components/Icons'
import { supabase } from './supabaseClient'
import { filterSeasonMatches, getSeasonUsers } from './seasonUtils'
import {
  ADMIN_SESSION_STORAGE_KEY,
  createAdminSession,
  revokeAdminSession,
  validateAdminSession,
} from './adminSession'
import { describeRecordedMatch, onMatchRecorded } from './matchPersistence'
import { useAppData } from './useAppData'
import AppShell, { PageHeader, Button, Spinner } from './components/layout/AppShell'
import PlayersView from './components/PlayersView'
import Leaderboard from './components/Leaderboard'
import Matches from './components/Matches'
import AddUserModal from './components/modals/AddUserModal'
import EditUserModal from './components/modals/EditUserModal'
import EditMatchModal from './components/modals/EditMatchModal'
import PlayerSelectionModal from './components/modals/PlayerSelectionModal'
import MatchModal from './components/modals/MatchModal'
import MatchGeneratorModal from './components/modals/MatchGeneratorModal'
import LoginModal from './components/modals/LoginModal'

// Padel imports
import PadelLeaderboard from './components/PadelLeaderboard'
import PadelMatches from './components/PadelMatches'
import PadelPlayerSelectionModal from './components/modals/PadelPlayerSelectionModal'
import PadelMatchModal from './components/modals/PadelMatchModal'
import PadelEditMatchModal from './components/modals/PadelEditMatchModal'
import TennisLeaderboard from './components/TennisLeaderboard'
import TennisMatches from './components/TennisMatches'
import TennisMatchModal from './components/modals/TennisMatchModal'
import TennisEditMatchModal from './components/modals/TennisEditMatchModal'
import { useToast } from './contexts/useToast'

// Charts (recharts), tournaments, settings and live scoring load on demand so
// the first paint only needs the players, rankings and match lists.
const loadPlayerStats = () => import('./components/PlayerStats')
const loadPadelPlayerStats = () => import('./components/PadelPlayerStats')
const loadTennisPlayerStats = () => import('./components/TennisPlayerStats')
const loadTournament = () => import('./components/tournament/Tournament')
const loadDebuffSettings = () => import('./components/DebuffSettings')
const loadDiscordSettings = () => import('./components/DiscordSettings')
const loadLiveMatchModal = () => import('./components/modals/LiveMatchModal')
const loadPadelLiveMatchModal = () => import('./components/modals/PadelLiveMatchModal')
const loadTennisLiveMatchModal = () => import('./components/modals/TennisLiveMatchModal')
const DEFERRED_MODULES = [
  loadPlayerStats, loadPadelPlayerStats, loadTennisPlayerStats, loadTournament, loadDebuffSettings,
  loadDiscordSettings, loadLiveMatchModal, loadPadelLiveMatchModal, loadTennisLiveMatchModal,
]

const PlayerStats = lazy(loadPlayerStats)
const PadelPlayerStats = lazy(loadPadelPlayerStats)
const TennisPlayerStats = lazy(loadTennisPlayerStats)
const Tournament = lazy(loadTournament)
const DebuffSettings = lazy(loadDebuffSettings)
const DiscordSettings = lazy(loadDiscordSettings)
const LiveMatchModal = lazy(loadLiveMatchModal)
const PadelLiveMatchModal = lazy(loadPadelLiveMatchModal)
const TennisLiveMatchModal = lazy(loadTennisLiveMatchModal)

const SPORTS = [
  { id: 'pingpong', label: 'Ping Pong', shortLabel: 'Ping Pong', Icon: PingPongIcon, tagline: 'Track your garage glory.' },
  { id: 'padel', label: 'Padel', shortLabel: 'Padel', Icon: PadelIcon, tagline: 'Track your doubles domination.' },
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
  const {
    users,
    matches,
    padelMatches,
    padelStats,
    tennisMatches,
    tennisStats,
    seasonData: { seasons, snapshots: seasonSnapshots },
    loaded,
    loading,
    historyFailed,
    refresh,
    refreshSport,
  } = useAppData(showToast)
  const [seasonScope, setSeasonScope] = useState('current')

  const refreshUsers = useCallback(() => refresh(['users']), [refresh])
  const refreshPingPong = useCallback(() => refreshSport('pingpong'), [refreshSport])
  const refreshPadel = useCallback(() => refreshSport('padel'), [refreshSport])
  const refreshTennis = useCallback(() => refreshSport('tennis'), [refreshSport])

  // Sport Switcher State
  const [activeSport, setActiveSport] = useState(() => {
    return localStorage.getItem('activeSport') || 'pingpong'
  })

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light')

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

      let session
      try {
        session = JSON.parse(storedSession)
      } catch {
        localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
        return
      }

      try {
        const isValid = await validateAdminSession(supabase, session?.token)
        if (cancelled) return

        if (isValid) {
          setAdminToken(session.token)
        } else {
          localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
        }
      } catch (error) {
        // A failed request (e.g. a flaky phone connection) does not mean the
        // session expired; keep it so the next load can validate it again.
        console.error('Failed to restore admin session:', error)
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
    // Match the mobile browser bar to the app's top bar.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', darkMode ? '#0c0c0e' : '#ffffff')
  }, [darkMode])

  const usersById = useMemo(() => Object.fromEntries(users.map(user => [user.id, user])), [users])

  // One confirmation for every save, wherever it started (including brackets).
  useEffect(() => onMatchRecorded(result => {
    showToast(describeRecordedMatch(result, usersById), 'success')
  }), [showToast, usersById])

  // Fetch the deferred screens once the first data is in, so switching tabs stays instant.
  useEffect(() => {
    if (loading) return
    const prefetch = () => DEFERRED_MODULES.forEach(load => load().catch(() => {}))
    if (window.requestIdleCallback) {
      const handle = window.requestIdleCallback(prefetch, { timeout: 4000 })
      return () => window.cancelIdleCallback(handle)
    }
    const timer = setTimeout(prefetch, 1500)
    return () => clearTimeout(timer)
  }, [loading])

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

  // Saved rows are merged into the cached history by useAppData; handlers only close modals.
  const handleMatchSaved = () => {
    setIsMatchModalOpen(false)
    setSelectedPlayers([null, null])
  }

  const handleLiveMatchSaved = () => {
    setIsLiveMatchOpen(false)
    setLiveMatchPlayers([null, null])
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
  }

  const handlePadelLiveMatchSaved = () => {
    setIsPadelLiveMatchOpen(false)
    setPadelLiveMatchTeams({ team1: null, team2: null })
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
  }

  const handleTennisLiveMatchSaved = () => {
    setIsTennisLiveMatchOpen(false)
    setTennisLivePlayers([null, null])
  }

  const activeSeason = seasons.find(s => s.is_active)
  const selectedSeasonId = seasonScope === 'current' ? activeSeason?.id : seasonScope
  const currentMatches = useMemo(() => activeSeason ? filterSeasonMatches(matches, activeSeason.id) : matches, [matches, activeSeason])
  const scopedMatches = useMemo(() => activeSeason ? filterSeasonMatches(matches, selectedSeasonId) : matches, [matches, activeSeason, selectedSeasonId])
  const scopedUsers = useMemo(() => activeSeason ? getSeasonUsers(users, matches, seasonSnapshots, selectedSeasonId, activeSeason.id) : users, [users, matches, seasonSnapshots, selectedSeasonId, activeSeason])
  const canManageSeason = !activeSeason || String(selectedSeasonId) === String(activeSeason.id)

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
      {/* Below lg (bottom-nav layouts) the floating Record button replaces this one. */}
      <Button variant="primary" icon={Plus} onClick={openRecordMatch} className="hidden lg:inline-flex">Record Match</Button>
    </>
  ) : null

  const floatingAction = isAdmin && ['grid', 'leaderboard', 'stats', 'matches'].includes(currentTab)
    ? { icon: Plus, label: 'Record match', onClick: openRecordMatch }
    : null

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
      floatingAction={floatingAction}
    >
      <PageHeader
        title={currentNav.label}
        subtitle={
          <>
            {sport.label} · {sport.tagline}

          </>
        }
      >
        {pageActions}
      </PageHeader>

      {historyFailed && (
        <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          Complete match history could not be loaded. Refresh to retry; statistics may be out of date.
        </div>
      )}

      {isPingPong && activeSeason && ['grid', 'leaderboard', 'stats', 'matches'].includes(currentTab) && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label htmlFor="pingpong-season" className="font-medium text-gray-700 dark:text-gray-200">Stats for</label>
          <select id="pingpong-season" value={seasonScope} onChange={e => setSeasonScope(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="current">{activeSeason.name} (current)</option>
            {seasons.filter(s => !s.is_active).map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            <option value="all">All-time</option>
          </select>
          <p className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">New games count toward {activeSeason.name}. All-time ratings continue across seasons.</p>
        </div>
      )}

      <Suspense fallback={<Spinner />}>
      {currentTab === 'grid' && (
        <PlayersView
          users={isPingPong ? scopedUsers : users}
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
          <Leaderboard key={seasonScope} users={scopedUsers} matches={scopedMatches} isAdmin={isAdmin} />
        ) : isPadel ? (
          <PadelLeaderboard users={users} matches={padelMatches} padelStats={padelStats} isAdmin={isAdmin} />
        ) : (
          <TennisLeaderboard users={users} matches={tennisMatches} tennisStats={tennisStats} isAdmin={isAdmin} />
        )
      )}

      {currentTab === 'stats' && (
        isPingPong ? (
          <PlayerStats key={seasonScope} users={scopedUsers} matches={scopedMatches} initialPlayerId={statsPlayerId} seasonId={selectedSeasonId} />
        ) : isPadel ? (
          <PadelPlayerStats users={users} matches={padelMatches} padelStats={padelStats} initialPlayerId={statsPlayerId} />
        ) : (
          <TennisPlayerStats users={users} matches={tennisMatches} tennisStats={tennisStats} initialPlayerId={statsPlayerId} />
        )
      )}

      {currentTab === 'matches' && (
        isPingPong ? (
          <Matches
            key={seasonScope}
            matches={scopedMatches}
            users={scopedUsers}
            historyLoading={!loaded.matches}
            onEditMatch={setEditingMatch}
            onMatchDeleted={refreshPingPong}
            onGenerateMatch={() => setIsGeneratorOpen(true)}
            isAdmin={isAdmin && canManageSeason}
            adminToken={adminToken}
          />
        ) : isPadel ? (
          <PadelMatches
            matches={padelMatches}
            users={users}
            padelStats={padelStats}
            historyLoading={!loaded.padelMatches}
            onEditMatch={setEditingPadelMatch}
            onMatchDeleted={refreshPadel}
            isAdmin={isAdmin}
            adminToken={adminToken}
          />
        ) : (
          <TennisMatches
            matches={tennisMatches}
            users={users}
            tennisStats={tennisStats}
            historyLoading={!loaded.tennisMatches}
            onEditMatch={setEditingTennisMatch}
            onMatchDeleted={refreshTennis}
            isAdmin={isAdmin}
            adminToken={adminToken}
          />
        )
      )}

      {currentTab === 'tournament' && (
        <Tournament
          users={users}
          matches={currentMatches}
          fetchData={refreshPingPong}
          isAdmin={isAdmin}
          adminToken={adminToken}
        />
      )}

      {currentTab === 'settings' && (
        <div className="space-y-6">
          <DebuffSettings isAdmin={isAdmin} adminToken={adminToken} />
          <DiscordSettings adminToken={adminToken} />
        </div>
      )}
      </Suspense>

      {/* Shared Modals */}
      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onUserAdded={refreshUsers}
      />

      <EditUserModal
        isOpen={!!editingUser}
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onUserUpdated={refreshUsers}
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
        matches={currentMatches}
        onMatchGenerated={handleMatchGenerated}
      />

      <EditMatchModal
        isOpen={!!editingMatch}
        match={editingMatch}
        onClose={() => setEditingMatch(null)}
        onMatchUpdated={refreshPingPong}
        isAdmin={isAdmin}
        adminToken={adminToken}
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
          matches={currentMatches}
          adminToken={adminToken}
        />
      )}

      {liveMatchPlayers[0] && liveMatchPlayers[1] && (
        <Suspense fallback={null}>
          <LiveMatchModal
            isOpen={isLiveMatchOpen}
            onClose={() => {
              setIsLiveMatchOpen(false)
              setLiveMatchPlayers([null, null])
            }}
            player1={liveMatchPlayers[0]}
            player2={liveMatchPlayers[1]}
            onMatchSaved={handleLiveMatchSaved}
            matches={currentMatches}
            adminToken={adminToken}
          />
        </Suspense>
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
        users={users}
        adminToken={adminToken}
        onClose={() => setEditingPadelMatch(null)}
        onMatchUpdated={refreshPadel}
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
        <Suspense fallback={null}>
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
        </Suspense>
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
        adminToken={adminToken}
        onClose={() => setEditingTennisMatch(null)}
        onMatchUpdated={refreshTennis}
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
        <Suspense fallback={null}>
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
        </Suspense>
      )}
    </AppShell>
  )
}

export default App
