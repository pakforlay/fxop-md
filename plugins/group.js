const { Module, parsedJid, isAdmin, banUser, unbanUser, isBanned, setMessage, getMessage, delMessage, getStatus, toggleStatus, getAntilink, updateAntilink, createAntilink } = require("../lib/");

Module(
	{
		pattern: "antilink",
		fromMe: true,
		desc: "Manage antilink settings",
		type: "group",
	},
	async (message, match, m, client) => {
		const groupId = message.jid;
		const [action] = match.split(" ");
		let antilink = (await getAntilink(groupId)) || (await createAntilink(groupId));
		const responses = {
			on: async () => {
				await updateAntilink(groupId, { isEnabled: true });
				await message.reply("Antilink has been enabled.");
			},
			off: async () => {
				if (antilink) await updateAntilink(groupId, { isEnabled: false });
				await message.reply(antilink ? "Antilink has been disabled." : "Antilink not set up.");
			},
			kick: async () => {
				await updateAntilink(groupId, { action: "kick" });
				await message.reply("Antilink action set to: kick");
			},
			all: async () => {
				await updateAntilink(groupId, { action: "all" });
				await message.reply("Antilink action set to: all");
			},
			get: async () => {
				await message.reply(antilink ? `Antilink status:\nEnabled: ${antilink.isEnabled}\nAction: ${antilink.action}` : "Antilink not set up.");
			},
			default: async () => {
				await message.reply(`Usage:\n.antilink on - Enable\n.antilink off - Disable\n.antilink kick - Kick\n.antilink all - All actions\n.antilink get - Status`);
			},
		};
		await (responses[action] || responses.default)();
	},
);

const manageMessages = async (message, match, type) => {
	if (!message.isGroup) return;
	const status = await getStatus(message.jid, type);
	const msgType = type.charAt(0).toUpperCase() + type.slice(1);
	const stat = status ? "on" : "off";
	const actions = `- ${type} get\n- ${type} on\n- ${type} off\n- ${type} delete`;

	if (!match) return await message.reply(`${msgType} manager\nGroup: ${(await message.client.groupMetadata(message.jid)).subject}\nStatus: ${stat}\nAvailable Actions:\n${actions}`);

	const messageAction = {
		get: async () => {
			const msg = await getMessage(message.jid, type);
			await message.reply(msg ? msg.message : `_No ${type} message set_`);
		},
		on: async () => {
			if (!status) await toggleStatus(message.jid);
			await message.reply(status ? `_Already enabled_` : `_${msgType} enabled_`);
		},
		off: async () => {
			if (status) await toggleStatus(message.jid);
			await message.reply(status ? `_${msgType} disabled_` : `_Already disabled_`);
		},
		delete: async () => {
			await delMessage(message.jid, type);
			await message.reply(`_${msgType} deleted_`);
		},
	};

	(await (messageAction[match] || setMessage(message.jid, type, match))) && (await message.reply(`_${msgType} set successfully_`));
};

Module(
	{
		pattern: "welcome",
		fromMe: true,
		desc: "description",
		type: "group",
	},
	(message, match, m, client) => manageMessages(message, match, "welcome"),
);
Module(
	{
		pattern: "goodbye",
		fromMe: true,
		desc: "description",
		type: "group",
	},
	(message, match, m, client) => manageMessages(message, match, "goodbye"),
);

Module(
	{
		on: "message",
		fromMe: true,
		dontAddCommandList: true,
	},
	async (message, match, m, client) => {
		if (!message.isBaileys) return;
		const isban = await isBanned(message.jid);
		if (!isban) return;
		await message.reply("_Bot is banned in this chat_");
		const jid = parsedJid(message.participant);
		return await client.groupParticipantsUpdate(message.jid, jid, "remove");
	},
);

Module(
	{
		pattern: "antibot ?(.*)",
		fromMe: true,
		desc: "Turn antibot on or off",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		if (!isAdmin(message.jid, message.user, client)) return await message.reply("_I'm not admin_");
		const chatid = message.jid;
		const command = typeof match === "string" ? match.trim().toLowerCase() : "";
		if (command !== "on" && command !== "off") return await message.reply("\t```Wrong format\n\n" + message.prefix + "antibot on\n\nOR\n\n" + message.prefix + "antibot off```");
		const isban = await isBanned(chatid);
		if (command === "on") {
			if (isban) return await message.reply("_Already ON_");
			await banUser(chatid);
			return await message.reply("_Antibot Activated_");
		} else if (command === "off") {
			if (!isban) return await message.reply("_Antibot IS not ON_");
			await unbanUser(chatid);
			return await message.reply("_Antibot deactivated_");
		}
	},
);

