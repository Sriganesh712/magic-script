/**
 * Client-Side Router for Screenplay Studio
 * Compatible with React Router v6/v7 API
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
  type AnchorHTMLAttributes,
  type MouseEvent,
} from 'react'

// ============================================================================
// Types
// ============================================================================

export interface Location {
  pathname: string
  search: string
  hash: string
  state: unknown
}

export type Params = Record<string, string>

export interface NavigateOptions {
  replace?: boolean
  state?: unknown
}

export type NavigateFunction = (to: string | number, options?: NavigateOptions) => void

export interface RouteObject {
  path?: string
  index?: boolean
  element?: ReactNode
  children?: RouteObject[]
}

interface RouteMatch {
  params: Params
  element: ReactNode
  childElement?: ReactNode
}

interface RouterContextType {
  location: Location
  navigate: NavigateFunction
  params: Params
  outlet: ReactNode | null
}

const RouterContext = createContext<RouterContextType | null>(null)

// ============================================================================
// Path Matching Helpers
// ============================================================================

function cleanPath(path: string): string {
  if (!path) return '/'
  const trimmed = path.trim()
  if (trimmed === '' || trimmed === '/') return '/'
  // Normalize leading slash and remove trailing slash (unless root)
  const withLeading = trimmed.startsWith('/') ? trimmed : '/' + trimmed
  return withLeading.length > 1 && withLeading.endsWith('/')
    ? withLeading.slice(0, -1)
    : withLeading
}

export function matchPath(
  pattern: string,
  pathname: string
): { matches: boolean; params: Params } {
  const normPattern = cleanPath(pattern)
  const normPath = cleanPath(pathname)

  if (pattern.trim() === '*' || normPattern === '/*') {
    return { matches: true, params: { '*': normPath } }
  }

  if (normPattern === normPath) {
    return { matches: true, params: {} }
  }

  const patternSegments = normPattern.split('/').filter(Boolean)
  const pathSegments = normPath.split('/').filter(Boolean)

  if (patternSegments.length !== pathSegments.length && !normPattern.endsWith('/*')) {
    return { matches: false, params: {} }
  }

  const params: Params = {}

  for (let i = 0; i < patternSegments.length; i++) {
    const pSeg = patternSegments[i]
    const uSeg = pathSegments[i]

    if (pSeg === '*') {
      params['*'] = pathSegments.slice(i).join('/')
      return { matches: true, params }
    }

    if (pSeg.startsWith(':')) {
      const paramName = pSeg.slice(1)
      if (!uSeg) return { matches: false, params: {} }
      params[paramName] = decodeURIComponent(uSeg)
    } else if (pSeg !== uSeg) {
      return { matches: false, params: {} }
    }
  }

  if (patternSegments.length < pathSegments.length && !normPattern.endsWith('/*')) {
    return { matches: false, params: {} }
  }

  return { matches: true, params }
}

// ============================================================================
// Router Context Provider
// ============================================================================

export interface BrowserRouterProps {
  children: ReactNode
}

export function BrowserRouter({ children }: BrowserRouterProps) {
  const [location, setLocation] = useState<Location>(() => ({
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
    hash: window.location.hash || '',
    state: window.history.state,
  }))

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      setLocation({
        pathname: window.location.pathname || '/',
        search: window.location.search || '',
        hash: window.location.hash || '',
        state: event.state,
      })
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate: NavigateFunction = useCallback((to, options = {}) => {
    if (typeof to === 'number') {
      window.history.go(to)
      return
    }

    const { replace = false, state = null } = options
    if (replace) {
      window.history.replaceState(state, '', to)
    } else {
      window.history.pushState(state, '', to)
    }

    const url = new URL(to, window.location.origin)
    setLocation({
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      state,
    })

    window.scrollTo(0, 0)
  }, [])

  const contextValue = useMemo<RouterContextType>(() => ({
    location,
    navigate,
    params: {},
    outlet: null,
  }), [location, navigate])

  return (
    <RouterContext.Provider value={contextValue}>
      {children}
    </RouterContext.Provider>
  )
}

// ============================================================================
// Hooks
// ============================================================================

export function useLocation(): Location {
  const ctx = useContext(RouterContext)
  if (!ctx) {
    return {
      pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
      search: typeof window !== 'undefined' ? window.location.search : '',
      hash: typeof window !== 'undefined' ? window.location.hash : '',
      state: null,
    }
  }
  return ctx.location
}

export function useNavigate(): NavigateFunction {
  const ctx = useContext(RouterContext)
  if (!ctx) {
    return (to) => {
      if (typeof to === 'string') window.location.href = to
    }
  }
  return ctx.navigate
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  const ctx = useContext(RouterContext)
  return (ctx ? ctx.params : {}) as T
}

export function useSearchParams(): [URLSearchParams, (nextInit: URLSearchParams | Record<string, string>) => void] {
  const location = useLocation()
  const navigate = useNavigate()

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])

  const setSearchParams = useCallback((nextInit: URLSearchParams | Record<string, string>) => {
    const nextQuery = nextInit instanceof URLSearchParams
      ? nextInit.toString()
      : new URLSearchParams(nextInit).toString()
    navigate(`${location.pathname}?${nextQuery}${location.hash}`, { replace: true })
  }, [location.pathname, location.hash, navigate])

  return [searchParams, setSearchParams]
}

// ============================================================================
// Routes & Route
// ============================================================================

export interface RouteProps {
  path?: string
  index?: boolean
  element?: ReactNode
  children?: ReactNode
}

export function Route(_props: RouteProps): ReactNode {
  return null
}

export interface RoutesProps {
  children?: ReactNode
}

function resolveRoutes(
  children: ReactNode,
  currentPath: string,
  basePath = ''
): RouteMatch | null {
  const childArray = React.Children.toArray(children)
  let wildcardMatch: RouteMatch | null = null

  for (const child of childArray) {
    if (!React.isValidElement<RouteProps>(child)) continue

    const { path, index, element, children: nestedChildren } = child.props
    const fullPattern = path !== undefined
      ? (path.startsWith('/') ? path : `${basePath}/${path}`.replace(/\/+/g, '/'))
      : (index ? (basePath || '/') : undefined)

    if (nestedChildren) {
      const childMatch = resolveRoutes(nestedChildren, currentPath, fullPattern || basePath)
      if (childMatch) {
        return {
          params: childMatch.params,
          element,
          childElement: childMatch.element,
        }
      }
    }

    if (fullPattern === '*') {
      wildcardMatch = {
        params: { '*': currentPath },
        element: element || null,
      }
      continue
    }

    if (fullPattern) {
      const { matches, params } = matchPath(fullPattern, currentPath)
      if (matches) {
        return {
          params,
          element: element || null,
        }
      }
    }
  }

  return wildcardMatch
}

export function Routes({ children }: RoutesProps) {
  const ctx = useContext(RouterContext)
  const location = useLocation()
  const currentPath = location.pathname

  const match = useMemo(() => {
    return resolveRoutes(children, currentPath)
  }, [children, currentPath])

  if (!match) return null

  const newContext: RouterContextType = {
    location: ctx?.location || location,
    navigate: ctx?.navigate || (() => {}),
    params: match.params,
    outlet: match.childElement || null,
  }

  return (
    <RouterContext.Provider value={newContext}>
      {match.element}
    </RouterContext.Provider>
  )
}

export function Outlet(): ReactNode {
  const ctx = useContext(RouterContext)
  return ctx?.outlet ?? null
}

// ============================================================================
// Link & NavLink
// ============================================================================

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string
  replace?: boolean
  state?: unknown
}

export function Link({ to, replace, state, onClick, children, ...props }: LinkProps) {
  const navigate = useNavigate()

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e)
    if (
      !e.defaultPrevented &&
      e.button === 0 &&
      (!props.target || props.target === '_self') &&
      !e.metaKey &&
      !e.altKey &&
      !e.ctrlKey &&
      !e.shiftKey
    ) {
      e.preventDefault()
      navigate(to, { replace, state })
    }
  }

  return (
    <a href={to} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}

export interface NavLinkProps extends Omit<LinkProps, 'className' | 'children'> {
  className?: string | ((props: { isActive: boolean }) => string)
  children: ReactNode | ((props: { isActive: boolean }) => ReactNode)
}

export function NavLink({ to, className, children, ...props }: NavLinkProps) {
  const location = useLocation()
  const isActive = cleanPath(location.pathname) === cleanPath(to)

  const resolvedClassName = typeof className === 'function'
    ? className({ isActive })
    : className

  const resolvedChildren = typeof children === 'function'
    ? children({ isActive })
    : children

  return (
    <Link to={to} className={resolvedClassName} {...props}>
      {resolvedChildren}
    </Link>
  )
}

export interface NavigateProps {
  to: string
  replace?: boolean
}

export function Navigate({ to, replace = true }: NavigateProps) {
  const navigate = useNavigate()
  useEffect(() => {
    navigate(to, { replace })
  }, [navigate, to, replace])
  return null
}

// ============================================================================
// Data Router Compatibility (createBrowserRouter & RouterProvider)
// ============================================================================

export interface RouterInstance {
  routes: RouteObject[]
}

export function createBrowserRouter(routes: RouteObject[]): RouterInstance {
  return { routes }
}

function renderRouteObjects(routes: RouteObject[]): ReactNode {
  return routes.map((route, i) => {
    const key = route.path || (route.index ? 'index' : `route-${i}`)
    if (route.children) {
      return (
        <Route key={key} path={route.path} index={route.index} element={route.element}>
          {renderRouteObjects(route.children)}
        </Route>
      )
    }
    return <Route key={key} path={route.path} index={route.index} element={route.element} />
  })
}

export function RouterProvider({ router }: { router: RouterInstance }) {
  return (
    <BrowserRouter>
      <Routes>
        {renderRouteObjects(router.routes)}
      </Routes>
    </BrowserRouter>
  )
}

export function MemoryRouter({
  children,
  initialEntries,
}: {
  children: ReactNode
  initialEntries?: string[]
}) {
  if (initialEntries && initialEntries.length > 0 && typeof window !== 'undefined') {
    window.history.replaceState(null, '', initialEntries[0])
  }
  return <BrowserRouter>{children}</BrowserRouter>
}
