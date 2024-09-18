const { connect, modulesJS, sleep, fetchPlugins } = require("./lib");
const express = require("express");
const path = require("path");
const config = require("./config");
const io = require("socket.io-client");
const app = express();
const PORT = 8000;

async function initialize() {
	await sleep(2000);
	await modulesJS(path.join(__dirname, "/lib/db/"));
	await config.DATABASE.sync();
	await modulesJS(path.join(__dirname, "/plugins/"));
	await fetchPlugins();
	console.log("Modules Installed");
	const ws = io("https://socket-counter-yb8q.onrender.com/", { reconnection: true });
	ws.on("connect", () => console.log("Connected to server"));
	ws.on("disconnect", () => console.log("Disconnected from server"));
	return await connect();
}

initialize();

app.listen(PORT);
