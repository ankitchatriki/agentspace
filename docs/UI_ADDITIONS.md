# UI additions (designer) - all exported from `@/components/ui`

Spec'd components keep their names/props. `AppShell` gained OPTIONAL props only.

## AppShell (extended, all new props optional)
`projects?: SidebarProject[]` (`{href,label,attention?,running?}`), `workspace?: {id,name}`, `workspaces?: {id,name}[]`,
`onSwitchWorkspace?(id)`, `breadcrumb?: {href?,label}[]` (Topbar), `onOpenPalette?()` (enables the Cmd/Ctrl+K shortcut and the
trigger), `topbarActions?: ReactNode`. `userMenu` now renders in a popover from the top-bar avatar. Sidebar collapse state is
remembered in localStorage. Inbox badge also shows as a waiting pill in the top bar.

## New components
- `Sidebar` / `Topbar` / `BrandMark`: used by AppShell; usable standalone.
- `Breadcrumbs { items: {href?,label}[] }`
- `CommandPaletteTrigger { onClick?, placeholder?, className? }` (button only; Coder B builds the palette)
- `StatCard { label, value, unit?, delta?, deltaLabel?, tone?: 'neutral'|'running'|'waiting'|'idle'|'danger', icon?, spark?: number[], loading?, hint? }`
- `Skeleton { className }`, `AgentCardSkeleton`, `RequestCardSkeleton`, `TableSkeleton { rows?, cols? }`
- `ErrorState { title?, description?, onRetry?, action? }`
- `EmptyState` gained `compact?: boolean`
- `DataTable<T> { columns: {key, header, cell(row), align?, width?, hideOnMobile?, mono?}[], rows: T[], rowKey(row), onRowClick?, rowHref?, loading?, error?, onRetry?, emptyTitle?, emptyDescription?, dense?, caption? }` (handles loading/error/empty itself)
- `AvatarStack { people: {name, src?}[], max?, size? }`
- `Tabs { tabs: {value,label,count?,attention?}[], value, onChange, label? }` (arrow-key navigation)

Also exported: `StatusGlyph` (shape-coded status icon). See `/styleguide`.
