//
import * as React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { memo, cloneElement, createContext, useContext, useMemo, useState } from 'react';
import * as PropTypes from 'prop-types';
// React
import { Route, Navigate, Outlet, useLocation } from 'react-router-dom';

export type ViewerRole = string | null;
export type ViewerType = { id: string; role: ViewerRole } | null;
export const ViewerContext = createContext<ViewerType>(null);
export const ViewerRoleContext: React.Context<ViewerRole> = createContext<ViewerRole>(null);

export const AuthModalContext = createContext<{
  status: boolean;
  setStatus?: Dispatch<SetStateAction<boolean>>;
}>({ status: false });

export default ViewerContext;

export const ViewerRoleProvider: React.FC<{ value: ViewerRole }> = ({ value, children }) => (
  <ViewerRoleContext.Consumer>
    {(role) => (
      <ViewerRoleContext.Provider value={role === 'ADMIN' ? role : value}>
        {children}
      </ViewerRoleContext.Provider>
    )}
  </ViewerRoleContext.Consumer>
);

export const AuthModalProvider: React.FC = ({ children }) => {
  const [status, setStatus] = useState(false);
  const store = { status, setStatus };
  return <AuthModalContext.Provider value={store}>{children}</AuthModalContext.Provider>;
};

// <Status code="xxx"> component.  Updates the context router's context, which
// can be used by the server handler to respond to the status on the server.
const Status: React.FC<{ code: number }> = ({ code, children }) => {
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
export const NotFound: React.FC = memo(({ children }) => (
  <Route element={<Status code={404}>{children}</Status>} />
));
NotFound.propTypes = { children: PropTypes.node };
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
export type RestrictedAreaProps = {
  path?: string;
  exact?: boolean;
  strict?: boolean;
  render?: (a: unknown) => React.Component;
  children?: React.ReactElement;
  component?: React.ComponentType<RouteComponentProps>;
  areaType: 'route' | 'block';
  currentRole?: string;
  redirectTo?: string;
  restrictedRoles?: string[];
  allowedRoles?: string[];
};
export const RestrictedArea: React.FC<RestrictedAreaProps> = (props) => {
  const {
    children,
    path: routePath,
    exact,
    strict,
    component: Component,
    areaType,
    currentRole,
    redirectTo,
    restrictedRoles,
    allowedRoles,
    render,
    ...componentProps
  } = props;

  const roleFromContext = useContext(ViewerRoleContext);
  const viewerRole = currentRole || roleFromContext || 'ANONYMOUS';
  const notAllowed =
    (Array.isArray(allowedRoles) &&
      allowedRoles.length > 0 &&
      !allowedRoles.includes(viewerRole)) ||
    (Array.isArray(restrictedRoles) &&
      restrictedRoles.length > 0 &&
      restrictedRoles.includes(viewerRole));

  const location = useLocation();
  const state = useMemo(() => ({ from: location }), [location]);
  const to = useMemo(() => redirectTo ?? '/', [redirectTo]);
  const path = useMemo(() => routePath ?? '', [routePath]);

  const RouteComponent: React.FC<RouteComponentProps> = useMemo(
    () => (bypassProps) =>
      notAllowed ? (
        <Redirect to={to} state={state} permanent={!!bypassProps.permanent} />
      ) : (
        <>{Component ? <Component {...bypassProps} /> : <Outlet />}</>
      ),
    [notAllowed, to, state, Component],
  );

  const RouteElement = useMemo(
    () => (
      <>
        {RouteComponent && <RouteComponent {...componentProps} />}
        {children}
      </>
    ),
    [RouteComponent, componentProps, children],
  );
  //
  if (areaType === 'route') {
    if (Component) {
      return <Route path={path} element={RouteElement} />;
    }

    return <Route path={path} />;
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
  render: PropTypes.func,
  exact: PropTypes.bool,
  strict: PropTypes.bool,
  path: PropTypes.string,
  redirectTo: PropTypes.string,
};
RestrictedArea.defaultProps = {
  currentRole: undefined,
  render: undefined,
  path: undefined,
  exact: false,
  strict: false,
  redirectTo: '/login',
};
