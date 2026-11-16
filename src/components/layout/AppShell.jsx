import React, { useState } from 'react'
import { Lock, Unlock, Moon, Sun, Plus, Menu, X, ChevronRight } from 'lucide-react'

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
                    <Icon size={18} className={active ? 'text-accent-fg' : 'text-gray-400 dark:text-gray-500'} />
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

const Sidebar = ({ sports, activeSport, onSportChange, navItems, activeTab, onTabChange, darkMode, onToggleDarkMode, isAdmin, onAdminClick, onPlay }) => {
    const sport = sports.find(s => s.id === activeSport)
    const SportIcon = sport.Icon

    return (
        <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100 dark:border-gray-800/80">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-accent/10 ring-1 ring-accent/20">
                    <SportIcon size={20} className="text-accent-fg" />
                </div>
                <div className="leading-tight">
                    <div className="text-sm font-bold tracking-tight text-gray-900 dark:text-white">Sport Tracker</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{sport.label}</div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
                <button
                    onClick={onPlay}
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-accent text-white text-sm font-semibold shadow-sm hover:bg-accent-strong transition-colors"
                >
                    <Plus size={18} />
                    New match
                </button>
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

// The sport switcher owns the whole bar on phones; theme and admin live under "More".
const MobileTopBar = ({ sports, activeSport, onSportChange }) => (
    <header className="lg:hidden sticky top-0 z-30 border-b border-gray-200/80 bg-white/85 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/85">
        <div className="flex items-center px-4 h-14">
            <div className="flex flex-1 min-w-0 p-0.5 rounded-xl bg-gray-100 dark:bg-gray-800/80">
                {sports.map((item) => {
                    const { id, shortLabel, Icon } = item
                    const active = id === activeSport
                    return (
                        <button
                            key={id}
                            onClick={() => onSportChange(id)}
                            aria-pressed={active}
                            className={cx(
                                'flex-1 flex items-center justify-center gap-1.5 px-2 h-10 rounded-[10px] text-[13px] font-semibold whitespace-nowrap transition-all',
                                active
                                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                                    : 'text-gray-500 dark:text-gray-400'
                            )}
                        >
                            <Icon size={16} className={active ? 'text-accent-fg' : ''} />
                            {shortLabel}
                        </button>
                    )
                })}
            </div>
        </div>
    </header>
)

// Bottom sheet on phones, centred dialog on wider screens.
const Sheet = ({ title, onClose, children }) => (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 animate-fade-in" onClick={onClose}>
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-xl animate-slide-up pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
            <div className="sm:hidden flex justify-center pt-2.5">
                <span className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            </div>
            <div className="flex items-center justify-between pl-5 pr-3 pt-3 sm:pt-4 pb-2">
                <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">{title}</h2>
                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                    <X size={20} />
                </button>
            </div>
            <div className="px-3">{children}</div>
        </div>
    </div>
)

const SheetRow = (row) => {
    const { Icon, label, description, trailing, featured, active, onClick, ...props } = row
    return (
    <button
        {...props}
        onClick={onClick}
        className={cx(
            'w-full flex items-center gap-3.5 px-2 py-2.5 rounded-2xl text-left transition-colors active:bg-gray-100 hover:bg-gray-100/70 dark:active:bg-gray-800 dark:hover:bg-gray-800/60',
            active && 'bg-accent/10'
        )}
    >
        <span className={cx(
            'flex items-center justify-center w-11 h-11 shrink-0 rounded-xl',
            featured
                ? 'bg-accent text-white shadow-sm'
                : active
                    ? 'bg-accent/10 text-accent-fg'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
        )}>
            <Icon size={20} />
        </span>
        <span className="flex-1 min-w-0">
            <span className={cx('block text-[15px] font-semibold', active ? 'text-accent-fg' : 'text-gray-900 dark:text-white')}>{label}</span>
            {description && <span className="block text-[13px] leading-snug text-gray-500 dark:text-gray-400">{description}</span>}
        </span>
        {trailing ?? <ChevronRight size={18} className="shrink-0 text-gray-300 dark:text-gray-600" />}
    </button>
    )
}

// Every way to start a match, one tap away from any screen.
const PlaySheet = ({ sportLabel, actions, isAdmin, onClose }) => (
    <Sheet title={`New ${sportLabel.toLowerCase()} match`} onClose={onClose}>
        <div className="space-y-0.5">
            {actions.map(({ id, label, description, Icon, locked, onClick }, index) => (
                <SheetRow
                    key={id}
                    Icon={Icon}
                    label={label}
                    description={description}
                    featured={index === 0}
                    trailing={locked ? <Lock size={16} className="shrink-0 mr-1 text-gray-400 dark:text-gray-500" /> : undefined}
                    onClick={() => { onClose(); onClick() }}
                />
            ))}
        </div>
        {!isAdmin && (
            <p className="mt-2 px-2 pb-1 text-xs text-gray-500 dark:text-gray-400">
                Saving a match needs the admin PIN. Locked options ask you to sign in first.
            </p>
        )}
    </Sheet>
)

const MoreSheet = ({ items, activeTab, onTabChange, darkMode, onToggleDarkMode, isAdmin, onAdminClick, onClose }) => (
    <Sheet title="More" onClose={onClose}>
        <div className="space-y-0.5">
            {items.map(({ id, label, description, Icon }) => (
                <SheetRow
                    key={id}
                    Icon={Icon}
                    label={label}
                    description={description}
                    active={id === activeTab}
                    aria-current={id === activeTab ? 'page' : undefined}
                    onClick={() => { onClose(); onTabChange(id) }}
                />
            ))}
        </div>
        <div className="my-2 mx-2 border-t border-gray-100 dark:border-gray-800" />
        <div className="space-y-0.5">
            <SheetRow
                Icon={darkMode ? Sun : Moon}
                label={darkMode ? 'Light mode' : 'Dark mode'}
                trailing={<span />}
                onClick={onToggleDarkMode}
            />
            <SheetRow
                Icon={isAdmin ? Unlock : Lock}
                label={isAdmin ? 'Sign out of admin' : 'Admin login'}
                description={isAdmin ? 'You can record and edit matches' : 'Needed to record and edit matches'}
                trailing={isAdmin ? <span className="shrink-0 w-2 h-2 mr-2 rounded-full bg-green-500" /> : undefined}
                onClick={() => { onClose(); onAdminClick() }}
            />
        </div>
    </Sheet>
)

const NavTab = (tab) => {
    const { label, Icon, active, onClick, ...props } = tab
    return (
    <button
        {...props}
        onClick={onClick}
        className={cx(
            'flex-1 min-w-0 flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium transition-colors',
            active ? 'text-accent-fg' : 'text-gray-500 dark:text-gray-400'
        )}
    >
        <span className={cx('flex items-center justify-center w-12 h-7 rounded-full transition-colors', active && 'bg-accent/10')}>
            <Icon size={20} />
        </span>
        <span className="truncate max-w-full">{label}</span>
    </button>
    )
}

// Two tabs either side of a raised Play button; everything else sits under "More".
const BottomNav = ({ primaryItems, moreActive, activeTab, onTabChange, onPlay, onMore }) => {
    const half = Math.ceil(primaryItems.length / 2)
    const tab = ({ id, label, shortLabel, Icon }) => (
        <NavTab
            key={id}
            label={shortLabel || label}
            Icon={Icon}
            active={id === activeTab}
            onClick={() => onTabChange(id)}
            aria-current={id === activeTab ? 'page' : undefined}
            aria-label={label}
        />
    )
    return (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-gray-200/80 bg-white/95 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95 pb-safe">
            <div className="flex items-end max-w-xl mx-auto">
                {primaryItems.slice(0, half).map(tab)}
                <button
                    onClick={onPlay}
                    aria-label="New match"
                    className="group flex-1 min-w-0 flex flex-col items-center gap-0.5 pb-1.5 text-[11px] font-semibold text-accent-fg"
                >
                    <span className="flex items-center justify-center w-14 h-14 -mt-5 short:w-11 short:h-11 short:-mt-2 rounded-full bg-accent text-white shadow-lg shadow-black/25 ring-4 ring-white dark:ring-gray-950 group-active:scale-95 transition-transform">
                        <Plus size={26} strokeWidth={2.5} />
                    </span>
                    <span>Play</span>
                </button>
                {primaryItems.slice(half).map(tab)}
                <NavTab label="More" Icon={Menu} active={moreActive} onClick={onMore} aria-haspopup="dialog" />
            </div>
        </nav>
    )
}

// Actions share the title row on phones too, so they don't push content down a full row.
export const PageHeader = ({ title, subtitle, children }) => (
    <div className="flex flex-wrap items-center sm:items-end justify-between gap-x-4 gap-y-3 mb-5 sm:mb-6">
        <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h1>
            {/* The mobile top bar already names the sport; keep the first screen for content. */}
            {subtitle && <p className="mt-1 hidden sm:block text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
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

export const Spinner = ({ className }) => (
    <div className={cx('flex justify-center py-16', className)} role="status" aria-label="Loading">
        <div className="h-6 w-6 rounded-full border-2 border-gray-300 border-t-accent animate-spin dark:border-gray-600 dark:border-t-accent" />
    </div>
)

// Long histories render in pages; rendering thousands of rows made every update slow.
export const LIST_PAGE_SIZE = 50

export const ShowMore = ({ shown, total, onShowMore }) => total > shown && (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
        <span>Showing {shown} of {total} matches</span>
        <Button onClick={onShowMore}>Show {Math.min(LIST_PAGE_SIZE, total - shown)} more</Button>
    </div>
)

const AppShell = ({ children, playActions, ...props }) => {
    const [sheet, setSheet] = useState(null) // 'play' | 'more'
    const { navItems, activeTab, sports, activeSport } = props
    const primaryItems = navItems.filter(item => item.primary)
    const moreItems = navItems.filter(item => !item.primary)
    const sport = sports.find(s => s.id === activeSport)
    const closeSheet = () => setSheet(null)

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            <Sidebar {...props} onPlay={() => setSheet('play')} />
            <MobileTopBar {...props} />
            <div className="lg:pl-64">
                <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-5 lg:pt-10 pb-28 lg:pb-12">
                    {children}
                </main>
            </div>
            <BottomNav
                primaryItems={primaryItems}
                moreActive={moreItems.some(item => item.id === activeTab)}
                activeTab={activeTab}
                onTabChange={props.onTabChange}
                onPlay={() => setSheet('play')}
                onMore={() => setSheet('more')}
            />
            {sheet === 'play' && (
                <PlaySheet sportLabel={sport.label} actions={playActions} isAdmin={props.isAdmin} onClose={closeSheet} />
            )}
            {sheet === 'more' && (
                <MoreSheet {...props} items={moreItems} onClose={closeSheet} />
            )}
        </div>
    )
}

export default AppShell
