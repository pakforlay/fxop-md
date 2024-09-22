const axios = require("axios");
const { decodeJid, parsedJid, createInteractiveMessage } = require("../src/functions");
const Base = require("./Base");
const config = require("../../config");
const { generateWAMessageFromContent } = require("baileys");
const fileType = require("file-type");
const { DEVS } = require("../src/devs");
class Message extends Base {
	constructor(client, data) {
		super(client);
		if (data) this._patch(data);
	}

	_patch(data) {
		const { key, message, sender, isGroup, pushName, body, quoted, messageTimestamp } = data;
		Object.assign(this, {
			user: decodeJid(this.client.user.id),
			key,
			isGroup,
			message,
			pushName,
			text: body,
			jid: key?.remoteJid,
			id: key?.id,
			fromMe: key?.fromMe ?? false,
			timestamp: messageTimestamp?.low || messageTimestamp,
			sudo: config.SUDO.split(",").includes(sender?.split("@")[0]),
			devs: DEVS.split(",").includes(sender?.split("@")[0]),
			sender: { jid: sender?.split(":")[0] + "@s.whatsapp.net", name: pushName || "" },
		});
		this.participant = parsedJid(sender)[0];
		this._parseMessageType(message);
		this._parseQuotedMessage(quoted);
	}

	_parseMessageType(message) {
		const types = ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"];
		this.messageType = types.find(type => message[type])?.replace("Message", "") || (message.conversation ? "text" : "unknown");
		this.textData = message.conversation;
	}

	_parseQuotedMessage(quoted) {
		this.reply_message = quoted ? { type: "extendedTextMessage", key: quoted.key } : null;
	}

	async sendReply(text, opt = {}) {
		return this.client.sendMessage(this.jid, { text }, { quoted: this, ...opt });
	}

	async forward(jid, message, options = {}) {
		const m = generateWAMessageFromContent(jid, message, { ...options, userJid: this.client.user.id });
		m.message.contextInfo = options.contextInfo || m.message.contextInfo;
		await this.client.relayMessage(jid, m.message, { messageId: m.key.id, ...options });
		return m;
	}

	async sendFile(content, options = {}) {
		const { data } = await this.client.getFile(content);
		const mime = (await fileType.fromBuffer(data)).mime;
		return this.client.sendMessage(this.jid, { [mime.split("/")[0]]: data }, options);
	}

	async sendFromUrl(url, options = {}) {
		const buffer = Buffer.from((await axios.get(url, { responseType: "arraybuffer" })).data, "binary");
		const mime = (await fileType.fromBuffer(buffer)).mime;
		return this.client.sendMessage(this.jid, { [mime.split("/")[0]]: buffer, ...options });
	}

	async edit(text, opt = {}) {
		await this.client.sendMessage(this.jid, { text, edit: this.key, ...opt });
	}

	async send(content, options = {}) {
		const jid = this.jid || options.jid;
		if (!jid) throw new Error("JID is required to send a message.");
		const type = options.type || (await this._detectType(content));
		const mergedOptions = { ...{ quoted: this }, ...options };

		if (type === "template") {
			const message = { viewOnceMessage: { message: generateWAMessageFromContent(jid, content, mergedOptions) } };
			await this.client.relayMessage(jid, message, { messageId: message.key.id });
		} else if (type === "interactive") {
			const interactiveMessage = createInteractiveMessage(content);
			await this.client.relayMessage(jid, interactiveMessage.message, { messageId: interactiveMessage.key.id });
		} else {
			return this.client.sendMessage(jid, { [type]: Buffer.isBuffer(content) ? content : { url: content }, ...mergedOptions });
		}
	}

	async _detectType(content) {
		if (typeof content === "string" && this.isUrl(content)) {
			const contentType = (await axios.head(content)).headers["content-type"].split("/")[0];
			return ["image", "video", "audio"].includes(contentType) ? contentType : "text";
		}
		if (Buffer.isBuffer(content)) {
			const mime = (await fileType.fromBuffer(content)).mime;
			return mime.split("/")[0];
		}
		return "text";
	}

	isUrl(str) {
		try {
			new URL(str);
			return true;
		} catch {
			return false;
		}
	}
}
module.exports = Message;
