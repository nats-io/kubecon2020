// Copyright 2019-2020 The NATS Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"os/signal"
	"strings"
	"time"

	jwt "github.com/nats-io/jwt/v2"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nkeys"
)

// userRegistry is a map of usernames to public keys.
var userRegistry = make(map[string]string)

func usage() {
	log.Printf("Usage: chat-access [-s server] [-acc acc-jwt-file] [-sk signing-key-file] [-creds creds] [-sid label]\n")
}

func showUsageAndExit(exitcode int) {
	usage()
	os.Exit(exitcode)
}

const (
	reqSubj    = "chat.req.access"
	reqGroup   = "kubecon"
	maxNameLen = 8
)

func main() {
	var server = flag.String("s", "localhost", "NATS System")
	var accFile = flag.String("acc", "", "Account JWT File")
	var skFile = flag.String("sk", "", "Account Signing Key")
	var appCreds = flag.String("creds", "", "App Credentials File")
	var appCreds2 = flag.String("creds2", "", "App Credentials File")
	var sid = flag.String("sid", "<undisclosed>", "Server ID, e.g. AWS/West")

	log.SetFlags(0)
	flag.Usage = usage
	flag.Parse()

	if *accFile == "" || *skFile == "" {
		showUsageAndExit(1)
	}

	opts := []nats.Option{nats.Name("KubeCon Chat-Access")}
	opts = setupConnOptions(opts)
	if *appCreds != "" {
		opts = append(opts, nats.UserCredentials(*appCreds))
	}

	// Connect to NATS
	nc, err := nats.Connect(*server, opts...)
	if err != nil {
		log.Fatalln("Failed to connect to NATS:", err)
	}

	nc2, err := nats.Connect(*server, nats.UserCredentials(*appCreds2))
	if err != nil {
		log.Fatalln("Failed to connect to NATS:", err)
	}

	log.SetFlags(log.LstdFlags)
	log.Print("Connected to NATS System")

	// Load account JWT and signing key
	acc, sk := loadAccountAndSigningKey(*accFile, *skFile)

	// Subscribe to Requests. QueueSubscriber means we can scale
	// up and down as needed.
	_, err = nc.QueueSubscribe(reqSubj, reqGroup, func(m *nats.Msg) {
		if len(m.Data) == 0 {
			m.Respond([]byte("-ERR 'Name can not be empty'"))
			return
		}
		reqName := simpleName(m.Data)
		log.Printf("Registered %q [%q]\n", reqName, m.Data)
		creds := generateUserCreds(acc, sk, reqName, *sid)
		m.Respond([]byte(creds))

		// Tell admin that we've added a new user.
		data, err := json.Marshal(userRegistry)
		if err != nil {
			m.Respond([]byte("-ERR " + err.Error()))
			return
		}
		nc2.Publish("chat.req.provisioned.updates", data)
	})

	_, err = nc2.QueueSubscribe("chat.KUBECON.online", reqGroup, func(m *nats.Msg) {
		var name, publicKey string

		if bytes.HasPrefix(m.Data, []byte("{")) {
			var mj map[string]interface{}
			if err := json.Unmarshal(m.Data, &mj); err != nil {
				m.Respond([]byte("-ERR " + err.Error()))
				return
			}

			if v, ok := mj["name"]; ok {
				if s, ok := v.(string); ok {
					name = s
				}
			}
			if v, ok := mj["iss"]; ok {
				if s, ok := v.(string); ok {
					publicKey = s
				}
			}
		} else if sps := bytes.Split(m.Data, []byte(".")); len(sps) == 3 {
			tok, err := jwt.DecodeGeneric(string(m.Data))
			if err != nil {
				m.Respond([]byte("-ERR " + err.Error()))
				return
			}

			name = tok.Name
			publicKey = tok.Issuer
		} else {
			m.Respond([]byte("-ERR 'Unexpected payload'"))
			return
		}

		if name == "" || publicKey == "" {
			m.Respond([]byte("-ERR 'Unexpected empty'"))
			return
		}

		userRegistry[name] = publicKey

		// Tell admin that we've added a new user.
		data, err := json.Marshal(userRegistry)
		if err != nil {
			m.Respond([]byte("-ERR " + err.Error()))
			return
		}
		nc2.Publish("chat.req.provisioned.updates", data)
	})

	_, err = nc2.QueueSubscribe("chat.req.provisioned", reqGroup, func(m *nats.Msg) {
		data, err := json.Marshal(userRegistry)
		if err != nil {
			m.Respond([]byte("-ERR " + err.Error()))
			return
		}

		m.Respond([]byte(data))
	})

	_, err = nc2.QueueSubscribe("chat.revoke.access", reqGroup, func(m *nats.Msg) {
		username := string(m.Data)
		delete(userRegistry, username)

		data, err := json.Marshal(userRegistry)
		if err != nil {
			m.Respond([]byte("-ERR " + err.Error()))
			return
		}

		m.Respond([]byte(data))
	})

	if err != nil {
		log.Fatal(err)
	}

	// Setup the interrupt handler to drain so we don't
	// drop requests when scaling down.
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	<-c
	log.Println()
	log.Printf("Draining...")
	nc.Drain()
	log.Fatalf("Exiting")

}