Module(
	{
		pattern: "add",
		fromMe: true,
		desc: "add a person to group",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		match = match || message.reply_message.jid;
		if (!match) return await message.reply("_Mention user to add");
		const isadmin = await isAdmin(message.jid, message.user, client);
		if (!isadmin) return await message.reply("_I'm not admin_");
		const jid = parsedJid(match);
		await client.groupParticipantsUpdate(message.jid, jid, "add");
		return await message.reply(`_@${jid[0].split("@")[0]} added_`, {
			mentions: [jid],
		});
	},
);

Module(
	{
		pattern: "leave",
		fromMe: true,
		desc: "Leaves a Group",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		await message.reply("_Left_");
		return await client.groupLeave(message.chat.id);
	},
);

Module(
	{
		pattern: "kick",
		fromMe: true,
		desc: "kicks a person from group",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		match = match || message.reply_message.jid;
		if (!match) return await message.reply("_Mention user to kick_");
		const isadmin = await isAdmin(message.jid, message.user, client);
		if (!isadmin) return await message.reply("_I'm not admin_");
		const jid = parsedJid(match);
		await client.groupParticipantsUpdate(message.jid, jid, "remove");
		return await message.reply(`_@${jid[0].split("@")[0]} kicked_`, {
			mentions: [jid],
		});
	},
);

Module(
	{
		pattern: "del",
		fromMe: true,
		desc: "deletes a message from participants in a group (bot must be admin)",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("This command can only be used in groups.");
		if (!message.reply_message) return await message.reply("_Please reply to a particpant message you want to delete_");
		const groupMetadata = await client.groupMetadata(message.jid);
		const participants = groupMetadata.participants;
		const botJid = client.user.id.split(":")[0] + "@s.whatsapp.net";
		const isBotAdmin = participants.some(p => p.id === botJid && p.admin);
		if (!isBotAdmin) return await message.reply("I need to be an admin to delete messages from others.");
		await client.sendMessage(message.jid, {
			delete: {
				remoteJid: message.jid,
				fromMe: false,
				id: message.reply_message.key.id,
				participant: message.reply_message.key.participant,
			},
		});
	},
);

Module(
	{
		pattern: "vote",
		fromMe: true,
		desc: "Create a poll in the group",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("This command can only be used in groups.");
		if (!match) return await message.sendReply(`${message.prefix}vote Question | Option1 | Option2 | Option3`);
		const parts = match.split("|").map(part => part.trim());
		if (parts.length < 3) return await message.reply("Usage: .vote Question | Option1 | Option2 | Option3...\nMinimum 2 options are required.");
		const question = parts[0];
		const options = parts.slice(1);
		if (options.length > 12) return await message.reply("You can only have up to 12 options in a poll.");
		await client.sendMessage(message.jid, {
			poll: {
				name: question,
				values: options,
				selectableCount: 1,
			},
		});
	},
);

Module(
	{
		pattern: "promote",
		fromMe: true,
		desc: "promote to admin",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		match = match || message.reply_message.jid;
		if (!match) return await message.reply("_Mention user to promote_");
		const isadmin = await isAdmin(message.jid, message.user, client);
		if (!isadmin) return await message.reply("_I'm not admin_");
		const jid = parsedJid(match);
		await client.groupParticipantsUpdate(message.jid, jid, "promote");
		return await message.send(`_@${jid[0].split("@")[0]} promoted as admin_`, {
			mentions: [jid],
		});
	},
);

Module(
	{
		pattern: "demote",
		fromMe: true,
		desc: "demote from admin",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		match = match || message.reply_message.jid;
		if (!match) return await message.reply("_Mention user to demote_");
		const isadmin = await isAdmin(message.jid, message.user, client);
		if (!isadmin) return await message.reply("_I'm not admin_");
		const jid = parsedJid(match);
		await client.groupParticipantsUpdate(message.jid, jid, "demote");
		return await message.send(`_@${jid[0].split("@")[0]} demoted from admin_`, {
			mentions: [jid],
		});
	},
);

Module(
	{
		pattern: "mute",
		fromMe: true,
		desc: "mute group",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		if (!isAdmin(message.jid, message.user, message.client)) return await message.reply("_I'm not admin_");
		await client.groupSettingUpdate(message.jid, "announcement");
		return await message.send("_Group Muted_");
	},
);

Module(
	{
		pattern: "unmute",
		fromMe: true,
		desc: "unmute group",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		if (!isAdmin(message.jid, message.user, message.client)) return await message.reply("_I'm not admin_");
		await client.groupSettingUpdate(message.jid, "not_announcement");
		return await message.send("_Group Unmuted_");
	},
);

Module(
	{
		pattern: "gjid",
		fromMe: true,
		desc: "gets jid of all group members",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		let { participants } = await client.groupMetadata(message.jid);
		let participant = participants.map(u => u.id);
		let str = "╭──〔 *Group Jids* 〕\n";
		participant.forEach(result => {
			str += `├ *${result}*\n`;
		});
		str += `╰──────────────`;
		message.send(str);
	},
);

