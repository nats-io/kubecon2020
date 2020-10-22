import React from 'react';
import { Redirect } from 'react-router-dom';

import { connect, StringCodec, credsAuthenticator } from 'nats.ws';
import { v4 } from 'uuid';
import jwtDecode from 'jwt-decode';

import { withStyles } from "@material-ui/core/styles";
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import InputBase from '@material-ui/core/InputBase';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import SendIcon from '@material-ui/icons/Send';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';

const msgsPrefix = 'chat.KUBECON';
const postsPrefix = `${msgsPrefix}.posts`;
const dmsPrefix = `${msgsPrefix}.dms`;
const onlineStatus = `${msgsPrefix}.online`;
const chanGeneral = 'General';
const chanNats = 'NATS';
const chanKubecon = 'KUBECON';

const sc = StringCodec();

function styles(theme) {
  return {
    root: {
      height: '100%',
    },
    messageInputField: {
      color: '#1A202C',
    },
    contextItem: {
      '&.Mui-selected': {
        backgroundColor: 'rgba(0, 0, 0, 0.20)',
      },
    },
  };
}

function timeFromUnix(secs) {
  const date = new Date(secs * 1000);

  let hour = date.getHours();
  let minutes = date.getMinutes();

  let shour = `${hour}`;
  if (hour < 10) {
    shour = `0${hour}`;
  }

  let sminutes = `${minutes}`;
  if (minutes < 10) {
    sminutes = `0${minutes}`;
  }

  return `${shour}:${sminutes}`;
}

function Message(props) {
  let text = '';
  if (props.text) {
    text = props.text;
  }

  let time = '0:00';
  if (props.time) {
    time = props.time;
  }

  let name = 'user';
  if (props.username) {
    name = props.username;
  }

  return (
    <Box display="flex" my={1}>
      <Box>
        <Typography variant="caption">{time}</Typography>
      </Box>
      <Box ml={1}>
        <Typography variant="caption"><strong>{name}</strong></Typography>
      </Box>
      <Box mx={3}>
        <Typography variant="body1">{text}</Typography>
      </Box>
    </Box>
  );
}

function MessageDisplay(props) {
  let messages = null;
  if (props.messages && props.messages.length > 0) {
    const msgs = props.messages.map((m) => {
      return <Message key={m.id} username={m.username} time={m.time} text={m.text} />;
    });
    messages = (
      <React.Fragment>
        {msgs}
      </React.Fragment>
    );
  }

  return (
    <Box
      px={1}
      py={3}
      height="90vh"
      overflow="auto"
      display="flex"
      flexDirection="column-reverse"
    >
      {messages}
    </Box>
  );
}

function MessageInput(props) {
  const classes = props.classes;
  const onChange = props.onChange;
  const onSend = props.onSend;
  const value = props.value;

  return (
    <form onSubmit={onSend} style={{width: "100%"}}>
      <Box
        display="flex"
        p={1}
        alignItems="center"
        bgcolor="#F7FAFC"
        borderRadius="borderRadius"
      >
          <Box flexGrow={1}>
            <InputBase
              autoFocus
              fullWidth
              className={classes.messageInputField}
              placeholder="Send a message"
              value={value}
              onChange={onChange}
            />
          </Box>
          <Box>
            <IconButton size="small" type="submit">
              <SendIcon fontSize="inherit" />
            </IconButton>
          </Box>
      </Box>
    </form>
  );
}

function ContextSidebar(props) {
  const current = props.current;
  const onClick = props.onClick;
  const classes = props.classes;
  const onLogout = props.onLogout;

  let online = null;
  if (props.online) {
    let users = [];
    for (let pubKey in props.online) {
      const o = props.online[pubKey];
      users.push((
        <ListItem
          key={o.publicKey}
          button
          selected={current === o.username}
          onClick={onClick(o.username)}
          classes={{root: classes.contextItem}}
        >
          <ListItemText primary={`• ${o.username}`} />
        </ListItem>
      ));
    }

    online = (
      <List>
        {users}
      </List>
    );
  }

  return (
    <Box>
      <Box>
        <Typography variant="caption">Channels</Typography>
        <List>
          <ListItem
            classes={{root: classes.contextItem}}
            button
            selected={current === chanKubecon}
            onClick={onClick(chanKubecon)}
          >
            <ListItemText primary={`# ${chanKubecon}`} />
          </ListItem>
          <ListItem
            classes={{root: classes.contextItem}}
            button
            selected={current === chanNats}
            onClick={onClick(chanNats)}
          >
            <ListItemText primary={`# ${chanNats}`} />
          </ListItem>
          <ListItem
            classes={{root: classes.contextItem}}
            button
            selected={current === chanGeneral}
            onClick={onClick(chanGeneral)}
          >
            <ListItemText primary={`# ${chanGeneral}`} />
          </ListItem>
        </List>
      </Box>
      <Box mt={1} mb={3}><Divider /></Box>
      <Box>
        <Typography variant="caption">Direct Messages</Typography>
        {online}
      </Box>
      <Box position="absolute" top="92vh">
        <Button size="small" onClick={onLogout}>Logout</Button>
      </Box>
    </Box>
  );
}

