const { Module, mode, getBuffer, getJson, getCpuInfo, runtime, commands, removePluginHandler, installPluginHandler, listPluginsHandler } = require("../lib");
const os = require("os");
const util = require("util");
const axios = require("axios");
const simplegit = require("simple-git");
const git = simplegit();
const { TIME_ZONE, BRANCH, BOT_INFO } = require("../config");
const { exec, execSync } = require("child_process");
const { PausedChats } = require("../lib/db");
var branch = BRANCH;

function getRAMUsage() {
	const totalMemory = os.totalmem();
	const freeMemory = os.freemem();
	const usedMemory = totalMemory - freeMemory;
	return `${(usedMemory / 1024 / 1024).toFixed(2)} MB / ${(totalMemory / 1024 / 1024).toFixed(2)} MB`;
}

function getOS() {
	const osType = os.type();
	switch (osType) {
		case "Linux":
			return "Linux";
		case "Darwin":
			return "MacOS";
		case "Windows_NT":
			return "Windows";
		default:
			return "VPS";
	}
}

Module(
	{
		pattern: "ping",
		fromMe: mode,
		desc: "Bot response in milliseconds.",
		type: "system",
	},
	async message => {
		const start = new Date().getTime();
		const msg = await message.reply("Checking");
		const end = new Date().getTime();
		const responseTime = (end - start) / 1000;
		await msg.edit(`\`\`\`Responce Rate ${responseTime} secs\`\`\``);
	},
);

Module(
	{
		pattern: "restart",
		fromMe: true,
		desc: "Restarts Bot",
		type: "system",
	},
	async (msg, match, client) => {
		await msg.sendReply("*_Restarting_*");
		await exec(require("../package.json").scripts.start);
	},
);

Module(
	{
		pattern: "shutdown",
		fromMe: true,
		desc: "stops the bot",
		type: "system",
	},
	async (message, match) => {
		await message.sendReply("*_Shutting Down_*");
		await exec(require("../package.json").scripts.stop);
	},
);

Module(
	{
		pattern: "enable ?(.*)",
		fromMe: true,
		desc: "Disables the bot",
		type: "system",
	},
	async message => {
		await PausedChats.savePausedChat(message.key.remoteJid);
		await message.reply("_Bot Disabled in this Chat_");
	},
);

Module(
	{
		pattern: "disable ?(.*)",
		fromMe: true,
		desc: "Enables the bot",
		type: "system",
	},
	async message => {
		const pausedChat = await PausedChats.PausedChats.findOne({ where: { chatId: message.key.remoteJid } });
		if (pausedChat) {
			await pausedChat.destroy();
			await message.reply("_Bot Enabled in this Chat_");
		} else {
			await message.reply("_Bot wasn't disabled_");
		}
	},
);

Module(
	{
		pattern: "runtime",
		fromMe: true,
		desc: "Check uptime of bot",
		type: "system",
	},
	async (message, match) => {
		message.reply(`*Alive ${runtime(process.uptime())}*`);
	},
);

Module(
	{
		pattern: "logout",
		fromMe: true,
		desc: "logouts of out the bot",
		type: "system",
	},
	async (message, match, client) => {
		await message.sendReply("_Logged Out!_");
		await message.Logout();
		return await exec(require("../package.json").scripts.stop);
	},
);
Module(
	{
		pattern: "cpu",
		fromMe: mode,
		desc: "Returns CPU Info",
		type: "system",
	},
	async message => {
		const cpuInfo = await getCpuInfo();
		await message.send(cpuInfo);
	},
);
Module(
	{
		pattern: "install",
		fromMe: true,
		desc: "Installs External plugins",
		type: "system",
	},
	installPluginHandler,
);
Module(
	{
		pattern: "plugin",
		fromMe: true,
		desc: "Plugin list",
		type: "system",
	},
	listPluginsHandler,
);
Module(
	{
		pattern: "remove",
		fromMe: true,
		desc: "Remove external plugins",
		type: "system",
	},
	removePluginHandler,
);

