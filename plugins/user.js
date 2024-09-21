const { Module, parsedJid } = require("../lib");
const { WarnDB } = require("../lib/db");
const { WARN_COUNT } = require("../config");
const { getWarns, saveWarn, resetWarn, removeLastWarn } = WarnDB;
const { getFilter, setFilter, deleteFilter, searchFilters } = require("../lib/db/filters");

Module(
	{
		pattern: "warn",
		fromMe: true,
		desc: "Warn a user",
		type: "user",
	},
	async (message, match) => {
		const userId = message.mention[0] || message.reply_message?.jid;
		if (!userId) return message.reply("_Mention or reply to someone_");
		let reason = message?.reply_message?.text || match;
		reason = reason.replace(/@(\d+)/, "").trim();
		reason = reason || "Reason not provided";

		const warnInfo = await saveWarn(userId, reason);
		await message.reply(`_User @${userId.split("@")[0]} warned._ \n_Warn Count: ${warnInfo.warnCount}._ \n_Reason: ${reason}_`, { mentions: [userId] });

		if (warnInfo.warnCount >= WARN_COUNT) {
			const jid = parsedJid(userId);
			await message.send( "Warn limit exceeded. Kicking user.");
			return await message.client.groupParticipantsUpdate(message.jid, jid, "remove");
		}
	},
);

Module(
	{
		pattern: "rwarn",
		fromMe: true,
		desc: "Reset warnings for a user",
		type: "user",
	},
	async message => {
		const userId = message.mention[0] || message.reply_message?.jid;
		if (!userId) return message.reply("_Mention or reply to someone_");
		await resetWarn(userId);
		return await message.reply(`_Warnings for @${userId.split("@")[0]} reset_`, {
			mentions: [userId],
		});
	},
);

Module(
	{
		pattern: "delwarn",
		fromMe: true,
		desc: "Remove the last warning for a user",
		type: "user",
	},
	async message => {
		const userId = message.mention[0] || message.reply_message?.jid;
		if (!userId) return message.reply("_Mention or reply to someone_");

		const updatedWarn = await removeLastWarn(userId);
		if (updatedWarn) {
			return await message.reply(`_Last warning removed for @${userId.split("@")[0]}._ \n_Current Warn Count: ${updatedWarn.warnCount}._`, { mentions: [userId] });
		} else {
			return await message.reply(`_No warnings found for @${userId.split("@")[0]}._`, {
				mentions: [userId],
			});
		}
	},
);

Module(
	{
		pattern: "getwarns",
		fromMe: true,
		desc: "Show warnings for a user",
		type: "user",
	},
	async message => {
		const userId = message.mention[0] || message.reply_message?.jid;
		if (!userId) return message.reply("_Mention or reply to someone_");

		const warnInfo = await getWarns(userId);
		if (warnInfo) {
			const warningList = warnInfo.reasons.map((reason, index) => `${index + 1}. ${reason}`).join("\n");
			return await message.reply(`_Warnings for @${userId.split("@")[0]}:_ \n_Total Warns: ${warnInfo.warnCount}_ \n\n${warningList}`, { mentions: [userId] });
		} else {
			return await message.reply(`_No warnings found for @${userId.split("@")[0]}._`, {
				mentions: [userId],
			});
		}
	},
);

Module(
	{
		pattern: "filter",
		fromMe: true,
		desc: "Adds or manages filters. Use '.filter' to view, '.filter keyword:response' to add/update.",
		type: "user",
	},
	async (message, match) => {
		let [keyword, ...responseParts] = match.split(":");
		let response = responseParts.join(":");

		if (!match) {
			const activeFilters = await getFilter(message.jid);
			if (!activeFilters) {
				await message.reply("No filters are currently set in this chat.");
			} else {
				let filterListMessage = "Your active filters for this chat:\n\n";
				activeFilters.forEach(filter => {
					filterListMessage += `✒ ${filter.dataValues.pattern} (by ${filter.dataValues.createdBy})\n`;
				});
				filterListMessage += "\nUse: .filter keyword:message:options to set a new filter";
				filterListMessage += "\nOptions: -r (regex), -c (case sensitive), -e (exact match)";
				await message.reply(filterListMessage);
			}
		} else if (!keyword || !response) {
			await message.reply("```Use: .filter keyword:message:options\nto set a filter```");
		} else {
			const options = response.split(":").pop().split(" ");
			response = response.split(":").slice(0, -1).join(":");

			const regex = options.includes("-r");
			const caseSensitive = options.includes("-c");
			const exactMatch = options.includes("-e");

			await setFilter(message.jid, keyword, response, regex, caseSensitive, exactMatch, message.pushName || "Anonymous");
			await message.reply(`_Successfully set filter for ${keyword}_`);
		}
	},
);