class Chat extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      messageCompose: '',
      nc: null,
      redirect: false,
      curContext: chanKubecon,
      messages: {
        [chanGeneral]: [],
        [chanKubecon]: [],
        [chanNats]: [],
      },
      online: {},
    };

    this.user = {name: '', creds: '', seed: '', publicKey: ''};
    if (localStorage.getItem('natschat.user.creds')) {
      this.user.creds = localStorage.getItem('natschat.user.creds');

      const lines = this.user.creds.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('-----BEGIN USER PRIVATE KEY')) {
          this.user.seed = lines[i+1];
        } else if (lines[i].startsWith('-----BEGIN NATS USER JWT')) {
          const jwt = jwtDecode(lines[i+1]);
          this.user.publicKey = jwt.sub;
          this.user.name = jwt.name;
        }
      }
    }

    this.changeMessageCompose = this.changeMessageCompose.bind(this);
    this.handleChanGeneral = this.handleChanGeneral.bind(this);
    this.handleChanKubecon = this.handleChanKubecon.bind(this);
    this.handleChanNats = this.handleChanNats.bind(this);
    this.sendChatPost = this.sendChatPost.bind(this);
    this.sendDmPost = this.sendDmPost.bind(this);
    this.send = this.send.bind(this);
    this.updateMessages = this.updateMessages.bind(this);
    this.changeContext = this.changeContext.bind(this);
    this.handleOnline = this.handleOnline.bind(this);
    this.handleSelfMessages = this.handleSelfMessages.bind(this);
    this.getOnlineJwt = this.getOnlineJwt.bind(this);
    this.logout = this.logout.bind(this);
  }

  componentDidMount() {
    connect({
      servers: [this.props.natsInfo.url],
      authenticator: credsAuthenticator(sc.encode(this.user.creds)),
      name: 'KUBECON NATS Chat WebUI',
    }).then((nc) => {
      this.setState({nc});

      nc.subscribe(`${postsPrefix}.${chanKubecon}`, {
        callback: this.handleChanKubecon,
      });
      nc.subscribe(`${postsPrefix}.${chanNats}`, {
        callback: this.handleChanNats,
      });
      nc.subscribe(`${postsPrefix}.${chanGeneral}`, {
        callback: this.handleChanGeneral,
      });
      nc.subscribe(onlineStatus, {
        callback: this.handleOnline,
      });
      nc.subscribe(`${dmsPrefix}.${this.user.publicKey}`, {
        callback: this.handleSelfMessages,
      });

      nc.closed().then((err) => {
        // Handle server closing the connection.
        localStorage.removeItem('natschat.user.name');
        localStorage.removeItem('natschat.user.creds');
        this.setState({redirect: true});
      });

      nc.publish(onlineStatus, sc.encode(JSON.stringify(this.getOnlineJwt())));
      window.setInterval(() => {
        nc.publish(onlineStatus, sc.encode(JSON.stringify(this.getOnlineJwt())));
      }, 30000);
    }).catch(err => {
      console.error('failed to connect to NATS:', err);
    });
  }

  getOnlineJwt() {
    const unixNow = Math.floor((+ new Date()) / 1000);

    const later = new Date();
    later.setSeconds(later.getSeconds() + 60);
    const unixLater = Math.floor((+ later) / 1000);

    return {
      exp: unixLater,
      jti: v4(),
      iat: unixNow,
      iss: this.user.publicKey,
      name: this.user.name,
      sub: this.user.publicKey,
      nats: {
        type: 'chat-online',
        version: 2,
      },
    };
  }

  logout() {
      localStorage.removeItem('natschat.user.name');
      localStorage.removeItem('natschat.user.creds');
      this.setState({redirect: true});
  }

  updateMessages(context, msg) {
    this.setState(prev => {
      let newMessages = [];
      if (prev.messages[context]) {
        newMessages = prev.messages[context].map(m => {
          return Object.assign({}, m);
        });
      }

      newMessages = [
        {
          id: msg.jti,
          username: msg.name,
          time: timeFromUnix(msg.iat),
          text: msg.nats.msg,
        },
        ...newMessages,
      ];

      const messages = Object.assign({}, prev.messages);
      messages[context] = newMessages;

      const newState = {
        messages,
      };

      return newState;
    });
  }

  handleChanGeneral(err, msg) {
    if (err) {
      console.error("failed to receive message:", err);
      return;
    }

    const data = sc.decode(msg.data);
    let jwt = {};
    if (data.startsWith("{")) {
      jwt = JSON.parse(data);
    } else {
      jwt = jwtDecode(data);
    }

    this.updateMessages(chanGeneral, jwt);
  }

  handleChanKubecon(err, msg) {
    if (err) {
      console.error("failed to receive message:", err);
      return;
    }

    const data = sc.decode(msg.data);
    let jwt = {};
    if (data.startsWith("{")) {
      jwt = JSON.parse(data);
    } else {
      jwt = jwtDecode(data);
    }

    this.updateMessages(chanKubecon, jwt);
  }

  handleChanNats(err, msg) {
    if (err) {
      console.error("failed to receive message:", err);
      return;
    }

    const data = sc.decode(msg.data);
    let jwt = {};
    if (data.startsWith("{")) {
      jwt = JSON.parse(data);
    } else {
      jwt = jwtDecode(data);
    }

    this.updateMessages(chanNats, jwt);
  }

  changeMessageCompose(e) {
    this.setState({messageCompose: e.currentTarget.value});
  }

  send(e) {
    e.preventDefault();

    if (!this.state.nc) {
      console.error('no NATS connection available');
      return;
    }

    let isChannel = false;
    switch (this.state.curContext) {
    case chanKubecon:
    case chanNats:
    case chanGeneral:
        isChannel = true;
        break;
    }

    if (isChannel) {
      this.sendChatPost(this.state.curContext, this.state.messageCompose);
      return;
    }
    this.sendDmPost(this.state.curContext, this.state.messageCompose);
  }

  sendChatPost(channel, msg) {
    const jwt = {
      jti: v4(),
      iss: this.user.publicKey,
      iat: Math.floor((+ new Date()) / 1000),
      name: this.user.name,
      sub: channel,
      nats: {
        msg: msg,
        type: "chat-post",
        version: 2,
      },
    };

    this.state.nc.publish(`${postsPrefix}.${channel}`, sc.encode(JSON.stringify(jwt)));
    this.setState({messageCompose: ''});
  }

  sendDmPost(username, msg) {
    let toPublicKey = '';
    for (let pubKey in this.state.online) {
      if (this.state.online[pubKey].username === username) {
        toPublicKey = pubKey;
        break;
      }
    }
    if (toPublicKey === '') {
      throw new Error(`no public key for user ${username}`);
    }

    const jwt = {
      jti: v4(),
      iat: Math.floor((+ new Date()) / 1000),
      iss: this.user.publicKey,
      name: this.user.name,
      sub: username,
      nats: {
        msg: msg,
        type: "chat-dm",
        version: 2,
      },
    };

    this.state.nc.publish(`${dmsPrefix}.${toPublicKey}`, sc.encode(JSON.stringify(jwt)));
    this.setState({messageCompose: ''}, () => {
      this.updateMessages(username, jwt);
    });
  }

  changeContext(context) {
    return () => {
      this.setState({curContext: context});
    };
  }

  handleOnline(err, msg) {
    const data = sc.decode(msg.data);
    let jwt = {};
    if (data.startsWith("{")) {
      jwt = JSON.parse(data);
    } else {
      jwt = jwtDecode(data);
    }

    this.setState(prev => {
      let online = {};
      for (let pubKey in prev.online) {
        if (prev.online[pubKey].expiresAt < (new Date())) {
          continue;
        }
        online[pubKey] = Object.assign({}, prev.online[pubKey]);
      }

      online[jwt.iss] = {
        publicKey: jwt.iss,
        username: jwt.name,
        issuedAt: new Date(jwt.iat * 1000),
        expiresAt: new Date(jwt.exp * 1000),
      };

      return {
        online,
      };
    });
  }

  handleSelfMessages(err, msg) {
    const data = sc.decode(msg.data);
    let jwt = {};
    if (data.startsWith("{")) {
      jwt = JSON.parse(data);
    } else {
      jwt = jwtDecode(data);
    }

    this.updateMessages(jwt.name, jwt);
  }

  render() {
    if (this.state.redirect) {
      return <Redirect to="/welcome" />;
    }

    const classes = this.props.classes;
    const messages = this.state.messages[this.state.curContext];

    return (
      <Grid className={classes.root} container>
        <Grid item xs={2}>
          <Box p={1} pt={3} bgcolor="#536367" color="white" height="100%">
            <Box mb={3}display="flex" justifyContent="center">
              <img src="/logo.png" width="150" />
            </Box>
            <Divider />
            <Box mt={3} />
            <ContextSidebar
              classes={classes}
              online={this.state.online}
              onClick={this.changeContext}
              current={this.state.curContext}
              onLogout={this.logout}
            />
          </Box>
        </Grid>
        <Grid item xs={10}>
          <Box p={1} height="100%">
            <MessageDisplay messages={messages} />
            <MessageInput
              classes={classes}
              onSend={this.send}
              onChange={this.changeMessageCompose}
              value={this.state.messageCompose}
            />
          </Box>
        </Grid>
      </Grid>
    );
  }
}

export default withStyles(styles)(Chat);
