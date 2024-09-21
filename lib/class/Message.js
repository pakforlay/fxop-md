const axios = require("axios");
const { decodeJid, createInteractiveMessage, parsedJid } = require("../src/functions");
const Base = require("./Base");
const { writeExifWebp } = require("../src/exif");
const config = require("../../config");
const developer = require("../src/devs");
const ReplyMessage = require("./ReplyMessage");
const fileType = require("file-type");
const fs = require("fs").promises;
const { generateWAMessageFromContent, downloadContentFromMessage, generateWAMessage } = require("baileys");
const { getName } = require("../db/StoreDb");

class Message extends Base {
	constructor(client, data) {
		super(client);
		if (data) this._patch(data);
	}

	_patch(data) {
		this.user = decodeJid(this.client.user.id);
		this.key = data.key;
		this.isGroup = data.isGroup;
		this.prefix = config.HANDLERS;
		this.id = data.key?.id;
		this.jid = data.key?.remoteJid;
		this.chat = data.key?.remoteJid;
		this.message = { key: data.key, message: data.message };
		this.pushName = data.pushName;
		this.senderName = data.pushName;
		this.participant = parsedJid(data.sender)[0];
		this.store = getName;

		this.sender = {
			jid: data.sender?.includes(":") ? data.sender.split(":")[0] + "@s.whatsapp.net" : data.sender || data.key?.remoteJid,
			name: data.pushName || "",
		};

		this.sudo = config.SUDO.split(",").includes(this.participant?.split("@")[0]) ?? false;
		this.devs = developer.DEVS.split(",").includes(this.participant?.split("@")[0]) ?? false;

		this.text = data.body;
		this.fromMe = data.key?.fromMe ?? false;
		this.isBaileys = this.id?.startsWith("BAE5") ?? false;
		this.timestamp = data.messageTimestamp?.low || data.messageTimestamp;

		this._parseMessageType(data.message);
		this._parseQuotedMessage(data);

		return super._patch(data);
	}

	_parseMessageType(message) {
		const types = ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"];
		for (const type of types) {
			if (message[type]) {
				this.messageType = type.replace("Message", "");
				this[`${this.messageType}Data`] = message[type];
				return;
			}
		}
		this.messageType = message.conversation ? "text" : "unknown";
		this.textData = message.conversation;
	}

	_parseQuotedMessage(data) {
		if (data.quoted && !data.message.buttonsResponseMessage) {
			const contextInfo = data.message.extendedTextMessage?.contextInfo;
			this.reply_message = new ReplyMessage(this.client, contextInfo, data);
			this.reply_text = data.quoted.text;
			this.reply_message.type = data.quoted.type || "extendedTextMessage";
			this.reply_message.mtype = data.quoted.mtype;
			this.reply_message.key = data.quoted.key;
			this.reply_message.mention = contextInfo?.mentionedJid || false;
		} else {
			this.reply_message = false;
		}
	}

	async isAdmin(jid, user) {
		const groupMetadata = await this.client.groupMetadata(jid);
		const groupAdmins = groupMetadata.participants.filter(participant => participant.admin !== null).map(participant => participant.id);
		return groupAdmins.includes(decodeJid(user));
	}

	async sendReply(text, opt = {}) {
		if (!this.jid) {
			throw new Error("No recipient JID available. Make sure this.jid is set.");
		}
		return this.client.sendMessage(this.jid, { text }, { quoted: this, ...opt });
	}

	async pinchat() {
		return this.client.chatModify({ pin: true }, this.jid);
	}

	async unpinchat() {
		return this.client.chatModify({ pin: false }, this.jid);
	}

	async react(emoji) {
		return this.client.sendMessage(this.jid, {
			react: { text: emoji, key: this.key },
		});
	}

	async log() {
		console.log(JSON.stringify(this.data, null, 2));
	}

	async sendFile(content, options = {}) {
		const { data } = await this.client.getFile(content);
		const type = await fileType.fromBuffer(data);
		if (!type) throw new Error("Could not determine file type.");
		const mimeType = type.mime.split("/")[0];
		return this.client.sendMessage(this.jid, { [mimeType]: data }, options);
	}

	async sendFromUrl(url, options = {}) {
		try {
			if (options.jsonPath) {
				const response = await axios.get(url);
				url = this.getValueByPath(response.data, options.jsonPath);
				if (!url) throw new Error("URL not found in JSON data");
			}
			const response = await axios.get(url, { responseType: "arraybuffer" });
			const buffer = Buffer.from(response.data, "binary");
			const mime = await fileType.fromBuffer(buffer);
			if (!mime) throw new Error("Unsupported file type");

			let type = mime.mime.split("/")[0];
			if (type === "audio") options.mimetype = "audio/mpeg";
			if (type === "application") type = "document";
			const message = { [type]: buffer, ...options };
			return this.client.sendMessage(this.jid, message, { ...options });
		} catch (error) {
			console.error("Error in sendFromUrl:", error);
			throw error;
		}
	}