// Some limits for our auto-provisioned users.
const (
	maxMsgSize = 1024
	validFor   = 365 * 24 * time.Hour

	// Should match chat versions.
	audience  = "KUBECON"
	preSub    = "chat.KUBECON."
	onlineSub = preSub + "online"
	postsSub  = preSub + "posts.*"
	dmsPub    = preSub + "dms.*"
	dmsSub    = preSub + "dms.%s"
	inboxSub  = "_INBOX.>"

	credsT = `
-----BEGIN NATS USER JWT-----
%s
------END NATS USER JWT------

************************* IMPORTANT *************************
Private NKEYs are sensitive and should be treated as secrets.

-----BEGIN USER PRIVATE KEY-----
%s
------END USER PRIVATE KEY------

*************************************************************

# Provisioned by NATS team
# Server ID/LOC: %q
`
)

func createNewUserKeys() (string, []byte) {
	kp, _ := nkeys.CreateUser()
	pub, _ := kp.PublicKey()
	priv, _ := kp.Seed()
	return pub, priv
}

func generateUserCreds(acc *jwt.AccountClaims, akp nkeys.KeyPair, name, sid string) string {
	if name == "" {
		log.Printf("Error generating user JWT: username cannot be empty")
		return "-ERR 'API_ERROR'"
	}

	if _, ok := userRegistry[name]; ok {
		log.Printf("Error generating user JWT: user already exists")
		return "-ERR 'API_ERROR'"
	}

	pub, priv := createNewUserKeys()
	nuc := jwt.NewUserClaims(pub)
	nuc.Name = name
	nuc.Expires = time.Now().Add(validFor).Unix()
	nuc.Limits.Payload = maxMsgSize

	// Can listen for DMs, but only to ones to ourselves.
	pubAllow := jwt.StringList{onlineSub, postsSub, dmsPub}
	subAllow := jwt.StringList{onlineSub, postsSub, fmt.Sprintf(dmsSub, pub), inboxSub}

	nuc.Permissions.Pub.Allow = pubAllow
	nuc.Permissions.Sub.Allow = subAllow

	// This line was disabled because it causes an authorization error. It may
	// not be needed because the account public key is already listed under the
	// iss (issuer) key.
	// nuc.IssuerAccount = acc.Subject

	ujwt, err := nuc.Encode(akp)
	if err != nil {
		log.Printf("Error generating user JWT: %v", err)
		return "-ERR 'Internal Error'"
	}
	creds := fmt.Sprintf(credsT, ujwt, priv, sid)

	userRegistry[name] = pub

	return creds
}

// For demo, first name, max 8 chars and all lower case.
func simpleName(name []byte) string {
	reqName := string(name)
	reqName = strings.Split(strings.ToLower(reqName), " ")[0]
	if len(reqName) > maxNameLen {
		reqName = reqName[:maxNameLen]
	}
	return reqName
}

func loadAccountAndSigningKey(accFile, skFile string) (*jwt.AccountClaims, nkeys.KeyPair) {
	contents, err := ioutil.ReadFile(accFile)
	if err != nil {
		log.Fatalf("Could not load account file: %v", err)
	}
	acc, err := jwt.DecodeAccountClaims(string(contents))
	if err != nil {
		log.Fatalf("Could not decode account: %v", err)
	}
	seed, err := ioutil.ReadFile(skFile)
	if err != nil {
		log.Fatalf("Could not load signing key file: %v", err)
	}
	kp, err := nkeys.FromSeed(seed)
	if err != nil {
		log.Fatalf("Could not decode signing key: %v", err)
	}
	return acc, kp
}

func setupConnOptions(opts []nats.Option) []nats.Option {
	totalWait := 10 * time.Minute
	reconnectDelay := 5 * time.Second

	opts = append(opts, nats.ReconnectWait(reconnectDelay))
	opts = append(opts, nats.MaxReconnects(int(totalWait/reconnectDelay)))
	opts = append(opts, nats.DisconnectHandler(func(nc *nats.Conn) {
		log.Printf("Disconnected: will attempt reconnects for %.0fm", totalWait.Minutes())
	}))
	opts = append(opts, nats.ReconnectHandler(func(nc *nats.Conn) {
		log.Printf("Reconnected [%s]", nc.ConnectedUrl())
	}))
	opts = append(opts, nats.ClosedHandler(func(nc *nats.Conn) {
		log.Fatalf("Exiting: %v", nc.LastError())
	}))
	return opts
}
