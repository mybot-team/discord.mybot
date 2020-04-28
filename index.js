'use strict';

const WebSocket = require('ws')

// Discord API v7
const WEB = 'https://discordapp.com'
const API = `${WEB}/api/v7`
const CDN = 'https://cdn.discordapp.com'

const APIRequest = require('./APIRequest.js');

const OPCode = {
 DISPATCH: 0,
 HEARTBEAT: 1,
 IDENTIFY: 2,
 RESUME: 6,
 RECONNECT: 7,
 INVALID_SESSION: 9,
 HELLO: 10,
 HEARTBEAT_ACK: 11,
};

// Creado una clase cliente Main
class Client extends require('events') {
 #token;
 #auth;
 #sessionId;
 #lastSequence;
 #lastHeartbeatAck;
 #heartbeatTimer;
 #ws;

 constructor(){
  super();
 }

 #WsConnect = async resume => {
  this.#WsDisconnect();

  if(!resume) {
   this.#sessionId = undefined;
   this.#lastSequence = 0;
  }

  this.#ws = new WebSocket(JSON.parse(await APIRequest.APIRequest(`${API}/gateway/bot`, {
   headers: {
    Authorization: this.#auth
   }
  })).url);

  this.#ws.on('message', this.#OnMessage);
  this.#ws.on('close', this.#OnClose);
  this.#ws.on('error', this.#OnError);
  
 }
 #WsDisconnect = (code = 1012) => {
  if(!this.#ws)
   return;
  
  this.emit('disconnect', code);
  this.#ws.removeAllListeners();
  this.#ws.close(code);
  this.#ws = undefined;
  
 }
 #OnMessage = data => {
  const packet = JSON.parse(data);
  if(!packet)
   return;
  
  if(packet.s > this.#lastSequence)
   this.#lastSequence = packet.s;
  
  const op = packet.op;
  if(op == OPCode.DISPATCH) {
   const t = packet.t;
   if((t == 'READY') || (t == 'RESUMED')) {
    if(packet.d.session_id)
     this.#sessionId = packet.d.session_id;
   
    this.#lastHeartbeatAck = true;
    this.#SendHeartbeat();
    this.emit('connect');
    
   }
   this.emit('packet', packet);

  } else if (op == OPCode.HELLO) {
   this.#Identify();
   this.#lastHeartbeatAck = true;
   this.#SetHeartbeatTimer(packet.d.heartbeat_interval);

  } else if ( op == OPCode.HEARTBEAT_ACK) {
   this.#lastHeartbeatAck = true;

  } else if (op == OPCode.HEARTBEAT) {
   this.#SendHeartbeat();

  } else if (op == OPCode.INVALID_SESSION) {
   this.emit('warn', `Sesión inválida. Reanudable: ${packet.d}`);
   this.#WsConnect(packet.d);

  } else if (op == OPCode.RECONNECT) {
   this.emit('warn', 'Reconexión.');
   this.#WsConnect(true);

  }
 }
 #Identify = () => {
  this.#ws.send(JSON.stringify(this.#sessionId ? {
   op: OPCode.RESUME,
   d: {
    token: this.#token,
    session_id: this.#sessionId,
    seq: this.#lastSequence,
   },
  } : {
   op: OPCode.IDENTIFY,
   d: {
    token: this.#token,
    properties: {
     $os: 'linux',
     $browser: 'bot',
     $device: 'bot'
    },
   },
  }));
 }

 #SendHeartbeat = () => {
  if(this.#lastHeartbeatAck) {
   if(this.#ws && (this.#ws.readyState == 1)) {
    this.#lastHeartbeatAck = false;
    this.#ws.send(JSON.stringify({
     op: OPCode.HEARTBEAT,
     d: this.#lastSequence
    }));
   }
  } else {
   this.emit('warn', 'Tiempo de espera.');
   this.#WsConnect(true);

  }
 }
 #SetHeartbeatTimer = interval => {
  if(this.#heartbeatTimer) {
   clearInterval(this.#heartbeatTimer);
   this.#heartbeatTimer = undefined;

  }
  if(interval)
  this.#heartbeatTimer = setInterval(this.#SendHeartbeat, interval);

 }
 #OnClose = code => {
  this.#WsDisconnect(code);
  this.#WsConnect(true);
 }

 #OnError = error => this.emit('error', error);

 login = token => {
  if(!token)
   throw 'Requiere un token.';

  if(typeof (token) == 'string') {
   this.#token = token;
   this.#auth = `Bot ${token}`
   this.#Connect();
  } 
  else throw 'El token debe ser un texto.'
 
 }
 #Connect = resume => {
   if(this.#token)
    this.#WsConnect(resume);
   else 
    throw 'Requiere una autorización.'
 }

}

exports.Client = Client;

//Permisos
const Permissions = {
 CREATE_INSTANT_INVITE: 0x1,
 KICK_MEMBERS: 0x2,
 BAN_MEMBERS: 0x4,
 ADMINISTRATOR: 0x8,
 MANAGE_CHANNELS: 0x10,
 MANAGE_GUILD: 0x20,
 ADD_REACTIONS: 0x40,
 VIEW_AUDIT_LOG: 0x80,
 PRIORITY_SPEAKER: 0x100,
 STREAM: 0x200,
 VIEW_CHANNEL: 0x400,
 SEND_MESSAGES: 0x800,
 SEND_TTS_MESSAGES: 0x1000,
 MANAGE_MESSAGES: 0x2000,
 EMBED_LINKS: 0x4000,
 ATTACH_FILES: 0x8000,
 READ_MESSAGE_HISTORY: 0x10000,
 MENTION_EVERYONE: 0x20000,
 USE_EXTERNAL_EMOJIS: 0x40000,
 CONNECT: 0x100000,
 SPEAK: 0x200000,
 MUTE_MEMBERS: 0x400000,
 DEAFEN_MEMBERS: 0x800000,
 MOVE_MEMBERS: 0x1000000,
 USE_VAD: 0x2000000,
 CHANGE_NICKNAME: 0x4000000,
 MANAGE_NICKNAMES: 0x8000000,
 MANAGE_ROLES: 0x10000000,
 MANAGE_WEBHOOKS: 0x20000000,
 MANAGE_EMOJIS: 0x40000000,
};

exports.Permissions = Permissions;