Module(
	{
		pattern: "menu",
		fromMe: mode,
		description: "Show All Commands",
		dontAddCommandList: true,
	},
	async (message, query) => {
		if (query) {
			for (const plugin of commands) {
				if (plugin.pattern && plugin.pattern.test(message.prefix + query)) {
					const commandName = plugin.pattern.toString().split(/\W+/)[2];
					return message.reply(`\`\`\`Command: ${message.prefix}${commandName.trim()}
Description: ${plugin.description || "No description available"}\`\`\``);
				}
			}
			return message.reply("Command not found.");
		} else {
			const { prefix } = message;
			const [currentDate, currentTime] = new Date().toLocaleString("en-IN", { timeZone: TIME_ZONE }).split(",");
			const currentDay = new Date().toLocaleDateString("en-US", { weekday: "long" });
			let menuText = `\`\`\`╭─ ғxᴏᴘʀɪsᴀ ᴍᴅ ───
│ User: ${message.pushName}
│ Prefix: ${prefix}
│ Date: ${currentDate}
│ Time: ${currentTime}
│ Day: ${currentDay}
│ Plugins: ${commands.length}
│ Runtime: ${runtime(process.uptime())}
│ RAM Usage: ${getRAMUsage()}
│ OS: ${getOS()}
│ Version: ${require("../package.json").version}
╰────────────────\`\`\`\n`;

			const commandList = [];
			const categories = new Set();

			commands.forEach(command => {
				if (command.pattern && !command.dontAddCommandList) {
					const commandName = command.pattern.toString().split(/\W+/)[2];
					const category = command.type ? command.type.toLowerCase() : "misc";
					commandList.push({ name: commandName, category });
					categories.add(category);
				}
			});

			commandList.sort((a, b) => a.name.localeCompare(b.name));
			Array.from(categories)
				.sort()
				.forEach(category => {
					menuText += `\n\`\`\`╭── ${category.toUpperCase()} ────`;
					const categoryCommands = commandList.filter(cmd => cmd.category === category);
					categoryCommands.forEach(({ name }) => {
						menuText += `\n│ ${name.toUpperCase().trim()}`;
					});
					menuText += `\n╰──────────────\`\`\`\n`;
				});

			try {
				const media = await getBuffer(BOT_INFO.split(";")[2]);
				return await message.send(media, { caption: menuText.trim() });
			} catch (error) {
				console.error("Error fetching or sending media:", error);
				return await message.send(menuText.trim());
			}
		}
	},
);

Module(
	{
		pattern: "list",
		fromMe: mode,
		description: "Show All Commands",
		dontAddCommandList: true,
	},
	async (message, query, { prefix }) => {
		let commandListText = "\t\t```Command List```\n";
		const commandList = [];

		commands.forEach(command => {
			if (command.pattern && !command.dontAddCommandList) {
				const commandName = command.pattern.toString().split(/\W+/)[2]; // Changed this line
				const description = command.desc || command.info || "No description available";
				commandList.push({ name: commandName, description });
			}
		});

		commandList.sort((a, b) => a.name.localeCompare(b.name));
		commandList.forEach(({ name, description }, index) => {
			commandListText += `\`\`\`${index + 1} ${name.trim()}\`\`\`\n`;
			commandListText += `Use: \`\`\`${description}\`\`\`\n\n`;
		});

		return await message.send(commandListText);
	},
);

Module(
	{
		pattern: "patch ?(.*)",
		fromMe: true,
		desc: "Run bot patching",
		type: "system",
	},
	async m => {
		await m.reply("_Feature UnderDevelopment!_");
	},
);

Module(
	{
		pattern: "fxop ?(.*)",
		fromMe: mode,
		desc: "Get Active Fxop Users",
		type: "system",
	},
	async m => {
		const msg = await m.reply("Fetching Users");
		const data = await getJson("https://socket-counter-yb8q.onrender.com/active-users");
		const users = data.activeUsers;
		return await msg.edit(`*_${users} active Users on FX-BOT_*`);
	},
);

