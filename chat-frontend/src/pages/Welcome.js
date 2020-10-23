import React from 'react';
import { Redirect } from 'react-router-dom';

import {
  connect,            // Used to connect to NATS Server
  StringCodec,        // Used to translate between String and Uint8Array and back.
  credsAuthenticator, // Used to authenticate with NATS JWT credentials.
} from 'nats.ws';

import { withStyles } from "@material-ui/core/styles";
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';

const credsRequestSubject = 'chat.req.access';
const sc = StringCodec();

function styles(theme) {
  return {
    textField: {
      color: theme.palette.primary.contrastText,
    },
  };
}

class Welcome extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      username: '',
      redirect: false,
    };

    this.changeUsername = this.changeUsername.bind(this);
    this.register = this.register.bind(this);
  }

  changeUsername(e) {
    this.setState({
      username: e.currentTarget.value,
    });
  }

  register(e) {
    e.preventDefault();

    // First, we connect to the NATS Server with creds that can only requests
    // real creds.
    connect({
      servers: [this.props.natsInfo.url],
      authenticator: credsAuthenticator(sc.encode(this.props.natsInfo.bootstrapCreds)),
      name: 'KUBECON NATS Chat WebUI',
    }).then((nc) => {
      return Promise.all([
        Promise.resolve(nc),
        // nc.request hits a NATS Server Service.
        nc.request(credsRequestSubject, sc.encode(this.state.username)),
      ]);
    }).then(([nc, msg]) => {
      return Promise.all([
        Promise.resolve(sc.decode(msg.data)),
        // nc.close closes the original less restricted NATS Server user
        // account.
        nc.close(),
      ]);
    }).then(([creds]) => {
      return Promise.all([
        Promise.resolve(creds),
        // reconnect with full real creds.
        connect({
          servers: [this.props.natsInfo.url],
          authenticator: credsAuthenticator(sc.encode(creds)),
          name: 'KUBECON NATS Chat WebUI',
        }),
      ]);
    }).then(([creds, nc]) => {
      // If we were able to reconnect with real creds, we've authenticated
      // correctly!
      localStorage.setItem('natschat.user.name', this.state.username);
      localStorage.setItem('natschat.user.creds', creds);
      this.setState({redirect: true});
    }).catch(err => {
      if (err instanceof TypeError) {
        console.log("unable to register name");
      } else {
        console.error('failed register user:', err);
      }
    });
  }

  render() {
    if (this.state.redirect) {
      return <Redirect to="/" />;
    }

    const classes = this.props.classes;
    return (
      <Container maxWidth="md">
        <Box mt={12} />
        <Grid container>
          <Grid item xs={6}>
            <Box py={6} px={3} color="white">
              <Box display="flex" alignItems="flexStart">
                <Box display="inline"><img src="/logo.png" width="300" /></Box>
                <Box ml={3} display="inline"><Typography variant="h2">Chat</Typography></Box>
              </Box>
              <Box mt={3}>
                <Typography variant="h5">
                  Register a username to join the party! 🎉💃
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box p={6}>
              <Paper>
                <Box py={6} px={3}>
                  <form onSubmit={this.register}>
                    <Box>
                      <TextField
                        autoFocus
                        variant="outlined"
                        label="Username"
                        fullWidth
                        color="primary"
                        value={this.state.username}
                        onChange={this.changeUsername}
                        InputProps={{className: classes.textField}}
                      />
                    </Box>
                    <Box mt={3} display="flex">
                      <Box flexGrow={1} />
                      <Button variant="contained" color="primary" type="submit">
                        Register
                      </Button>
                    </Box>
                  </form>
                </Box>
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </Container>
    );
  }
}

export default withStyles(styles)(Welcome);