Module(
	{
		pattern: "tagall",
		fromMe: true,
		desc: "mention all users in group",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return;
		const { participants } = await message.client.groupMetadata(message.jid);
		let teks = "";
		for (let mem of participants) {
			teks += ` @${mem.id.split("@")[0]}\n`;
		}
		message.send(teks.trim(), {
			mentions: participants.map(a => a.id),
		});
	},
);

Module(
	{
		pattern: "tag",
		fromMe: true,
		desc: "mention all users in group",
		type: "group",
	},
	async (message, match, m, client) => {
		console.log("match");
		match = match || message.reply_message.text;
		if (!match) return message.reply("_Enter or reply to a text to tag_");
		if (!message.isGroup) return;
		const { participants } = await message.client.groupMetadata(message.jid);
		message.send(match, {
			mentions: participants.map(a => a.id),
		});
	},
);

Module(
	{
		pattern: "ginfo",
		fromMe: true,
		desc: "get group info",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		const { subject, owner, desc, participants, creation } = await client.groupMetadata(message.jid);
		const admins = participants.filter(p => p.admin).map(p => p.id);
		const creationDate = new Date(creation * 1000).toLocaleString();
		let info = `*Group Name:* ${subject}\n`;
		info += `*Owner:* @${owner.split("@")[0]}\n`;
		info += `*Creation Date:* ${creationDate}\n`;
		info += `*Total Participants:* ${participants.length}\n`;
		info += `*Total Admins:* ${admins.length}\n`;
		info += `*Description:* ${desc || "No description"}`;
		return await message.send(info, { mentions: [owner, ...admins] });
	},
);

Module(
	{
		pattern: "admins",
		fromMe: true,
		desc: "get group admins",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		const { participants } = await client.groupMetadata(message.jid);
		const admins = participants.filter(p => p.admin).map(p => p.id);
		let adminList = "*Group Admins:*\n";
		admins.forEach((admin, index) => {
			adminList += `${index + 1}. @${admin.split("@")[0]}\n`;
		});
		return await message.sendMessage(message.chat, adminList, { mentions: admins });
	},
);

Module(
	{
		pattern: "gdesc",
		fromMe: true,
		desc: "change group description",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		if (!isAdmin(message.jid, message.user, message.client)) return await message.reply("_I'm not admin_");
		if (!match) return await message.reply("_Provide the new group description_");
		await client.groupUpdateDescription(message.jid, match);
		return await message.reply("_Group description updated_");
	},
);

Module(
	{
		pattern: "gname",
		fromMe: true,
		desc: "change group name",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		if (!isAdmin(message.jid, message.user, message.client)) return await message.reply("_I'm not admin_");
		if (!match) return await message.reply("_Provide the new group name_");
		await client.groupUpdateSubject(message.jid, match);
		return await message.reply("_Group name updated_");
	},
);

Module(
	{
		pattern: "gpp",
		fromMe: true,
		desc: "change group profile picture",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		if (!isAdmin(message.jid, message.user, client)) return await message.reply("_I'm not admin_");
		if (!message.reply_message || !message.reply_message.image) return await message.reply("_Reply to an image to set as group profile picture_");
		const media = await m.quoted.download();
		await client.updateProfilePicture(message.jid, media);
		return await message.reply("_Group profile picture updated_");
	},
);

Module(
	{
		pattern: "requests",
		fromMe: true,
		desc: "view join requests",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		if (!isAdmin(message.jid, message.user, client)) return await message.reply("_I need to be an admin to view join requests_");
		const requests = await client.groupRequestParticipantsList(message.jid);
		if (requests.length === 0) return await message.reply("_No pending join requests_");
		let requestList = "*Pending Join Requests:*\n";
		requests.forEach((request, index) => {
			requestList += `${index + 1}. @${request.jid.split("@")[0]}\n`;
		});
		await message.send(requestList, { mentions: requests.map(r => r.jid) });
	},
);

Module(
	{
		pattern: "accept",
		fromMe: true,
		desc: "accept join request",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		if (!isAdmin(message.jid, message.user, message.client)) return await message.reply("_I'm not admin_");
		if (!match) return await message.reply("_Provide the number or mention the user to accept_");
		const jid = parsedJid(match)[0];
		await client.groupRequestParticipantsUpdate(message.jid, [jid], "approve");
		return await message.sendMessage(message.chat, `_@${jid.split("@")[0]} accepted to the group_`, { mentions: [jid] });
	},
);

