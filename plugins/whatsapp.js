const fileType = require("file-type");
const { Module, mode, serialize, parsedJid } = require("../lib");
const { loadMessage, getName } = require("../lib/db/StoreDb");
const { DELETED_LOG_CHAT, DELETED_LOG } = require("../config");

Module(
	{
		pattern: "readmore ?(.*)",
		fromMe: mode,
		desc: "Make Readmore Text",
		type: "whatsapp",
	},
	async (message, match) => {
		if (!match) return message.reply("Need text\n_Example: .readmore Hihow are you_");
		const [c1, c2] = match.split("\\");
		message.reply(`${c1}\n${"‎".repeat(4000)}\n${c2}`);
	},
);

Module(
	{
		pattern: "pp ?(.*)",
		fromMe: true,
		desc: "Set profile picture",
		type: "whatsapp",
	},
	async (message, match, m) => {
		if (!message.reply_message.image) return await message.reply("_Reply to a photo_");

		const buff = await m.quoted.download();
		await message.setPP(message.user, buff);
		await message.reply("_Profile Picture Updated_");
	},
);

Module(
	{
		pattern: "rpp ?(.*)",
		fromMe: true,
		desc: "Remove profile picture",
		type: "whatsapp",
	},
	async message => {
		await message.removePP(message.user);
		return await message.sendReply("_Profile Photo Removed!_");
	},
);

Module(
	{
		pattern: "setname ?(.*)",
		fromMe: true,
		desc: "Set User name",
		type: "whatsapp",
	},
	async (message, match) => {
		if (!match) return await message.reply("_Enter name_");

		await message.updateName(match);
		await message.reply(`_Username Updated : ${match}_`);
	},
);

Module(
	{
		pattern: "block ?(.*)",
		fromMe: true,
		desc: "Block a person",
		type: "whatsapp",
	},
	async (message, match) => {
		const jid = message.isGroup ? message.mention[0] || message.reply_message.jid : message.jid;
		if (!jid) return await message.reply(message.isGroup ? "_Reply to a person or mention_" : "_Blocked_");
		await message.sendMessage(message.isGroup ? `_@${jid.split("@")[0]} Blocked_` : "_Blocked_", { mentions: [jid] });
		return await message.block(jid);
	},
);

Module(
	{
		pattern: "unblock ?(.*)",
		fromMe: true,
		desc: "Unblock a person",
		type: "whatsapp",
	},
	async (message, match) => {
		const jid = message.isGroup ? message.mention[0] || message.reply_message.jid : message.jid;
		if (!jid) return await message.reply(message.isGroup ? "_Reply to a person or mention_" : "_User unblocked_");
		await message.sendMessage(message.isGroup ? `_@${jid.split("@")[0]} unblocked_` : "_User unblocked_", { mentions: [jid] });
		return await message.unblock(jid);
	},
);

Module(
	{
		pattern: "jid ?(.*)",
		fromMe: true,
		desc: "Give jid of chat/user",
		type: "whatsapp",
	},
	async message => {
		const jid = message.mention[0] || message.reply_message.jid || message.jid;
		await message.send( jid);
	},
);

Module(
	{
		pattern: "dlt ?(.*)",
		fromMe: true,
		desc: "Deletes a message",
		type: "whatsapp",
	},
	async (message, match, m, client) => {
		if (!message.reply_message) return await message.reply("Please reply to the message you want to delete.");

		await client.sendMessage(message.jid, { delete: message.reply_message.key });
	},
);

Module(
	{
		pattern: "vv",
		fromMe: true,
		desc: "Forwards The View once messsage",
		type: "whatsapp",
	},
	async (message, match, m) => {
		if (!message.reply_message) return await message.reply("Reply a ViewOnce");
		let buff = await m.quoted.download();
		return await message.sendFile(buff);
	},
);

Module(
	{
		pattern: "quoted ?(.*)",
		fromMe: mode,
		desc: "Quoted message",
		type: "whatsapp",
	},
	async message => {
		if (!message.reply_message) return await message.reply("*Reply to a message*");

		const key = message.reply_message.key;
		let msg = await loadMessage(key.id);
		if (!msg) return await message.reply("_Message not found, maybe bot was not running at that time_");

		msg = await serialize(JSON.parse(JSON.stringify(msg.message)), message.client);
		if (!msg.quoted) return await message.reply("No quoted message found");

		await message.forward(message.jid, msg.quoted.message);
	},
);

// Module(
// 	{
// 		on: "text",
// 		fromMe: !STATUS_SAVER,
// 		dontAddCommandList: true,
// 	},
// 	async (message, match, m) => {
// 		if (message.isGroup) return;

// 		const triggerKeywords = ["save", "send", "sent", "snt", "give", "snd"];
// 		const cmdz = match.toLowerCase().split(" ")[0];
// 		if (triggerKeywords.some(tr => cmdz.includes(tr))) {
// 			const relayOptions = { messageId: m.quoted.key.id };
// 			await message.client.relayMessage(message.sender.jid, m.quoted.message, relayOptions, { quoted: message });
// 		}
// 	},
// );