	getValueByPath(obj, path) {
		return path.split(".").reduce((acc, part) => acc && acc[part], obj);
	}

	async edit(text, opt = {}) {
		await this.client.sendMessage(this.jid, { text, edit: this.key, ...opt });
	}

	async reply(text, options = {}) {
		const message = await this.client.sendMessage(this.jid, { text }, { quoted: this.data, ...options });
		return new Message(this.client, message);
	}

	async send(content, options = {}) {
		const jid = this.jid || options.jid;
		if (!jid) throw new Error("JID is required to send a message.");

		let type;
		try {
			type = options.type || (await this._detectType(content));
		} catch (error) {
			console.error("Error detecting content type:", error);
			type = "text";
		}

		const defaultOptions = {
			packname: "ᴀsᴛʀᴏ",
			author: "ғxᴏᴘ-ᴍᴅ",
			quoted: this,
		};

		const mergedOptions = { ...defaultOptions, ...options };

		try {
			switch (type.toLowerCase()) {
				case "text":
					return this.client.sendMessage(jid, { text: content, ...mergedOptions });
				case "image":
				case "video":
				case "audio":
					const mediaContent = Buffer.isBuffer(content) ? content : { url: content };
					return this.client.sendMessage(jid, { [type]: mediaContent, ...mergedOptions });
				case "template":
					const optional = await generateWAMessage(jid, content, mergedOptions);
					const message = {
						viewOnceMessage: {
							message: {
								...optional.message,
							},
						},
					};
					await this.client.relayMessage(jid, message, { messageId: optional.key.id });
					break;
				case "interactive":
					const genMessage = createInteractiveMessage(content);
					await this.client.relayMessage(jid, genMessage.message, { messageId: genMessage.key.id });
					break;
				case "sticker":
					const { data, mime } = await this.client.getFile(content);
					if (mime == "image/webp") {
						const buff = await writeExifWebp(data, mergedOptions);
						await this.client.sendMessage(jid, { sticker: { url: buff }, ...mergedOptions }, mergedOptions);
					} else {
						const mimePrefix = mime.split("/")[0];
						if (mimePrefix === "video" || mimePrefix === "image") {
							await this.client.sendImageAsSticker(jid, content, mergedOptions);
						}
					}
					break;
				default:
					throw new Error(`Unsupported message type: ${type}`);
			}
		} catch (error) {
			console.error(`Error sending ${type} message to ${jid}:`, error);
			throw error;
		}
	}

