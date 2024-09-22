const { tmpdir } = require("os");
const { promises: fs } = require("fs");
const fileType = require("file-type");
const Base = require("./Base");
const { parsedJid } = require("../src/functions");
const config = require("../../config");

class ReplyMessage extends Base {
	constructor(client, data) {
		super(client);
		if (data) this._patch(data);
	}

	_patch({ key, stanzaId, participant, quotedMessage }) {
		this.key = key;
		this.id = stanzaId;
		this.isBaileys = this.id?.startsWith("BAE5") || this.id?.length === 16;
		this.jid = participant;
		this.sudo = config.SUDO.includes(participant?.split("@")[0]);
		this.fromMe = parsedJid(this.client.user.jid)[0] === parsedJid(this.jid)[0];

		if (quotedMessage) {
			const type = Object.keys(quotedMessage)[0];
			const content = quotedMessage[type];
			this.mimetype = content?.mimetype || type;

			if (this.mimetype.includes("/")) {
				this[this.mimetype.split("/")[0]] = content;
			} else {
				this.text = content?.text || content;
			}
		}

		return super._patch({ key, stanzaId, participant, quotedMessage });
	}

	async delete() {
		return this.client.sendMessage(this.jid, {
			delete: { ...this.key, participant: this.jid },
		});
	}

	async edit(text, opt = {}) {
		return this.client.sendMessage(this.jid, { text, edit: this.key, ...opt });
	}

	async downloadMediaMessage() {
		const buff = await this.m.quoted.download();
		const { ext } = await fileType.fromBuffer(buff);
		const filePath = `${tmpdir()}.${ext}`;
		await fs.writeFile(filePath, buff);
		return filePath;
	}
}

module.exports = ReplyMessage;
