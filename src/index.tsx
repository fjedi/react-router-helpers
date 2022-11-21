//
import * as React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  memo,
  cloneElement,
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from 'react';
import * as PropTypes from 'prop-types';
// React
import {
  Route,
  Navigate,
  Outlet,
  useLocation,
  UNSAFE_NavigationContext as NavigationContext,
} from 'react-router-dom';
import { History, Transition } from 'history';
import { Navigator } from 'react-router';

export type ViewerRole = string | null;
export type ViewerType = { id: string; role: ViewerRole } | null;
export const ViewerContext = createContext<ViewerType>(null);
export const ViewerRoleContext: React.Context<ViewerRole> = createContext<ViewerRole>(null);

export const AuthModalContext = createContext<{
  status: boolean;
  setStatus?: Dispatch<SetStateAction<boolean>>;
}>({ status: false });

export const ViewerRoleProvider: React.FC<{ value: ViewerRole; children: React.ReactNode }> = ({
  value,
  children,
}) => (
  <ViewerRoleContext.Consumer>
    {(role) => (
      <ViewerRoleContext.Provider value={role === 'ADMIN' ? role : value}>
        {children}
      </ViewerRoleContext.Provider>
    )}
  </ViewerRoleContext.Consumer>
);

export const AuthModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState(false);
  const store = { status, setStatus };
  return <AuthModalContext.Provider value={store}>{children}</AuthModalContext.Provider>;
};

// <Status code="xxx"> component.  Updates the context router's context, which
// can be used by the server handler to respond to the status on the server.
const Status: React.FC<{ code: number; children?: React.ReactNode }> = ({ code, children }) => {
  const context = useMemo(() => ({ code }), [code]);

  const RouteElement: JSX.Element = useMemo(
    () => (
      <>
        {children}
        <Outlet context={context} />
      </>
    ),
    [context, children],
  );

  return RouteElement;
};
//
Status.propTypes = {
  code: PropTypes.number.isRequired,
};

// <NotFound> component.  If this renders on the server in development mode,
// it will attempt to proxyify the request to the upstream `webpack-dev-server`.
// In production, it will issue a hard 404 and render.  In the browser, it will
// simply render.
export const NotFound: React.FC<{ children?: React.ReactNode }> = memo(({ children }) => (
  <Route element={<Status code={404}>{children}</Status>} />
));
NotFound.defaultProps = { children: null };

// <Redirect> component. Mirrors React Router's component by the same name,
// except it sets a 301/302 status code for setting server-side HTTP headers.
export type RedirectProps = {
  to: string | { pathname?: string; state: { from: string } };
  permanent?: boolean;
  push?: boolean;
  state?: Record<string, unknown>;
};
export const Redirect: React.FC<RedirectProps> = memo(({ to, push, permanent, state }) => {
  const code = useMemo(() => (permanent ? 301 : 302), [permanent]);
  const RouteElement = useMemo(
    () => (
      <Status code={code}>
        <Navigate to={to} replace={!push} state={state} />
      </Status>
    ),
    [code, to as string, push, state],
  );

  return <Route element={RouteElement} />;
}) as React.FC<RedirectProps>;

//
type RouteComponentProps = {
  [k: string]: unknown;
};

export type CurrentRole = ViewerRole | 'ANONYMOUS';

export type RestrictedAreaProps = {
  areaType: 'route' | 'block';
  children?: React.ReactElement;
  component?: React.ComponentType<RouteComponentProps>;
  currentRole?: CurrentRole;
  redirectTo?: string;
  restrictedRoles?: string[];
  allowedRoles?: string[];
};
// @ts-ignore
export const RestrictedArea: React.FC<RestrictedAreaProps> = (props) => {
  const {
    children,
    component: Component,
    areaType,
    currentRole,
    redirectTo,
    restrictedRoles,
    allowedRoles,
    ...componentProps
  } = props;

  const roleFromContext = useContext(ViewerRoleContext);
  const viewerRole: CurrentRole = currentRole || roleFromContext || 'ANONYMOUS';
  const notAllowed =
    (Array.isArray(allowedRoles) &&
      allowedRoles.length > 0 &&
      !allowedRoles.includes(viewerRole)) ||
    (Array.isArray(restrictedRoles) &&
      restrictedRoles.length > 0 &&
      restrictedRoles.includes(viewerRole));
  const location = useLocation();
  const to = useMemo(() => redirectTo ?? '/', [redirectTo]);
  //
  if (areaType === 'route') {
    if (notAllowed) {
      return <Navigate to={to} state={{ from: location }} replace />;
    }
    return children;
  }
  //
  if (notAllowed) {
    return null;
  }
  if (children) {
    return cloneElement(children, componentProps);
  }

  return Component ? <Component {...componentProps} /> : null;
};
RestrictedArea.propTypes = {
  redirectTo: PropTypes.string,
};
RestrictedArea.defaultProps = {
  redirectTo: '/login',
};

export type ExtendNavigator = Navigator & Pick<History, 'block'>;
export function useBlocker(blocker: (tx: Transition) => void, when = true) {
  const { navigator } = useContext(NavigationContext);

  useEffect(() => {
    if (!when) return;

    const unblock = (navigator as ExtendNavigator).block((tx) => {
      const autoUnblockingTx = {
        ...tx,
        retry() {
          unblock();
          tx.retry();
        },
      };

      blocker(autoUnblockingTx);
    });

    return unblock;
  }, [navigator, blocker, when]);
}

export function usePrompt(message: string, when = true) {
  const blocker = useCallback(
    (tx: Transition) => {
      if (window.confirm(message)) tx.retry();
    },
    [message],
  );

  useBlocker(blocker, when);
}

export { RouteMatch, RouterProps } from 'react-router';

export {
  Navigate,
  useNavigate,
  useNavigationType,
  useRoutes,
  useHref,
  useOutlet,
  useLinkClickHandler,
  useSearchParams,
  useOutletContext,
  useInRouterContext,
  useResolvedPath,
  Route,
  Routes,
  useLocation,
  useMatch,
  useParams,
  BrowserRouterProps,
  BrowserRouter,
  Link,
  NavLink,
} from 'react-router-dom';