	async _detectType(content) {
		if (typeof content === "string") {
			if (this.isUrl(content)) {
				try {
					const response = await fetch(content, { method: "HEAD" });
					const contentType = response.headers.get("content-type");
					if (contentType) {
						const [type] = contentType.split("/");
						return ["image", "video", "audio"].includes(type) ? type : "text";
					}
				} catch (error) {
					console.error("Error detecting URL content type:", error);
				}
			}
			return "text";
		}

		if (Buffer.isBuffer(content)) {
			try {
				const type = await fileType.fromBuffer(content);
				if (type) {
					const { mime } = type;
					if (mime.startsWith("image/")) return "image";
					if (mime.startsWith("video/")) return "video";
					if (mime.startsWith("audio/")) return "audio";
					if (mime === "application/pdf") return "document";
					if (mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "document";
				}
			} catch (error) {
				console.error("Error detecting buffer type:", error);
			}
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

	async forward(jid, message, options = {}) {
		const m = generateWAMessageFromContent(jid, message, {
			...options,
			userJid: this.client.user.id,
		});
		if (options.contextInfo) {
			m.message.contextInfo = options.contextInfo;
		}

		await this.client.relayMessage(jid, m.message, {
			messageId: m.key.id,
			...options,
		});

		return m;
	}

	async downloadAndSaveMediaMessage(message, fileName, addExtension = true) {
		const messageContent = message.msg || message;
		const mimetype = messageContent.mimetype || "";
		const mediaType = message.mtype ? message.mtype.replace(/Message/gi, "") : mimetype.split("/")[0];
		const contentStream = await downloadContentFromMessage(messageContent, mediaType);

		let buffer = Buffer.from([]);
		for await (const chunk of contentStream) {
			buffer = Buffer.concat([buffer, chunk]);
		}

		const fileInfo = await fileType.fromBuffer(buffer);
		const finalFileName = addExtension ? `${fileName}.${fileInfo.ext}` : fileName;

		await fs.writeFile(finalFileName, buffer);
		return finalFileName;
	}

	async updatePresence(status) {
		await this.client.sendPresenceUpdate(status, this.jid);
	}

	async delete() {
		return this.client.sendMessage(this.jid, {
			delete: {
				...this.data.key,
				participant: this.sender,
			},
		});
	}

	async logout() {
		await this.client.logout();
	}

	async updateProfileName(name) {
		await this.client.updateProfileName(name);
	}

	async getProfilePicture(jid) {
		return this.client.profilePictureUrl(jid, "image");
	}

	async setProfilePicture(jid, pp) {
		const profilePicture = Buffer.isBuffer(pp) ? pp : { url: pp };
		await this.client.updateProfilePicture(jid, profilePicture);
	}

	async removeProfilePicture(jid) {
		await this.client.removeProfilePicture(jid);
	}

	async blockContact(jid) {
		await this.client.updateBlockStatus(jid, "block");
	}

	async unblockContact(jid) {
		await this.client.updateBlockStatus(jid, "unblock");
	}

	async addParticipant(jid) {
		return this.client.groupParticipantsUpdate(this.jid, jid, "add");
	}

	async removeParticipant(jid) {
		return this.client.groupParticipantsUpdate(this.jid, jid, "remove");
	}

	async promoteParticipant(jid) {
		return this.client.groupParticipantsUpdate(this.jid, jid, "promote");
	}

	async demoteParticipant(jid) {
		return this.client.groupParticipantsUpdate(this.jid, jid, "demote");
	}

	async sendPoll(name, options, isMultiSelect = false) {
		return this.client.sendMessage(this.jid, {
			poll: {
				name,
				options,
				selectableOptionsCount: isMultiSelect ? options.length : 1,
			},
		});
	}

	async sendLocation(latitude, longitude, options = {}) {
		return this.client.sendMessage(this.jid, {
			location: { degreesLatitude: latitude, degreesLongitude: longitude },
			...options,
		});
	}

	async sendContact(contact, options = {}) {
		return this.client.sendMessage(this.jid, {
			contacts: { displayName: contact.name, contacts: [{ vcard: contact.vcard }] },
			...options,
		});
	}

	async sendButtons(content, buttons, options = {}) {
		return this.client.sendMessage(this.jid, {
			text: content,
			buttons: buttons.map(button => ({ buttonId: button.id, buttonText: { displayText: button.text }, type: 1 })),
			...options,
		});
	}

	async sendListMessage(title, description, sections, options = {}) {
		return this.client.sendMessage(this.jid, {
			list: {
				title: title,
				description: description,
				buttonText: options.buttonText || "Select an option",
				sections: sections,
			},
			...options,
		});
	}

	async sendReaction(emoji) {
		return this.client.sendMessage(this.jid, {
			react: { text: emoji, key: this.key },
		});
	}

	async sendVoiceNote(audio, options = {}) {
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

	async sendMentionedMessage(text, mentioned, options = {}) {
		return this.client.sendMessage(this.jid, {
			text: text,
			mentions: mentioned,
			...options,
		});
	}

	async sendQuotedMessage(quotedMessage, content, options = {}) {
		return this.client.sendMessage(this.jid, {
			text: content,
			quoted: quotedMessage,
			...options,
		});
	}

	async sendGroupInvite(groupJid, options = {}) {
		const invite = await this.client.groupInviteCode(groupJid);
		return this.client.sendMessage(this.jid, {
			groupInviteMessage: {
				groupJid: groupJid,
				inviteCode: invite,
				inviteExpiration: options.expiration || 0,
				groupName: options.groupName || "Group",
				caption: options.caption || "Join our group!",
				jpegThumbnail: options.jpegThumbnail,
			},
		});
	}

	async forwardMessage(jid, message, options = {}) {
		return this.client.sendMessage(jid, {
			forward: message,
			...options,
		});
	}

	async sendScheduledMessage(content, date, options = {}) {
		const delay = date.getTime() - Date.now();
		if (delay > 0) {
			setTimeout(() => {
				this.send(content, options);
			}, delay);
		} else {
			throw new Error("Scheduled time must be in the future");
		}
	}

	async translateMessage(text, targetLanguage) {
		console.log(`Translating "${text}" to ${targetLanguage}`);
		return `Translated: ${text}`;
	}

	async sendTyping(durationMs = 1000) {
		await this.client.sendPresenceUpdate("composing", this.jid);
		await new Promise(resolve => setTimeout(resolve, durationMs));
		await this.client.sendPresenceUpdate("paused", this.jid);
	}

	async sendReadReceipt() {
		await this.client.sendReadReceipt(this.jid, this.participant, [this.id]);
	}

	async searchMessages(query, options = {}) {
		console.log(`Searching for messages containing "${query}"`);
		return ["Message 1", "Message 2"];
	}

	async sendTemplateMessage(template, options = {}) {
		return this.client.sendMessage(this.jid, {
			templateMessage: {
				hydratedTemplate: {
					...template,
				},
			},
			...options,
		});
	}

	async sendEphemeralMessage(content, options = {}) {
		return this.client.sendMessage(this.jid, {
			...content,
			ephemeralExpiration: options.expiration || 86400,
		});
	}

	async muteChat(duration) {
		await this.client.chatModify(
			{
				mute: duration,
			},
			this.jid,
		);
	}

	async unmuteChat() {
		await this.client.chatModify(
			{
				mute: null,
			},
			this.jid,
		);
	}

	async archiveChat() {
		await this.client.chatModify(
			{
				archive: true,
			},
			this.jid,
		);
	}

	async unarchiveChat() {
		await this.client.chatModify(
			{
				archive: false,
			},
			this.jid,
		);
	}

	async getGroupMetadata() {
		return this.client.groupMetadata(this.jid);
	}

	async leaveGroup() {
		return this.client.groupLeave(this.jid);
	}

	async getGroupInviteLink() {
		return this.client.groupInviteCode(this.jid);
	}

	async revokeGroupInviteLink() {
		return this.client.groupRevokeInvite(this.jid);
	}

	async getGroupAdmins() {
		const metadata = await this.getGroupMetadata();
		return metadata.participants.filter(p => p.admin).map(p => p.id);
	}

	async isGroupAdmin(participantJid) {
		const admins = await this.getGroupAdmins();
		return admins.includes(participantJid);
	}

	async setGroupSubject(subject) {
		return this.client.groupUpdateSubject(this.jid, subject);
	}

	async setGroupDescription(description) {
		return this.client.groupUpdateDescription(this.jid, description);
	}

	async setGroupSettings(settings) {
		return this.client.groupSettingUpdate(this.jid, settings);
	}
	isFromGroup() {
		return this.jid.endsWith("@g.us");
	}

	isFromPrivateChat() {
		return this.jid.endsWith("@s.whatsapp.net");
	}
	getSenderNumber() {
		return this.participant.split("@")[0];
	}
	hasMedia() {
		return ["imageMessage", "videoMessage", "audioMessage", "stickerMessage", "documentMessage"].some(type => this.message[type]);
	}
	async getChatTitle() {
		if (this.isFromGroup()) {
			const metadata = await this.getGroupMetadata();
			return metadata.subject;
		} else {
			return this.pushName || this.getSenderNumber();
		}
	}
	async sendMessage(jid, content, opt = { packname: "ᴀsᴛʀᴏ", author: "ғxᴏᴘ-ᴍᴅ", fileName: "ғxᴏᴘ-ᴍᴅ" }, type = "text") {
		switch (type.toLowerCase()) {
			case "text":
				return this.client.sendMessage(jid, { text: content, ...opt });
			case "image" || "photo":
				if (Buffer.isBuffer(content)) {
					return this.client.sendMessage(jid, { image: content, ...opt });
				} else if (isUrl(content)) {
					return this.client.sendMessage(jid, {
						image: { url: content },
						...opt,
					});
				}
				break;
			case "video":
				if (Buffer.isBuffer(content)) {
					return this.client.sendMessage(jid, { video: content, ...opt });
				} else if (isUrl(content)) {
					return this.client.sendMessage(jid, {
						video: { url: content },
						...opt,
					});
				}
				break;
			case "audio":
				if (Buffer.isBuffer(content)) {
					return this.client.sendMessage(jid, { audio: content, ...opt });
				} else if (isUrl(content)) {
					return this.client.sendMessage(jid, {
						audio: { url: content },
						...opt,
					});
				}
				break;
			case "template":
				const optional = await generateWAMessage(jid, content, opt);
				const message = {
					viewOnceMessage: {
						message: {
							...optional.message,
						},
					},
				};
				await this.client.relayMessage(jid, message, {
					messageId: optional.key.id,
				});
				break;
			case "interactive":
				const genMessage = createInteractiveMessage(content);
				await this.client.relayMessage(jid, genMessage.message, {
					messageId: genMessage.key.id,
				});
				break;
			case "sticker":
				const { data, mime } = await this.client.getFile(content);
				if (mime == "image/webp") {
					const buff = await writeExifWebp(data, opt);
					await this.client.sendMessage(jid, { sticker: { url: buff }, ...opt }, opt);
				} else {
					const mimePrefix = mime.split("/")[0];
					if (mimePrefix === "video" || mimePrefix === "image") {
						await this.client.sendImageAsSticker(this.jid, content, opt);
					}
				}
				break;
			case "document":
				if (!opt.mimetype) throw new Error("Mimetype is required for document");
				if (Buffer.isBuffer(content)) {
					return this.client.sendMessage(jid, { document: content, ...opt });
				} else if (isUrl(content)) {
					return this.client.sendMessage(jid, {
						document: { url: content },
						...opt,
					});
				}
				break;
		}
	}
}

module.exports = Message;
