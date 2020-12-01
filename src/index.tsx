//
import * as React from 'react';
import { memo, cloneElement, createContext, useContext, useCallback, useState } from 'react';
import * as PropTypes from 'prop-types';
// React
import { Route, Redirect as ReactRouterRedirect } from 'react-router-dom';

export type ViewerType = { id: string; role: string } | null;
export const ViewerContext: React.Context<ViewerType> = createContext<ViewerType>(null);
export const AuthModalContext = createContext({ status: false });

export default ViewerContext;

export const AuthModalProvider: React.FC = ({ children }) => {
  const [status, setStatus] = useState(false);
  const store = { status, setStatus };
  return <AuthModalContext.Provider value={store}>{children}</AuthModalContext.Provider>;
};

// <Status code="xxx"> component.  Updates the context router's context, which
// can be used by the server handler to respond to the status on the server.
const Status: React.FC<{ code: number }> = ({ code, children }) => {
  const render = useCallback(
    ({ staticContext }) => {
      if (staticContext) {
        staticContext.status = code;
      }
      return children;
    },
    [code],
  );

  return <Route render={render} />;
};
//
Status.propTypes = {
  code: PropTypes.number.isRequired,
};

// <NotFound> component.  If this renders on the server in development mode,
// it will attempt to proxyify the request to the upstream `webpack-dev-server`.
// In production, it will issue a hard 404 and render.  In the browser, it will
// simply render.
export const NotFound: React.FC = memo(({ children }) => <Status code={404}>{children}</Status>);
NotFound.propTypes = { children: PropTypes.node };
NotFound.defaultProps = { children: null };

// <Redirect> component. Mirrors React Router's component by the same name,
// except it sets a 301/302 status code for setting server-side HTTP headers.
export type RedirectProps = {
  to: string | { pathname?: string; state: { from: string } };
  from?: string;
  permanent?: boolean;
  push?: boolean;
  strict?: boolean;
  exact?: boolean;
};
export const Redirect: React.FC<RedirectProps> = memo(({ to, from, push, permanent }) => (
  <Status code={permanent ? 301 : 302}>
    <ReactRouterRedirect to={to} from={from} push={push} />
  </Status>
));

//
export type RestrictedAreaProps = {
  path?: string;
  exact?: boolean;
  strict?: boolean;
  render?: (a: unknown) => React.Component;
  children?: React.ReactElement;
  component?: React.ElementType;
  areaType: 'route' | 'block';
  currentRole?: string;
  redirectTo?: string;
  restrictedRoles?: string[];
  allowedRoles?: string[];
};
export const RestrictedArea: React.FC<RestrictedAreaProps> = (props) => {
  const {
    children,
    path,
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
  const viewer = useContext(ViewerContext);
  const viewerRole = currentRole || viewer?.role || 'ANONYMOUS';
  const notAllowed =
    (Array.isArray(allowedRoles) &&
      allowedRoles.length > 0 &&
      !allowedRoles.includes(viewerRole)) ||
    (Array.isArray(restrictedRoles) &&
      restrictedRoles.length > 0 &&
      restrictedRoles.includes(viewerRole));
  const renderRoute = useCallback((routeProps) => {
    if (notAllowed) {
      //
      return (
        <Redirect
          strict
          exact
          from={path}
          to={{
            pathname: redirectTo,
            state: { from: routeProps.location },
          }}
        />
      );
    }
    return (
      <Route
        exact={exact}
        strict={strict}
        path={path}
        component={Component}
        render={render}
        {...routeProps}
      />
    );
  }, []);
  //
  if (areaType === 'route') {
    return <Route exact={exact} strict={strict} render={renderRoute} />;
  }
  //
  if (notAllowed) {
    return null;
  }
  if (children) {
    return cloneElement(children, componentProps);
  }
  // @ts-ignore
  return <Component {...componentProps} />;
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