Module(
	{
		pattern: "save ?(.*)",
		fromMe: true,
		desc: "Saves WhatsApp Status",
		type: "whatsapp",
	},
	async (message, match, m, client) => {
		if (!message.reply_message?.image && !message.reply_message.video && !message.reply_message.audio) return await message.sendReply("_Reply A Status_");
		await message.forward(message.user, m.quoted.message);
	},
);

Module(
	{
		on: "delete",
		fromMe: false,
		dontAddCommandList: true,
	},
	async message => {
		if (!DELETED_LOG) return;
		if (!DELETED_LOG_CHAT) return await message.sendMessage(message.user, "Please set DELETED_LOG_CHAT in ENV to use log delete message");

		let msg = await loadMessage(message.messageId);
		if (!msg) return;

		msg = await serialize(JSON.parse(JSON.stringify(msg.message)), message.client);
		if (!msg) return await message.reply("No deleted message found");

		const deleted = await message.forward(DELETED_LOG_CHAT, msg.message);
		const name = !msg.from.endsWith("@g.us") ? `_Name : ${await getName(msg.from)}_` : `_Group : ${(await message.client.groupMetadata(msg.from)).subject}_\n_Name : ${await getName(msg.sender)}_`;

		await message.sendMessage(DELETED_LOG_CHAT, `_Message Deleted_\n_From : ${msg.from}_\n${name}\n_SenderJid : ${msg.sender}_`, { quoted: deleted });
	},
);

Module(
	{
		pattern: "forward ?(.*)",
		fromMe: mode,
		desc: "Forwards the replied message (any type)",
		type: "whatsapp",
	},
	async (message, match, m) => {
		if (!m.quoted) return await message.reply("Reply to a message to forward");
		const jids = parsedJid(match);
		const contextInfo = {
			forwardingScore: 1,
			isForwarded: true,
		};
		for (const jid of jids) {
			await message.forward(jid, m.quoted.message, { contextInfo });
		}
	},
);

Module(
	{
		pattern: "edit ?(.*)",
		fromMe: true,
		desc: "Edit message sent by the bot",
		type: "whatsapp",
	},
	async (message, match, m, client) => {
		if (!message.reply_message) return await message.reply("_Reply to a message_");
		if (!match) return await message.reply("```Wrong Format " + message.pushName + "\n\n" + message.prefix + "edit hello```");

		const repliedMessage = message.reply_message;
		const messageKey = repliedMessage.key;
		if (repliedMessage.edit) {
			await repliedMessage.edit(match, { key: messageKey });
		} else {
			await message.reply("_Edit function not available on the message_");
		}
	},
);

Module(
	{
		pattern: "clear ?(.*)",
		fromMe: true,
		desc: "delete whatsapp chat",
		type: "whatsapp",
	},
	async (message, match) => {
		await message.client.chatModify(
			{
				delete: true,
				lastMessages: [
					{
						key: message.data.key,
						messageTimestamp: message.messageTimestamp,
					},
				],
			},
			message.jid,
		);
		await message.reply("_Cleared.._");
	},
);

Module(
	{
		pattern: "archive ?(.*)",
		fromMe: true,
		desc: "archive whatsapp chat",
		type: "whatsapp",
	},
	async (message, match) => {
		const lstMsg = {
			message: message.message,
			key: message.key,
			messageTimestamp: message.messageTimestamp,
		};
		await message.client.chatModify(
			{
				archive: true,
				lastMessages: [lstMsg],
			},
			message.jid,
		);
		await message.reply("_Archived.._");
	},
);

Module(
	{
		pattern: "unarchive ?(.*)",
		fromMe: true,
		desc: "unarchive whatsapp chat",
		type: "whatsapp",
	},
	async (message, match) => {
		const lstMsg = {
			message: message.message,
			key: message.key,
			messageTimestamp: message.messageTimestamp,
		};
		await message.client.chatModify(
			{
				archive: false,
				lastMessages: [lstMsg],
			},
			message.jid,
		);
		await message.reply("_Unarchived.._");
	},
);

Module(
	{
		pattern: "pin",
		fromMe: true,
		desc: "pin a chat",
		type: "whatsapp",
	},
	async (message, match, m, client) => {
		try {
			await client.pinchat();
			await message.reply("_Pined.._");
		} catch (error) {
			return await message.send("```App State Keys Not Found```");
		}
	},
);

Module(
	{
		pattern: "unpin ?(.*)",
		fromMe: true,
		desc: "unpin a msg",
		type: "whatsapp",
	},
	async (message, match, m, client) => {
		try {
			await client.unpinchat();
			await message.reply("_Unpined.._");
		} catch (error) {
			return message.send("```App State Keys Not Found!```");
		}
	},
);

