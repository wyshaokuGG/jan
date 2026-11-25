import '@testing-library/jest-dom/vitest'
import type { ComponentProps, ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const router = vi.hoisted(() => ({ navigate: vi.fn() }))
const channel = vi.hoisted(() => ({ cowork: true, desktop: true }))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => router.navigate,
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useLocation: ({ select }: { select?: (l: { pathname: string }) => unknown } = {}) =>
    select ? select({ pathname: '/' }) : { pathname: '/' },
}))
vi.mock('@/lib/version', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/version')>()),
  isCoworkEnabled: () => channel.cowork,
}))
vi.mock('@/lib/coworkSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/coworkSync')>()),
  supportsCowork: () => channel.desktop,
}))
vi.mock('@/i18n/react-i18next-compat', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/hooks/useLeftPanel', () => ({ useLeftPanel: () => ({ open: true }) }))
vi.mock('@/stores/titlebar-layout-store', () => ({ useTitlebarLayout: () => 0 }))
vi.mock('@/containers/DownloadManegement', () => ({ DownloadManagement: () => null }))
vi.mock('@/containers/dialogs/SkillsManagerDialog', () => ({
  default: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? <div role="dialog"><button onClick={() => onOpenChange(false)}>Close skills</button></div> : null,
}))
vi.mock('@/hooks/useThreadManagement', () => ({ useThreadManagement: () => ({ addFolder: vi.fn() }) }))
vi.mock('@/hooks/useSearchDialog', () => ({ useSearchDialog: () => ({ open: false, setOpen: vi.fn() }) }))
vi.mock('@/hooks/useProjectDialog', () => ({ useProjectDialog: () => ({ open: false, setOpen: vi.fn() }) }))
vi.mock('@/containers/dialogs/AddProjectDialog', () => ({ default: () => null }))
vi.mock('@/containers/dialogs/SearchDialog', () => ({ SearchDialog: () => null }))
vi.mock('../NavHistory', () => ({ NavHistory: () => <div>Chats and tasks</div> }))
vi.mock('../NavProjects', () => ({ NavProjects: () => <div>Projects</div> }))
vi.mock('@/components/ui/sidebar', () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>
  return {
    Sidebar: Box,
    SidebarContent: Box,
    SidebarHeader: Box,
    SidebarMenu: ({ children }: { children: ReactNode }) => <ul>{children}</ul>,
    SidebarMenuItem: ({ children }: { children: ReactNode }) => <li>{children}</li>,
    SidebarMenuButton: (props: ComponentProps<'button'> & { asChild?: boolean; isActive?: boolean }) => {
      const { asChild, isActive, ...buttonProps } = props
      void asChild
      void isActive
      return <button {...buttonProps} />
    },
    SidebarTrigger: () => null,
    SidebarRail: () => null,
    useSidebar: () => ({ isMobile: false, setOpenMobile: vi.fn(), closeMobileForNavigation: vi.fn() }),
  }
})
vi.mock('@/components/animated-icon/animated-lucide', () => ({
  AnimatedLucideIcon: () => null,
}))

import { LeftSidebar } from '..'
import { useCoworkSessions } from '@/hooks/useCoworkSessions'
import { route } from '@/constants/routes'

it('renders one sidebar: navigation, projects and a single history, with no tab switcher', () => {
  render(<LeftSidebar />)
  expect(screen.getByText('common:newChat')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'common:cowork' })).toBeInTheDocument()
  expect(screen.getByText('Projects')).toBeInTheDocument()
  expect(screen.getByText('Chats and tasks')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'common:cowork' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'common:home' })).not.toBeInTheDocument()
})

it('creates and opens a fresh Cowork session on every click', () => {
  router.navigate.mockReset()
  useCoworkSessions.setState({ sessions: [], currentId: null })
  render(<LeftSidebar />)
  const cowork = screen.getByRole('button', { name: 'common:cowork' })

  fireEvent.click(cowork)
  fireEvent.click(cowork)

  const sessions = useCoworkSessions.getState().sessions
  expect(sessions).toHaveLength(2)
  expect(new Set(sessions.map((session) => session.id)).size).toBe(2)
  expect(router.navigate).toHaveBeenNthCalledWith(1, {
    to: route.coworkSession,
    params: { sessionId: sessions[1].id },
  })
  expect(router.navigate).toHaveBeenNthCalledWith(2, {
    to: route.coworkSession,
    params: { sessionId: sessions[0].id },
  })
})

it('only shows Cowork on supported desktop builds where the feature is enabled', () => {
  channel.desktop = false
  const { unmount } = render(<LeftSidebar />)
  expect(screen.queryByRole('button', { name: 'common:cowork' })).not.toBeInTheDocument()
  unmount()

  channel.desktop = true
  channel.cowork = false
  render(<LeftSidebar />)
  expect(screen.queryByRole('button', { name: 'common:cowork' })).not.toBeInTheDocument()

  channel.cowork = true
})

it('offers Artifacts and Skills on every build', () => {
  render(<LeftSidebar />)
  expect(screen.getByTestId('nav-artifacts')).toBeInTheDocument()
  expect(screen.getByTestId('nav-customize')).toBeInTheDocument()
})

it('places Artifacts and Skills without replacing the rest of the navigation', () => {
  render(<LeftSidebar />)
  expect(screen.getByTestId('nav-artifacts')).toBeInTheDocument()
  expect(screen.getByTestId('nav-customize')).toHaveTextContent('common:skills')
  expect(screen.queryByText('common:customize')).not.toBeInTheDocument()
  const artifacts = screen.getByTestId('nav-artifacts')
  expect(screen.getByText('common:search').compareDocumentPosition(artifacts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(artifacts.compareDocumentPosition(screen.getByText('common:hub')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByText('common:newChat')).toBeInTheDocument()
  expect(screen.getByText('Chats and tasks')).toBeInTheDocument()
})

it('inserts Skills directly before Settings as a menu row and opens its dialog', () => {
  render(<LeftSidebar />)
  const skills = screen.getByRole('button', { name: 'common:skills' })
  const row = skills.closest('li')!
  expect(row.nextElementSibling).toHaveTextContent('common:settings')
  expect(row.parentElement?.tagName).toBe('UL')
  expect(document.querySelector('ul ul')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.click(skills)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.click(screen.getByText('Close skills'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
