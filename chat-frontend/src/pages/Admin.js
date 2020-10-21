import React from 'react';

import { connect, StringCodec, credsAuthenticator } from 'nats.ws';
import { DropzoneArea } from 'material-ui-dropzone';

import { withStyles } from "@material-ui/core/styles";
import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Button from '@material-ui/core/Button';

const sc = StringCodec();
const revokeSubject = "chat.req.revoke";

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
    };

    this.changeDropzone = this.changeDropzone.bind(this);
    this.handleProvisioned = this.handleProvisioned.bind(this);
    this.revokeAccess = this.revokeAccess.bind(this);
    this.credFileExts = [".creds", ".ncds"];
  }

  changeDropzone(files) {
    if (files.length == 0) {
      return;
    }

    const r = new FileReader();
    r.addEventListener('load', (e) => {
      const creds = e.target.result;

      connect({
        servers: ["wss://variadico.xyz:9222"],
        authenticator: credsAuthenticator(sc.encode(creds)),
      }).then((nc) => {
        nc.subscribe('chat.req.provisioned.updates', {
          callback: this.handleProvisioned,
        });

        return Promise.all([
          Promise.resolve(nc),
          nc.request('chat.req.provisioned', sc.encode('plz')),
        ]);
      }).then(([nc, msg]) => {
        this.setState({
          nc,
          provisioned: JSON.parse(sc.decode(msg.data)),
          authed: true,
        });
      }).catch(err => {
        console.error('failed to connect to NATS:', err);
      });
    });
    r.readAsText(files[0]);
  }

  handleProvisioned(err, msg) {
    if (err) {
      console.error('failed to receive message:', err);
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
      });
    };
  }

  render() {
    const classes = this.props.classes;

    if (!this.state.nc) {
      return (
        <Container maxWidth="md">
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
        <Header classes={classes} />
        {users}
      </Container>
    );
  }
}

export default withStyles(styles)(Admin);
