import { lazy, Suspense } from 'react'
import { createHashRouter } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'

const WorldSelectorView = lazy(() => import('@/features/worlds/WorldSelectorView'))
const WorldDashboardView = lazy(() => import('@/features/worlds/WorldDashboardView'))
const MapExplorerView = lazy(() => import('@/features/maps/MapExplorerView'))
const CharacterRosterView = lazy(() => import('@/features/characters/CharacterRosterView'))
const CharacterDetailView = lazy(() => import('@/features/characters/CharacterDetailView'))
const ItemRosterView = lazy(() => import('@/features/items/ItemRosterView'))
const ItemDetailView = lazy(() => import('@/features/items/ItemDetailView'))
const RelationshipGraphView = lazy(() => import('@/features/relationships/RelationshipGraphView'))
const TimelineView = lazy(() => import('@/features/timeline/TimelineView'))
const ChapterDetailView = lazy(() => import('@/features/timeline/ChapterDetailView'))
const CharacterArcView = lazy(() => import('@/features/arc/CharacterArcView'))
const WorldSettingsView = lazy(() => import('@/features/worlds/WorldSettingsView'))
const LoreView = lazy(() => import('@/features/lore/LoreView'))
const LorePageEditor = lazy(() => import('@/features/lore/LorePageEditor'))
const FactionsView = lazy(() => import('@/features/factions/FactionsView'))

function Loading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[hsl(var(--border))] border-t-[hsl(var(--ring))]" />
    </div>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>
}

export const router = createHashRouter([
  {
    path: '/',
    element: <Wrap><WorldSelectorView /></Wrap>,
  },
  {
    path: '/worlds/:worldId',
    element: <AppShell />,
    children: [
      { index: true, element: <Wrap><WorldDashboardView /></Wrap> },
      { path: 'maps', element: <Wrap><MapExplorerView /></Wrap> },
      { path: 'characters', element: <Wrap><CharacterRosterView /></Wrap> },
      { path: 'characters/:characterId', element: <Wrap><CharacterDetailView /></Wrap> },
      { path: 'items', element: <Wrap><ItemRosterView /></Wrap> },
      { path: 'items/:itemId', element: <Wrap><ItemDetailView /></Wrap> },
      { path: 'relationships', element: <Wrap><RelationshipGraphView /></Wrap> },
      { path: 'timeline', element: <Wrap><TimelineView /></Wrap> },
      { path: 'timeline/:chapterId', element: <Wrap><ChapterDetailView /></Wrap> },
      { path: 'arc', element: <Wrap><CharacterArcView /></Wrap> },
      { path: 'settings', element: <Wrap><WorldSettingsView /></Wrap> },
      { path: 'lore', element: <Wrap><LoreView /></Wrap> },
      { path: 'lore/:pageId', element: <Wrap><LorePageEditor /></Wrap> },
      { path: 'factions', element: <Wrap><FactionsView /></Wrap> },
    ],
  },
])