Module(
	{
		pattern: "checkupdates ?(.*)",
		fromMe: true,
		desc: "Check remote for Updates",
		type: "system",
	},
	async (message, match, m, client) => {
		try {
			const repoUrl = "https://api.github.com/repos/FXastro/fxop-md/commits/master";
			const response = await axios.get(repoUrl);
			const latestRemoteCommit = response.data.sha;
			const latestLocalCommit = execSync("git rev-parse HEAD").toString().trim();
			if (latestRemoteCommit === latestLocalCommit) {
				await message.send("```Already on the latest Version```");
			} else {
				await message.send(`*New updates are available*\n> ${latestRemoteCommit}.`);
			}
		} catch (error) {
			await message.send("Failed to check for updates.");
		}
	},
);

Module(
	{
		pattern: "update",
		fromMe: true,
		desc: "Update the bot",
		type: "system",
	},
	async (message, match) => {
		prefix = message.prefix;
		await git.fetch();

		var commits = await git.log([branch + "..origin/" + branch]);
		if (match === "now") {
			if (commits.total === 0) {
				return await message.send("```Already on the latest Version```");
			}
			await message.send("*Updating...*");
			await exec("git stash && git pull origin " + BRANCH, async (err, stdout, stderr) => {
				if (err) {
					return await message.send("```" + stderr + "```");
				}
				await message.send("*Restarting...*");
				let dependancy = await updatedDependencies();
				if (dependancy) {
					await message.reply("*Dependancies changed installing new dependancies *");
					await message.reply("*Restarting...*");
					exec(require("../package.json").scripts.start);
				} else {
					await message.reply("*Restarting...*");
					exec(require("../package.json").scripts.start);
				}
			});
		} else {
			if (commits.total === 0) {
				return await message.send("```Already on the latest Version```");
			} else {
				let changes = "_New update available!_\n\n";
				changes += "*Commits:* ```" + commits.total + "```\n";
				changes += "*Branch:* ```" + branch + "```\n";
				changes += "*Changes:* \n";
				commits.all.forEach((commit, index) => {
					changes += "```" + (index + 1) + ". " + commit.message + "```\n";
				});
				changes += "\n*To update, send* ```" + prefix + "update now```";
				await message.send(changes);
			}
		}
	},
);

async function updatedDependencies() {
	try {
		const diff = await git.diff([`${branch}..origin/${branch}`]);
		const hasDependencyChanges = diff.includes('"dependencies":');
		return hasDependencyChanges;
	} catch (error) {
		console.error("Error occurred while checking package.json:", error);
		return false;
	}
}

Module(
	{
		on: "text",
		fromMe: true,
		dontAddCommandList: true,
	},
	async (message, match, m, client) => {
		const content = message.text;
		if (!content) return;
		if (!(content.startsWith(">") || content.startsWith("$") || content.startsWith("|"))) return;

		const evalCmd = content.slice(1).trim();

		try {
			let result;
			if (evalCmd.includes("await")) {
				result = await eval(`(async () => { ${evalCmd} })();`);
			} else {
				result = eval(evalCmd);
			}

			if (typeof result === "function") {
				let functionString = result.toString();
				if (functionString.includes("[native code]") || functionString.length < 50) {
					let properties = Object.getOwnPropertyNames(result);
					let propertyString = properties
						.map(prop => {
							try {
								return `${prop}: ${util.inspect(result[prop], { depth: 0 })}`;
							} catch (e) {
								return `${prop}: [Unable to inspect]`;
							}
						})
						.join("\n");

					functionString += "\n\nProperties:\n" + propertyString;
				}
				result = functionString;
			} else if (typeof result !== "string") {
				result = util.inspect(result, { depth: null });
			}
			await message.reply(result);
		} catch (error) {
			await message.reply(`Error: ${error.message}`);
		}
	},
);
