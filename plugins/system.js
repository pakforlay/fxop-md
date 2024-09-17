const { Module, mode, getCpuInfo, runtime, commands, removePluginHandler, installPluginHandler, listPluginsHandler } = require("../lib");
const util = require("util");
const { TIME_ZONE } = require("../config");
const { exec } = require("child_process");
const { PausedChats } = require("../lib/db");

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
		await message.send(getCpuInfo);
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
					const commandName = plugin.pattern.toString().split(/\W+/)[2]; // Changed this line
					return message.reply(`\`\`\`Command: ${message.prefix}${commandName.trim()}
Description: ${plugin.description || "No description available"}\`\`\``);
				}
			}
			return message.reply("Command not found.");
		} else {
			const { prefix } = message;
			const [currentDate, currentTime] = new Date().toLocaleString("en-IN", { timeZone: TIME_ZONE }).split(",");
			let menuText = `\`\`\`╭─ ғxᴏᴘʀɪsᴀ ᴍᴅ  ───
│ User: ${message.pushName}
│ Prefix: ${prefix}
│ Date: ${currentDate}
│ Time: ${currentTime}
│ Plugins: ${commands.length}
│ Runtime: ${runtime(process.uptime())}
╰────────────────\`\`\`\n`;

			const commandList = [];
			const categories = new Set();

			commands.forEach(command => {
				if (command.pattern && !command.dontAddCommandList) {
					const commandName = command.pattern.toString().split(/\W+/)[2]; // Changed this line
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
			return await message.send(menuText.trim());
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
		on: "text",
		fromMe: true,
		dontAddCommandList: true,
	},
	async (message, match, m, client) => {
		const content = message.text;
		if (!content) return;
		if (!(content.startsWith(">") || content.startsWith("$"))) return;

		const evalCmd = content.slice(1).trim();

		try {
			let result = await eval(`(${evalCmd})`);

			if (typeof result === "function") {
				result = util.inspect(result, { depth: null, showHidden: true });
			} else if (typeof result !== "string") {
				result = util.inspect(result, { depth: null });
			}

			await message.reply(result);
		} catch (error) {
			await message.reply(`Error: ${error.message}`);
		}
	},
);
