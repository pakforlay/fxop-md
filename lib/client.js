const pino = require("pino");
const path = require("path");
const fs = require("fs").promises;
const plugins = require("./plugins");
const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore, DisconnectReason } = require("baileys");
const { PausedChats } = require("./db");
const config = require("../config");
const { serialize } = require("./serialize");
const { Greetings } = require("./src/greet");
const { getAntilink, incrementWarn } = require("./db/antilink");
const { Image, Message, Sticker, Video, AllMessage } = require("./class");
const { loadMessage, saveMessage, saveChat, getName } = require("./db/StoreDb");
const { connectSession } = require("./auth");

const logger = pino({
	level: process.env.LOG_LEVEL || "silent",
});

const connect = async () => {
	const sessionDir = "../session";
	await fs.mkdir(sessionDir, { recursive: true });
	await connectSession();

	const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, sessionDir));
	const conn = makeWASocket({
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, logger),
		},
		printQRInTerminal: false,
		logger: logger.child({ module: "baileys" }),
		browser: Browsers.macOS("Desktop"),
		downloadHistory: false,
		syncFullHistory: false,
		markOnlineOnConnect: false,
		emitOwnEvents: true,
		generateHighQualityLinkPreview: true,
		getMessage: async key => ((await loadMessage(key.id)) || {}).message || { conversation: null },
	});

	conn.ev.on("connection.update", handleConnectionUpdate(conn));
	conn.ev.on("creds.update", saveCreds);
	conn.ev.on("group-participants.update", async data => await Greetings(data, conn));
	conn.ev.on("chats.update", async chats => await Promise.all(chats.map(chat => saveChat(chat))));
	conn.ev.on("messages.upsert", handleMessages(conn));

	const handleErrors = async err => {
		const { message, stack } = err;
		const fileName = stack?.split("\n")[1]?.trim();
		const errorText = `\`\`\`─━❲ ERROR REPORT ❳━─\nMessage: ${message}\nFrom: ${fileName}\`\`\``;
		await conn.sendMessage(conn.user.id, { text: errorText });
		console.error(message, fileName);
	};

	process.on("unhandledRejection", handleErrors);
	process.on("uncaughtException", handleErrors);
	return conn;
};

const handleConnectionUpdate = conn => async s => {
	const { connection, lastDisconnect } = s;
	if (connection === "connecting") console.log("Connecting to WhatsApp...");
	else if (connection === "open") {
		console.log("Connected");
		const packageVersion = require("../package.json").version;
		const totalPlugins = plugins.commands.length;
		const workType = config.WORK_TYPE;
		const alive = `\n\`\`\`FX CONNECTED\nPREFIX: ${config.HANDLERS}\nVersion: ${packageVersion}\nTotal Plugins: ${totalPlugins}\nWorktype: ${workType}\`\`\`\n`;
		await conn.sendMessage(conn.user.id, { text: alive });
	} else if (connection === "close") {
		if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
			connect();
			console.log("Reconnecting...");
		} else {
			console.log("Connection closed. Device logged out.");
			await delay(3000);
			process.exit(0);
		}
	}
};

const handleMessages = conn => async m => {
	if (m.type !== "notify") return;
	let msg = await serialize(JSON.parse(JSON.stringify(m.messages[0])), conn);
	await saveMessage(m.messages[0], msg.sender);
	if (config.AUTO_READ) await conn.readMessages([msg.key]);
	if (config.AUTO_STATUS_READ && msg.from === "status@broadcast") await conn.readMessages([msg.key]);

	let text_msg = msg.body;
	if (!msg) return;

	const regex = new RegExp(`${config.HANDLERS}( ?resume)`, "is");
	const isResume = regex.test(text_msg);
	const chatId = msg.from;
	const pausedChats = await PausedChats.getPausedChats();

	if (pausedChats.some(pausedChat => pausedChat.chatId === chatId && !isResume)) return;

	if (config.ANTILINK && msg.from.endsWith("@g.us")) {
		await handleAntilink(msg, conn);
	}

	if (config.LOGS) {
		await logMessage(msg, conn);
	}

	await handleCommands(msg, conn, m);
};

const handleAntilink = async (msg, conn) => {
	const antilink = await getAntilink(msg.from);
	if (antilink && antilink.isEnabled) {
		const groupMetadata = await conn.groupMetadata(msg.from);
		const isAdmin = groupMetadata.participants.find(p => p.id === msg.sender)?.admin;
		if (!isAdmin) {
			const containsLink = checkForLinks(msg.body);
			if (containsLink) {
				const isAllowedLink = checkAllowedLinks(msg.body, antilink.allowedLinks);
				if (!isAllowedLink) {
					await handleAntilinkAction(antilink.action, msg, conn);
					if (antilink.action === "delete" || antilink.action === "all") return;
				}
			}
		}
	}
};

const logMessage = async (msg, conn) => {
	const name = await getName(msg.sender);
	const chatInfo = msg.from?.endsWith("@g.us") ? (await conn.groupMetadata(msg.from))?.subject : msg.from;

	if (name && chatInfo && (msg.body || msg.type)) {
		console.log(`${chatInfo}\n${name}: ${msg.body || msg.type}`);
	}
};

const handleCommands = async (msg, conn, m) => {
	for (const command of plugins.commands) {
		if (command.fromMe && msg.devs && !msg.sudo) continue;

		const handleCommand = (Instance, args) => {
			const whats = new Instance(conn, msg);
			command.function(whats, ...args, msg, conn, m);
		};

		if (msg.body && command.pattern) {
			let iscommand = msg.body.match(command.pattern);
			if (iscommand) {
				let [, prefix, , match] = iscommand;
				match = match ? match : false;
				msg.prefix = prefix;
				msg.command = [prefix, iscommand[2]].join("");
				handleCommand(Message, [match]);
			}
		} else {
			switch (command.on) {
				case "text":
					if (msg.body) handleCommand(Message, [msg.body]);
					break;
				case "image":
					if (msg.type === "imageMessage") handleCommand(Image, [msg.body]);
					break;
				case "sticker":
					if (msg.type === "stickerMessage") handleCommand(Sticker, []);
					break;
				case "video":
					if (msg.type === "videoMessage") handleCommand(Video, []);
					break;
				case "delete":
					if (msg.type === "protocolMessage") {
						const whats = new Message(conn, msg);
						whats.messageId = msg.message.protocolMessage.key?.id;
						command.function(whats, msg, conn, m);
					}
					break;
				case "message":
					handleCommand(AllMessage, []);
					break;
			}
		}
	}
};

const checkForLinks = text => {
	const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;
	return urlRegex.test(text);
};

const checkAllowedLinks = (text, allowedLinks) => {
	return allowedLinks.some(link => text.includes(link));
};

const handleAntilinkAction = async (action, msg, conn) => {
	switch (action) {
		case "kick":
			await conn.groupParticipantsUpdate(msg.from, [msg.sender], "remove");
			break;
		case "warn":
			const warn = await incrementWarn(msg.from, msg.sender);
			if (warn.warnCount >= 3) {
				await conn.groupParticipantsUpdate(msg.from, [msg.sender], "remove");
			} else {
				await conn.sendMessage(msg.from, { text: `@${msg.sender.split("@")[0]}, you have been warned for sending a link. Warning ${warn.warnCount}/3`, mentions: [msg.sender] });
			}
			break;
		case "delete":
			await conn.sendMessage(msg.from, { delete: msg.key });
			break;
		case "all":
			await conn.groupParticipantsUpdate(msg.from, [msg.sender], "remove");
			await conn.sendMessage(msg.from, { delete: msg.key });
			break;
	}
};

module.exports = { connect };
