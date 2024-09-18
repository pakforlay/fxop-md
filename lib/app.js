const { connect, modulesJS, sleep, fetchPlugins } = require(".");
const express = require("express");
const path = require("path");
const config = require("../config");
const io = require("socket.io-client");
const ora = require("ora");
const Patcher = require("./src/patch");
class StartApp {
	constructor() {
		this.app = express();
		this.PORT = 8000;
		this.spinner = ora("Booting...").start();
	}

	async initialize() {
		await sleep(3000);
	//	Patcher.patch();
		await modulesJS(path.join(__dirname, "/db/"));
		this.spinner.text = "Syncing database...";
		await config.DATABASE.sync();
		this.spinner.text = "Parsing Plugins...";
		await modulesJS(path.join(__dirname, "..", "/plugins/"));
		await fetchPlugins();
		this.spinner.text = "Connecting WebSocket...";
		await new Promise(resolve => io("https://socket-counter-yb8q.onrender.com/").on("connect", resolve));
		this.spinner.text = "Connecting database...";
		this.spinner.succeed(`Server running on ${this.PORT}`);
		this.app.listen(this.PORT);
		return await connect();
	}
}

module.exports = StartApp;
