import React from 'react';

import { connect, StringCodec, credsAuthenticator } from 'nats.ws';
import { DropzoneArea } from 'material-ui-dropzone';

import { withStyles } from "@material-ui/core/styles";
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Snackbar from '@material-ui/core/Snackbar';
import Typography from '@material-ui/core/Typography';

const sc = StringCodec();
const revokeSubject = 'chat.req.revoke';
const provisionUpdateSubject = 'chat.req.provisioned.updates';
const provisionedUsersSubject = 'chat.req.provisioned';

function styles(theme) {
  return {
    whiteDivider: {
      backgroundColor: 'hsl(204deg 45% 98% / 70%)',
    },
    grayDivider: {
      backgroundColor: 'hsl(214deg 20% 69% / 25%)',
    },
  };
}

function Header(props) {
  const classes = props.classes;

  return (
    <Box my={6}>
      <Box display="flex" flexDirection="row">
        <Box><img src="/logo.png" width="200" /></Box>
        <Box ml={3}><Typography variant="h4">Chat Admin</Typography></Box>
      </Box>
      <Box mt={1} />
      <Divider classes={{root: classes.whiteDivider}} light />
    </Box>
  );
}

class Admin extends React.Component {
  constructor(props) {
    super(props);

    this.state ={
      nc: null,
      provisioned: {},
      authed: false,
      err: '',
    };

    this.changeDropzone = this.changeDropzone.bind(this);
    this.handleProvisioned = this.handleProvisioned.bind(this);
    this.revokeAccess = this.revokeAccess.bind(this);
    this.closeSnackbar = this.closeSnackbar.bind(this);

    this.credFileExts = [".creds", ".ncds"];
    this.snackbarAnchor = {
      vertical: 'bottom',
      horizontal: 'left',
    };
  }

  changeDropzone(files) {
    if (files.length == 0) {
      return;
    }

    const r = new FileReader();
    r.addEventListener('load', (e) => {
      const creds = e.target.result;

      // Connect with admin credentials that were dropped in.
      connect({
        servers: [this.props.natsInfo.url],
        authenticator: credsAuthenticator(sc.encode(creds)),
      }).then((nc) => {
        // If we made it here, the admin creds were successfully validated by
        // the NATS Server.

        // Setup NATS Stream to listen for active user updates.
        nc.subscribe(provisionUpdateSubject, {
          callback: this.handleProvisioned,
        });

        return Promise.all([
          Promise.resolve(nc),
          // Ask NATS Service to send us the list of users it currently knows
          // about.
          nc.request(provisionedUsersSubject, sc.encode('')),
        ]);
      }).then(([nc, msg]) => {
        this.setState({
          nc,
          // Save users to state.
          provisioned: JSON.parse(sc.decode(msg.data)),
          authed: true,
        });
      }).catch((err) => {
        console.error(err);

        let msg = 'Failed to connect to NATS';
        if (err.message) {
          msg = `${msg}: ${err.message}`;
        } else if (err.name && err.name === 'NatsError') {
          msg = `${msg}: trouble communicating with NATS`;
        }
        this.setState({err: msg});
      });
    });
    r.readAsText(files[0]);
  }

  closeSnackbar(e) {
    this.setState({err: ''});
  }

  handleProvisioned(err, msg) {
    if (err) {
      console.error(err);

      let msg = `Error receiving ${provisionUpdateSubject} message`;
      if (err.message) {
        msg = `${msg}: ${err.message}`;
      } else if (err.name && err.name === 'NatsError') {
        msg = `${msg}: trouble communicating with NATS`;
      }
      this.setState({err: msg});
      return;
    }

    this.setState({
      provisioned: JSON.parse(sc.decode(msg.data)),
    });
  }

  revokeAccess(username) {
    return () => {
      this.state.nc.request(revokeSubject, sc.encode(username)).then((resp) => {
        this.setState({
          provisioned: JSON.parse(sc.decode(resp.data)),
        });
      }).catch((err) => {
        console.error(err);

        let msg = `Failed to revoke ${username} access`;
        if (err.message) {
          msg = `${msg}: ${err.message}`;
        } else if (err.name && err.name === 'NatsError') {
          msg = `${msg}: trouble communicating with NATS`;
        }
        this.setState({err: msg});
      });
    };
  }

  render() {
    const classes = this.props.classes;

    if (!this.state.nc) {
      return (
        <Container maxWidth="md">
          <Snackbar
            anchorOrigin={this.snackbarAnchor}
            autoHideDuration={6000}
            open={this.state.err !== ''}
            message={this.state.err}
            onClose={this.closeSnackbar}
          />
          <Header classes={classes} />
          <Box color="white" mb={3}>
            <Typography variant="body1">
              Please provide your NATS admin credentials below to continue.
            </Typography>
          </Box>
          <DropzoneArea
            filesLimit={1}
            acceptedFiles={this.credFileExts}
            onChange={this.changeDropzone}
          />
        </Container>
      );
    }

    let users = null;
    if (this.state.provisioned) {
      const p = this.state.provisioned;
      let us = [];
      for (let username in p) {
        us.push({
          username: username,
          publicKey: p[username],
        });
      }

      users = us.map((o, i) => {
        let divider = <Divider classes={{root: classes.grayDivider}} />;
        if (i === us.length-1) {
          divider = null;
        }

        return (
          <React.Fragment key={o.publicKey}>
            <Box display="flex" flexDirection="row" my={6}>
              <Box flexGrow={1} color="#F7FAFC">
                <Typography variant="body1"><strong>{o.username}</strong></Typography>
                <Typography variant="caption">{o.publicKey}</Typography>
              </Box>
              <Box>
                <Button variant="contained" onClick={this.revokeAccess(o.username)}>
                  Revoke
                </Button>
              </Box>
            </Box>
            {divider}
          </React.Fragment>
        );
      });
    }

    return (
      <Container maxWidth="md">
        <Snackbar
          anchorOrigin={this.snackbarAnchor}
          autoHideDuration={6000}
          open={this.state.err !== ''}
          message={this.state.err}
          onClose={this.closeSnackbar}
        />
        <Header classes={classes} />
        {users}
      </Container>
    );
  }
}

export default withStyles(styles)(Admin);
