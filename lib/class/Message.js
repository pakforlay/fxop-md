const axios = require("axios");
const { decodeJid, parsedJid } = require("../src/functions");
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
			prefix: config.HANDLERS,
		});
		this.participant = parsedJid(sender)[0];
		this._parseMessageType(message);
		this._parseQuotedMessage(quoted);
	}

	_parseMessageType(message) {
		const types = ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"];
		this.messageType = types.find(type => message[type])?.replace("Message", "") || (message.conversation ? "text" : "unknown");
		this.textData = message.conversation || "";
	}

	_parseQuotedMessage(quoted) {
		this.reply_message = quoted ? { type: "extendedTextMessage", key: quoted.key } : null;
	}

	async sendVcard(contact, options = {}) {
		return this.client.sendMessage(this.jid, {
			contacts: { displayName: contact.name, contacts: [{ vcard: contact.vcard }] },
			...options,
		});
	}

	async react(emoji) {
		return this.client.sendMessage(this.jid, {
			react: { text: emoji, key: this.key },
		});
	}

	async sendPTT(audio, options = {}) {
		return this.client.sendMessage(this.jid, {
			audio: { url: audio },
			mimetype: "audio/ogg; codecs=opus",
			ptt: true,
			...options,
		});
	}

	async sendGIF(gif, options = {}) {
		return this.client.sendMessage(this.jid, {
			video: { url: gif },
			gifPlayback: true,
			...options,
		});
	}

	async sendMention(text, mentioned, options = {}) {
		return this.client.sendMessage(this.jid, {
			text,
			mentions: mentioned,
			...options,
		});
	}

	async sendReply(text, opt = {}) {
		return this.client.sendMessage(this.jid, { text }, { quoted: this, ...opt });
	}

	async reply(text, options = {}) {
		const message = await this.client.sendMessage(this.jid, { text }, { quoted: this.data, ...options });
		return new Message(this.client, message);
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
		const type = options.type || (await this._detectType(content));
		return this.client.sendMessage(jid, {
			[type]: Buffer.isBuffer(content) ? content : { url: content },
			...{ quoted: this, ...options },
		});
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

	async sendMessage(jid, content, opt = { packname: "ᴀsᴛʀᴏ", author: "ғxᴏᴘ-ᴍᴅ", fileName: "ғxᴏᴘ-ᴍᴅ" }, type = "text") {
		const isUrl = this.isUrl(content);
		if (Buffer.isBuffer(content) || isUrl) {
			const messageContent = { [type]: Buffer.isBuffer(content) ? content : { url: content }, ...opt };
			return this.client.sendMessage(jid, messageContent);
		}
		if (type === "sticker") {
			const { data, mime } = await this.client.getFile(content);
			if (mime === "image/webp") {
				const buff = await writeExifWebp(data, opt);
				return this.client.sendMessage(jid, { sticker: { url: buff }, ...opt });
			}
			const mimePrefix = mime.split("/")[0];
			if (["video", "image"].includes(mimePrefix)) {
				return this.client.sendImageAsSticker(this.jid, content, opt);
			}
		} else if (type === "document" && !opt.mimetype) {
			throw new Error("Mimetype is required for document");
		}
		return this.client.sendMessage(jid, { [type]: content, ...opt });
	}
}

module.exports = Message;
