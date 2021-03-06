import React from 'react';
import { BrowserRouter, Route, Switch, Redirect } from 'react-router-dom';

import { createMuiTheme } from "@material-ui/core/styles";
import { ThemeProvider } from "@material-ui/styles";
import CssBaseline from '@material-ui/core/CssBaseline';

import Welcome from './pages/Welcome';
import Chat from './pages/Chat';
import Admin from './pages/Admin';

// These values get populated in the build artifact at compile time.
const natsInfo = {
  url: NATS_SERVER_URL,
  bootstrapCreds: NATS_BOOTSTRAP_CREDS,
};

const theme = createMuiTheme({
  palette: {
    background: {
      paper: '#F7FAFC',
      default: '#00011f',
    },
    primary: {
      light: '#8dc63f',
      main: '#8dc63f',
      dark: '#8dc63f',
      contrastText: '#384D37',
    },
    secondary: {
      light: '#34a574',
      main: '#34a574',
      dark: '#34a574',
      contrastText: '#f00',
    },
    text: {
      primary: '#A0AEC0',
      secondary: '#808d9f',
    },
  },
});

function AppRoute(props) {
  const hasUserCreds = localStorage.getItem('natschat.user.creds') !== null;
  let redirectTo = "";
  if (props.path === "/welcome" && hasUserCreds) {
    redirectTo = "/";
  } else if (props.path === "/" && !hasUserCreds) {
    redirectTo = "/welcome";
  }

  if (redirectTo !== "") {
    return (
      <Redirect to={redirectTo} />
    );
  }

  const Component = props.component;
  return (
    <Route
      path={props.path}
      render={routeProps => {
        return <Component match={routeProps.match} natsInfo={natsInfo} />;
      }}
    />
  );
}

class App extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Switch>
            <AppRoute path="/admin" component={Admin} />
            <AppRoute path="/welcome" component={Welcome} />
            <AppRoute path="/" component={Chat} />
          </Switch>
        </BrowserRouter>
      </ThemeProvider>
    );
  }
}

export default App;