Module(
	{
		pattern: "setbio",
		fromMe: true,
		desc: "To change your profile status",
		type: "whatsapp",
	},
	async (message, match, m, client) => {
		match = match || message.reply_message.text;
		if (!match) return await message.send("*Need Status!*\n*Example: setbio Hey there! I am using WhatsApp*.");
		await client.updateProfileStatus(match);
		await message.reply("_Profile bio updated_");
	},
);

Module(
	{
		pattern: "getprivacy ?(.*)",
		fromMe: true,
		desc: "get your privacy settings",
		type: "whatsapp",
	},
	async (message, match, m, client) => {
		const { readreceipts, profile, status, online, last, groupadd, calladd } = await message.client.fetchPrivacySettings(true);
		const msg = `*♺ my privacy*\n\n*ᝄ name :* ${client.user.name}\n*ᝄ online:* ${online}\n*ᝄ profile :* ${profile}\n*ᝄ last seen :* ${last}\n*ᝄ read receipt :* ${readreceipts}\n*ᝄ about seted time :*\n*ᝄ group add settings :* ${groupadd}\n*ᝄ call add settings :* ${calladd}`;
		let img = await client.profilePictureUrl(message.user, "image").catch(() => "https://f.uguu.se/oHGtgfmR.jpg");
		await message.send(img, { caption: msg }, "image");
	},
);

Module(
	{
		pattern: "lastseen ?(.*)",
		fromMe: true,
		desc: "to change lastseen privacy",
		type: "whatsapp",
	},
	async (message, match, m, client) => {
		if (!match) return await message.send(`_*Example:-* ${message.prefix} all_\n_to change last seen privacy settings_`);
		const available_privacy = ["all", "contacts", "contact_blacklist", "none"];
		if (!available_privacy.includes(match)) return await message.send(`_action must be *${available_privacy.join("/")}* values_`);
		await client.updateLastSeenPrivacy(match);
		await message.send(`_Privacy settings *last seen* Updated to *${match}*_`);
	},
);

Module(
	{
		pattern: "online ?(.*)",
		fromMe: true,
		desc: "to change online privacy",
		type: "whatsapp",
	},
	async (message, match, m, client) => {
		if (!match) return await message.send(`_*Example:-* ${message.prefix} all_\n_to change *online*  privacy settings_`);
		const available_privacy = ["all", "match_last_seen"];
		if (!available_privacy.includes(match)) return await message.send(`_action must be *${available_privacy.join("/")}* values_`);
		await client.updateOnlinePrivacy(match);
		await message.send(`_Privacy Updated to *${match}*_`);
	},
);

Module(
	{
		pattern: "mypp ?(.*)",
		fromMe: true,
		desc: "privacy setting profile picture",
		type: "whatsapp",
	},
	async (message, match, m, client) => {
		if (!match) return await message.send(`_*Example:-* ${message.prefix} all_\n_to change *profile picture*  privacy settings_`);
		const available_privacy = ["all", "contacts", "contact_blacklist", "none"];
		if (!available_privacy.includes(match)) return await message.send(`_action must be *${available_privacy.join("/")}* values_`);
		await client.updateProfilePicturePrivacy(match);
		await message.send(`_Privacy Updated to *${match}*_`);
	},
);

Module(
	{
		pattern: "mystatus ?(.*)",
		fromMe: true,
		desc: "privacy for my status",
		type: "whatsapp",
	},
	async (message, match, m, client) => {
		if (!match) return await message.send(`_*Example:-* ${message.prefix} all_\n_to change *status*  privacy settings_`);
		const available_privacy = ["all", "contacts", "contact_blacklist", "none"];
		if (!available_privacy.includes(match)) return await message.send(`_action must be *${available_privacy.join("/")}* values_`);
		await client.updateStatusPrivacy(match);
		await message.send(`_Privacy Updated to *${match}*_`);
	},
);

Module(
	{
		pattern: "read ?(.*)",
		fromMe: true,
		desc: "privacy for read message",
		type: "whatsapp",
	},
	async (message, match, m, client) => {
		if (!match) return await message.send(`_*Example:-* ${message.prefix} all_\n_to change *read and receipts message*  privacy settings_`);
		const available_privacy = ["all", "none"];
		if (!available_privacy.includes(match)) return await message.send(`_action must be *${available_privacy.join("/")}* values_`);
		await client.updateReadReceiptsPrivacy(match);
		await message.send(`_Privacy Updated to *${match}*_`);
	},
);

Module(
	{
		pattern: "groupadd ?(.*)",
		fromMe: true,
		desc: "privacy for group add",
		type: "whatsapp",
	},
	async (message, match, m, client) => {
		if (!match) return await message.send(`_*Example:-* ${message.prefix} all_\n_to change *group add*  privacy settings_`);
		const available_privacy = ["all", "contacts", "contact_blacklist", "none"];
		if (!available_privacy.includes(match)) return await message.send(`_action must be *${available_privacy.join("/")}* values_`);
		await client.updateGroupsAddPrivacy(match);
		await message.send(`_Privacy Updated to *${match}*_`);
	},
);
