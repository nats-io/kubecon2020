import React from 'react';
import { Redirect } from 'react-router-dom';

import { connect, StringCodec, credsAuthenticator } from 'nats.ws';

import { withStyles } from "@material-ui/core/styles";
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';

const bootstrapCreds = '-----BEGIN NATS USER JWT-----\neyJ0eXAiOiJqd3QiLCJhbGciOiJlZDI1NTE5In0.eyJqdGkiOiJET0pSNVFBM1RSTUQ3TExIM1VGM1NRTU5TQkFZVEhSNUFIT0ZCSVFHNFVUWFpMQ0xWV0pRIiwiaWF0IjoxNjAzMzA2Mjc2LCJpc3MiOiJBQzVISlJUQlpOWkdUQTNJM1AyV1BSVVlTTUVERFFWUFlYVFdLWkdOWk9VVlNBN1pRTVhTS1FMUyIsIm5hbWUiOiJjaGF0LWNyZWRzLXJlcXVlc3QiLCJzdWIiOiJVRDUyNzNMRldBU0wyQlA1VzJPUUo3TjdEQ1ZHSVRLRk9NSDVMQjRJQ0pLUEpBWkJCWVlVWERVWSIsInR5cGUiOiJ1c2VyIiwibmF0cyI6eyJwdWIiOnsiYWxsb3ciOlsiX0lOQk9YLlx1MDAzZSIsIl9SXy5cdTAwM2UiLCJjaGF0LnJlcS5hY2Nlc3MiXX0sInN1YiI6eyJhbGxvdyI6WyJfSU5CT1guXHUwMDNlIiwiX1JfLlx1MDAzZSJdfX0sImlzc3Vlcl9hY2NvdW50IjoiQUM3TElVR1YzTzJHT0lHR0FZN0ROTUNaSkhST0RCUzVaRjVDRDQ1Nkk0QklPSzRMQUxBNkFFVlEifQ.PFKdYyQm3lxyN2jRa97XexuspxTIzgf2MtRf24ivIYrUHNYWYjJ76jPujMZ4hlTWm25ibXif5gRpVSoGNs2VBA\n------END NATS USER JWT------\n\n************************* IMPORTANT *************************\nNKEY Seed printed below can be used to sign and prove identity.\nNKEYs are sensitive and should be treated as secrets.\n\n-----BEGIN USER NKEY SEED-----\nSUAGWG6WIE7WVABGBBMIMAWH6KPDRGO25F73D57Z73KZXBHM3JD42MGVPE\n------END USER NKEY SEED------\n\n*************************************************************\n';
const credsRequestSubject = 'chat.req.access';

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

    this.sc = StringCodec();

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

    connect({
      servers: ['wss://localhost:9222'],
      authenticator: credsAuthenticator(this.sc.encode(bootstrapCreds)),
      name: 'KUBECON NATS Chat WebUI',
    }).then((nc) => {
      return Promise.all([
        Promise.resolve(nc),
        nc.request(credsRequestSubject, this.sc.encode(this.state.username)),
      ]);
    }).then(([nc, m]) => {
      return Promise.all([
        Promise.resolve(this.sc.decode(m.data)),
        nc.close(),
      ]);
    }).then(([creds]) => {
      return Promise.all([
        Promise.resolve(creds),
        connect({
          servers: ['wss://localhost:9222'],
          authenticator: credsAuthenticator(this.sc.encode(creds)),
          name: 'KUBECON NATS Chat WebUI',
        }),
      ]);
    }).then(([creds, nc]) => {
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
      return <Redirect to="/chat" />;
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

