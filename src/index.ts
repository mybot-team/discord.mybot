"use strict";
import WebSocket from "ws";
import EventEmitter from "events";

export * from '../typings';

// Discord API v7
const WEB = "https://discordapp.com";
const API = `${WEB}/api/v7`;
const CDN = "https://cdn.discordapp.com";

import APIRequest from "./APIRequest";
import { PermissionsType } from "../typings";

/** 
 * Opcode
 */
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

/** 
 * red - Devuelve el texto introducido pero de color rojo
 * @param {String} msg El texto a pasar a rojo
 * @returns {String} El texto pero de color rojo
 */
const red = (msg: string): string => {
    return `\x1b[31m${msg}\x1b[0m`;
};

/** 
 * Genera un error con buena legibilidad
 * @param {String} msg El mensaje del error
 * @param {String} description OPCIONAL: descripción del error
 * @returns {String} El error generado
 */
const genError = (msg: string, description: string = ""): string => {
    if (!msg) {
        console.error("Mal uso de \`genError\`: falta un parametro obligatorio (`msg`)");
        return "";
    };
    return `${red("error")} ${msg}\n ${description ? "- " + description : ""}`;
};

/** 
 * El cliente principal
 * @extends EventEmitter
 */
class Client extends EventEmitter {
    /** 
     * El ! en las vars sirve para evitar el siguiente error:
     * - "Property 'x' has no initializer and is not definitely assigned"
     * [Más info](https://tutorial.tips/3-ways-to-fix-property-has-no-initializer-and-is-not-definitely-assigned-in-the-constructorts/)
     */

    /***/
    #token!: string;
    #auth!: any;
    #sessionId!: any;
    #lastSequence!: any;
    #lastHeartbeatAck!: any;
    #heartbeatTimer!: any;
    #ws!: any;

    /** 
     * Conectarse al WebSocket
     */
    #WsConnect = async (resume: any) => {
        this.#WsDisconnect();

        if (!resume) {
            this.#sessionId = undefined;
            this.#lastSequence = 0;
        }

        const tmbApRew: string = APIRequest.APIRequest(`${API}/gateway/bot`, {
            headers: {
                Authorization: this.#auth,
            },
        }).toString();
        
        this.#ws = new WebSocket(
            JSON.parse(
                tmbApRew
            ).url
        );

        this.#ws.on("message", this.#OnMessage);
        this.#ws.on("close", this.#OnClose);
        this.#ws.on("error", this.#OnError);
    };

    /** 
     * Desconectarse al WebSocket
     */
    #WsDisconnect = (code = 1012) => {
        if (!this.#ws) return;

        this.emit("disconnect", code);
        this.#ws.removeAllListeners();
        this.#ws.close(code);
        this.#ws = undefined;
    };

    /** 
     * Evento message
     */
    #OnMessage = (data: string) => {
        if (!data) return;
        const packet = JSON.parse(data);
        if (!packet) return;

        if (packet.s > this.#lastSequence) this.#lastSequence = packet.s;

        const op = packet.op;
        if (op == OPCode.DISPATCH) {
            const t = packet.t;
            if (t == "READY" || t == "RESUMED") {
                if (packet.d.session_id) this.#sessionId = packet.d.session_id;

                this.#lastHeartbeatAck = true;
                this.#SendHeartbeat();
                this.emit("connect");
            }
            this.emit("packet", packet);
        } else if (op == OPCode.HELLO) {
            this.#Identify();
            this.#lastHeartbeatAck = true;
            this.#SetHeartbeatTimer(packet.d.heartbeat_interval);
        } else if (op == OPCode.HEARTBEAT_ACK) {
            this.#lastHeartbeatAck = true;
        } else if (op == OPCode.HEARTBEAT) {
            this.#SendHeartbeat();
        } else if (op == OPCode.INVALID_SESSION) {
            this.emit("warn", `Sesión inválida. Reanudable: ${packet.d}`);
            this.#WsConnect(packet.d);
        } else if (op == OPCode.RECONNECT) {
            this.emit("warn", "Reconectando.");
            this.#WsConnect(true);
        }
    };

    /** 
     * Verificar identidad
     */
    #Identify = () => {
        this.#ws.send(
            JSON.stringify(
                this.#sessionId
                    ? {
                            op: OPCode.RESUME,
                            d: {
                                token: this.#token,
                                session_id: this.#sessionId,
                                seq: this.#lastSequence,
                            },
                        }
                    : {
                            op: OPCode.IDENTIFY,
                            d: {
                                token: this.#token,
                                properties: {
                                    $os: "linux",
                                    $browser: "discord.mybot",
                                    $device: "discord.mybot",
                                },
                            },
                        }
            )
        );
    };

    /** 
     * Mandar HeartBeat
     */
    #SendHeartbeat = () => {
        if (this.#lastHeartbeatAck) {
            if (this.#ws && this.#ws.readyState == 1) {
                this.#lastHeartbeatAck = false;
                this.#ws.send(
                    JSON.stringify({
                        op: OPCode.HEARTBEAT,
                        d: this.#lastSequence,
                    })
                );
            }
        } else {
            this.emit("warn", "Tiempo de espera.");
            this.#WsConnect(true);
        }
    };

    /** 
     * Empezar tiper
     */
    #SetHeartbeatTimer = (interval: number) => {
        if (this.#heartbeatTimer) {
            clearInterval(this.#heartbeatTimer);
            this.#heartbeatTimer = undefined;
        }
        if (interval)
            this.#heartbeatTimer = setInterval(this.#SendHeartbeat, interval);
    };

    /** 
     * Evento de cierre
     */
    #OnClose = (code: number) => {
        this.#WsDisconnect(code);
        this.#WsConnect(true);
    };

    /** 
     * Evento de error
     */
    #OnError = (error: any) => this.emit("error", error);

    /**
     * Login del bot
     * @param {String} token El token del bot (lo puedes conseguir [aqui](https://discordapp.com/developers/applications))
     */
    login = (token: string) => {
        if (!token) throw genError("Requiere un token.");

        if (token === "BOT_TOKEN")
            throw genError(
                "Token invalido",
                'En la función no debes escribir literalmente "BOT_TOKEN", sino el token de tu bot. Este, lo puedes conseguir en https://discordapp.com/developers/applications'
            );

        if (typeof token == "string") {
            this.#token = token;
            this.#auth = `Bot ${token}`;
            this.#Connect();
        } else throw genError("El token debe ser un texto.");
    };

    /** 
     * Conectarse con autorización
    */
    #Connect = (resume?: any) => {
        if (this.#token) this.#WsConnect(resume);
        else throw genError("Requiere una autorización.");
    };
}

/**
 * Permisos
 */
const Permissions: PermissionsType = {
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

export default {
    Client,
    Permissions,
};
