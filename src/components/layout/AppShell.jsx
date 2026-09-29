import React from 'react'
import { Lock, Unlock, Moon, Sun } from 'lucide-react'

const cx = (...classes) => classes.filter(Boolean).join(' ')

const SportSwitcherList = ({ sports, activeSport, onSportChange }) => (
    <div className="space-y-0.5">
        {sports.map((item) => {
            const { id, label, Icon } = item
            const active = id === activeSport
            return (
                <button
                    key={id}
                    onClick={() => onSportChange(id)}
                    aria-pressed={active}
                    className={cx(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                        active
                            ? 'bg-gray-100 text-gray-900 font-semibold dark:bg-gray-800 dark:text-white'
                            : 'text-gray-600 hover:bg-gray-100/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100'
                    )}
                >
                    <Icon size={18} />
                    <span className="flex-1 text-left">{label}</span>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                </button>
            )
        })}
    </div>
)

const SectionLabel = ({ children }) => (
    <div className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {children}
    </div>
)

const Sidebar = ({ sports, activeSport, onSportChange, navItems, activeTab, onTabChange, darkMode, onToggleDarkMode, isAdmin, onAdminClick }) => {
    const sport = sports.find(s => s.id === activeSport)
    const SportIcon = sport.Icon

    return (
        <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100 dark:border-gray-800/80">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-accent/10 ring-1 ring-accent/20">
                    <SportIcon size={20} />
                </div>
                <div className="leading-tight">
                    <div className="text-sm font-bold tracking-tight text-gray-900 dark:text-white">Sport Tracker</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{sport.label}</div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
                <div>
                    <SectionLabel>Sport</SectionLabel>
                    <SportSwitcherList sports={sports} activeSport={activeSport} onSportChange={onSportChange} />
                </div>

                <nav>
                    <SectionLabel>Menu</SectionLabel>
                    <div className="space-y-0.5">
                        {navItems.map((item) => {
                            const { id, label, Icon } = item
                            const active = id === activeTab
                            return (
                                <button
                                    key={id}
                                    onClick={() => onTabChange(id)}
                                    aria-current={active ? 'page' : undefined}
                                    className={cx(
                                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                                        active
                                            ? 'bg-accent/10 text-accent-fg font-semibold'
                                            : 'text-gray-600 hover:bg-gray-100/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100'
                                    )}
                                >
                                    <Icon size={18} className={active ? 'text-accent-fg' : 'text-gray-400 dark:text-gray-500'} />
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                </nav>
            </div>

            <div className="p-3 border-t border-gray-100 dark:border-gray-800/80 space-y-0.5">
                <button
                    onClick={onToggleDarkMode}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100 transition-colors"
                >
                    {darkMode ? <Sun size={18} className="text-gray-400 dark:text-gray-500" /> : <Moon size={18} className="text-gray-400" />}
                    {darkMode ? 'Light mode' : 'Dark mode'}
                </button>
                <button
                    onClick={onAdminClick}
                    title={isAdmin ? 'Signed in as admin. Click to sign out.' : 'Admin login'}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100 transition-colors"
                >
                    {isAdmin
                        ? <Unlock size={18} className="text-green-600 dark:text-green-400" />
                        : <Lock size={18} className="text-gray-400 dark:text-gray-500" />}
                    <span className="flex-1 text-left">{isAdmin ? 'Admin' : 'Admin login'}</span>
                    {isAdmin && <span className="text-xs text-gray-400 dark:text-gray-500">Sign out</span>}
                </button>
            </div>
        </aside>
    )
}

const IconButton = ({ children, className, ...props }) => (
    <button
        {...props}
        className={cx(
            'flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors',
            className
        )}
    >
        {children}
    </button>
)

const MobileTopBar = ({ sports, activeSport, onSportChange, darkMode, onToggleDarkMode, isAdmin, onAdminClick }) => (
    <header className="lg:hidden sticky top-0 z-30 border-b border-gray-200/80 bg-white/85 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/85">
        <div className="flex items-center gap-2 px-4 h-14">
            <div className="flex flex-1 min-w-0 p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800/80">
                {sports.map((item) => {
                    const { id, shortLabel, Icon } = item
                    const active = id === activeSport
                    return (
                        <button
                            key={id}
                            onClick={() => onSportChange(id)}
                            aria-pressed={active}
                            className={cx(
                                'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all',
                                active
                                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                                    : 'text-gray-500 dark:text-gray-400'
                            )}
                        >
                            <Icon size={14} className="hidden min-[400px]:block" />
                            {shortLabel}
                        </button>
                    )
                })}
            </div>
            <IconButton onClick={onToggleDarkMode} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
            <IconButton
                onClick={onAdminClick}
                aria-label={isAdmin ? 'Sign out of admin' : 'Admin login'}
                className={isAdmin ? 'text-green-600 dark:text-green-400' : ''}
            >
                {isAdmin ? <Unlock size={18} /> : <Lock size={18} />}
            </IconButton>
        </div>
    </header>
)

const BottomNav = ({ navItems, activeTab, onTabChange }) => (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-gray-200/80 bg-white/90 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/90 pb-safe">
        <div className="flex">
            {navItems.map((item) => {
                const { id, label, shortLabel, Icon } = item
                const active = id === activeTab
                return (
                    <button
                        key={id}
                        onClick={() => onTabChange(id)}
                        aria-current={active ? 'page' : undefined}
                        aria-label={label}
                        className={cx(
                            'flex-1 min-w-0 flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10px] font-medium transition-colors',
                            active ? 'text-accent-fg' : 'text-gray-500 dark:text-gray-400'
                        )}
                    >
                        <span className={cx('flex items-center justify-center w-10 h-6 rounded-full transition-colors', active && 'bg-accent/10')}>
                            <Icon size={18} />
                        </span>
                        <span className="truncate max-w-full">{shortLabel || label}</span>
                    </button>
                )
            })}
        </div>
    </nav>
)

export const PageHeader = ({ title, subtitle, children }) => (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2 shrink-0">{children}</div>}
    </div>
)

export const Button = ({ variant = 'secondary', icon: Icon, children, className, ...props }) => {
    const variants = {
        primary: 'bg-accent text-white hover:bg-accent-strong shadow-sm',
        secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700',
        live: 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100',
    }
    return (
        <button
            {...props}
            className={cx(
                'inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                variants[variant],
                className
            )}
        >
            {Icon && <Icon size={16} />}
            {children}
        </button>
    )
}

const AppShell = ({ children, ...props }) => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <Sidebar {...props} />
        <MobileTopBar {...props} />
        <div className="lg:pl-64">
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-6 lg:pt-10 pb-28 lg:pb-12">
                {children}
            </main>
        </div>
        <BottomNav {...props} />
    </div>
)

export default AppShell
