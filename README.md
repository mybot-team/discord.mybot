# discord.mybot v0

![typescript build](https://github.com/mybot-team/discord.mybot/actions/workflows/build.yaml/badge.svg)

discord.mybot es un módulo de Node.js publicado en NPM que le permite interactuar con la API de Discord con mucha facilidad.

**¡Se requiere Node.js v12 o superior!**

## Instalación

`npm install discord.mybot`

## Ejemplo

```js
const Discord = require('discord.mybot');
const client = new Discord.Client();

// Token bot en: https://discordapp.com/developers/applications
client.login('BOT_TOKEN');
```

> Por ahora el módulo está en desarrollo, solo puedes iniciar tu bot mediante un token
> genial no? :D