Module(
	{
		pattern: "reject",
		fromMe: true,
		desc: "reject join request",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		if (!isAdmin(message.jid, message.user, message.client)) return await message.reply("_I'm not admin_");
		if (!match) return await message.reply("_Provide the number or mention the user to reject_");
		const jid = parsedJid(match)[0];
		await client.groupRequestParticipantsUpdate(message.jid, [jid], "reject");
		return await message.sebdMessage(message.chat, `_@${jid.split("@")[0]} rejected from the group_`, { mentions: [jid] });
	},
);

Module(
	{
		pattern: "common",
		fromMe: true,
		desc: "find common participants between two groups",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		if (!match) return await message.reply("_Provide the JID of another group to compare_");

		const group1 = message.jid;
		const group2 = match.trim();
		const [metadata1, metadata2] = await Promise.all([client.groupMetadata(group1), client.groupMetadata(group2)]);
		const participants1 = new Set(metadata1.participants.map(p => p.id));
		const participants2 = new Set(metadata2.participants.map(p => p.id));
		const commonParticipants = [...participants1].filter(p => participants2.has(p));

		if (commonParticipants.length === 0) return await message.reply("_No common participants found between the two groups_");
		let commonList = "*Common Participants:*\n";
		commonParticipants.forEach((participant, index) => {
			commonList += `${index + 1}. @${participant.split("@")[0]}\n`;
		});
		return await message.send(commonList, { mentions: commonParticipants });
	},
);

Module(
	{
		pattern: "diff",
		fromMe: true,
		desc: "find participants in one group but not in another",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		if (!match) return await message.reply("_Provide the JID of another group to compare_");

		const group1 = message.jid;
		const group2 = match.trim();
		const [metadata1, metadata2] = await Promise.all([client.groupMetadata(group1), client.groupMetadata(group2)]);
		const participants1 = new Set(metadata1.participants.map(p => p.id));
		const participants2 = new Set(metadata2.participants.map(p => p.id));
		const uniqueParticipants = [...participants1].filter(p => !participants2.has(p));
		if (uniqueParticipants.length === 0) return await message.reply("_No unique participants found in this group_");
		let uniqueList = "*Participants unique to this group:*\n";
		uniqueParticipants.forEach((participant, index) => {
			uniqueList += `${index + 1}. @${participant.split("@")[0]}\n`;
		});

		return await message.sendMessage(message.chat, uniqueList, { mentions: uniqueParticipants });
	},
);

Module(
	{
		pattern: "invite",
		fromMe: true,
		desc: "Generate invite link for the current group",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.reply("_This command is for groups_");
		const groupMetadata = await client.groupMetadata(message.jid);
		const isUserAdmin = await isAdmin(message.jid, message.participant, client);
		if (!isUserAdmin) return await message.reply("_You need to be an admin to use this command_");
		const inviteCode = await client.groupInviteCode(message.jid);
		const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

		const replyMessage = `*Group Invite Link*\n\n` + `*Group:* ${groupMetadata.subject}\n` + `*Link:* ${inviteLink}\n`;

		return await message.send(replyMessage);
	},
);

const groupSettings = new Map();

function getGroupSettings(jid) {
	if (!groupSettings.has(jid)) {
		groupSettings.set(jid, { antiPromote: false, antiDemote: false });
	}
	return groupSettings.get(jid);
}

Module(
	{
		pattern: "antipromote",
		fromMe: true,
		desc: "Toggle anti-promote feature for the group",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.sendReply("This command can only be used in groups.");

		const groupSettings = getGroupSettings(message.jid);
		groupSettings.antiPromote = !groupSettings.antiPromote;

		await message.sendReply(`Anti-promote has been ${groupSettings.antiPromote ? "enabled" : "disabled"} for this group.`);
	},
);

Module(
	{
		pattern: "antidemote",
		fromMe: true,
		desc: "Toggle anti-demote feature for the group",
		type: "group",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return await message.sendReply("This command can only be used in groups.");

		const groupSettings = getGroupSettings(message.jid);
		groupSettings.antiDemote = !groupSettings.antiDemote;

		await message.sendReply(`Anti-demote has been ${groupSettings.antiDemote ? "enabled" : "disabled"} for this group.`);
	},
);

Module(
	{
		on: "group_update",
	},
	async (message, match, m, client) => {
		if (!message.isGroup) return;

		const groupSettings = getGroupSettings(message.jid);

		if (message.update === "promote" && groupSettings.antiPromote) {
			const participants = message.participants;
			for (let jid of participants) {
				await client.groupParticipantsUpdate(message.jid, [jid], "demote");
			}
			await client.sendMessage(message.jid, { text: "Anti-promote activated. Promotion reverted." });
		} else if (message.update === "demote" && groupSettings.antiDemote) {
			const participants = message.participants;
			for (let jid of participants) {
				await client.groupParticipantsUpdate(message.jid, [jid], "promote");
			}
			await client.sendMessage(message.jid, { text: "Anti-demote activated. Demotion reverted." });
		}
	},
);