Module(
	{
		pattern: "fstop",
		fromMe: true,
		desc: "Stops a previously added filter.",
		type: "user",
	},
	async (message, match) => {
		if (!match) return await message.reply("\n*Example:* ```.fstop hello```");

		const deletedFilter = await deleteFilter(message.jid, match);
		if (!deletedFilter) {
			await message.reply("No existing filter matches the provided input.");
		} else {
			await message.reply(`_Filter ${match} deleted_`);
		}
	},
);

Module(
	{
		pattern: "gfilter",
		fromMe: true,
		desc: "Gets details of a specific filter.",
		type: "user",
	},
	async (message, match) => {
		if (!match) return await message.reply("\n*Example:* ```.getfilter hello```");

		const filter = await getFilter(message.jid, match);
		if (!filter) {
			await message.reply("No filter found with the provided keyword.");
		} else {
			const filterInfo = filter[0].dataValues;
			let response = `*Filter Information:*\n`;
			response += `• Keyword: ${filterInfo.pattern}\n`;
			response += `• Response: ${filterInfo.text}\n`;
			response += `• Regex: ${filterInfo.regex ? "Yes" : "No"}\n`;
			response += `• Case Sensitive: ${filterInfo.caseSensitive ? "Yes" : "No"}\n`;
			response += `• Exact Match: ${filterInfo.exactMatch ? "Yes" : "No"}\n`;
			response += `• Created By: ${filterInfo.createdBy}\n`;
			response += `• Created At: ${filterInfo.createdAt}`;
			await message.reply(response);
		}
	},
);

Module(
	{
		pattern: "sfilter",
		fromMe: true,
		desc: "Searches for filters containing a specific term.",
		type: "user",
	},
	async (message, match) => {
		if (!match) return await message.reply("\n*Example:* ```.searchfilter hello```");

		const filters = await searchFilters(match);
		if (filters.length === 0) {
			await message.reply("No filters found containing the provided term.");
		} else {
			let response = `*Filters containing "${match}":*\n\n`;
			filters.forEach(filter => {
				response += `• Chat: ${filter.chat}\n`;
				response += `  Keyword: ${filter.pattern}\n`;
				response += `  Response: ${filter.text}\n\n`;
			});
			await message.reply(response);
		}
	},
);

Module(
	{
		pattern: "fcount",
		fromMe: true,
		desc: "Counts the number of filters in the current chat.",
		type: "user",
	},
	async (message, match) => {
		const filters = await getFilter(message.jid);
		const count = filters ? filters.length : 0;
		await message.reply(`There are ${count} filter(s) in this chat.`);
	},
);

Module(
	{
		on: "text",
		fromMe: false,
		dontAddCommandList: true,
	},
	async (message, match) => {
		const activeFilters = await getFilter(message.jid);
		if (!activeFilters) return;

		activeFilters.forEach(async filter => {
			let pattern;
			if (filter.dataValues.regex) {
				pattern = new RegExp(filter.dataValues.pattern, filter.dataValues.caseSensitive ? "gm" : "gim");
			} else if (filter.dataValues.exactMatch) {
				pattern = new RegExp(`^${filter.dataValues.pattern}$`, filter.dataValues.caseSensitive ? "" : "i");
			} else {
				pattern = new RegExp(`\\b${filter.dataValues.pattern}\\b`, filter.dataValues.caseSensitive ? "gm" : "gim");
			}

			if (pattern.test(match)) {
				await message.reply(filter.dataValues.text, {
					quoted: message,
				});
			}
		});
	},
);
